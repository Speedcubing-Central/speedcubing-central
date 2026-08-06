import type { Server as IOServer, DefaultEventsMap } from 'socket.io';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { getScramble } from './scramble.js';
import { censorMessage } from './profanity.js';
import type { SocketData } from './socket.js';
import {
  getRelayPreset,
  RELAY_PROTOCOL_VERSION,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RelayRoomDTO,
} from '@scc/shared';

type RelayIO = IOServer<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

function roomName(code: string): string {
  // Distinct prefix from Battle's own unprefixed `code` Socket.io rooms —
  // Battle and Relay rooms are independently unique-checked against their
  // own DB tables, so an identical code string existing in both could
  // otherwise cross-broadcast between the two features.
  return `relay:${code}`;
}

const roomInclude = {
  participants: { orderBy: { id: 'asc' as const } },
  legs: { orderBy: { order: 'asc' as const } },
};

async function fetchRoom(code: string) {
  return prisma.relayRoom.findUnique({ where: { code }, include: roomInclude });
}

type RoomWithRelations = NonNullable<Awaited<ReturnType<typeof fetchRoom>>>;

// A deliberately narrow query for the one question that gates starting a
// relay: is this room allowed to begin? The full fetchRoom() pulls every
// leg/participant field via roomInclude for the broadcast DTO, almost none
// of which this validation looks at. It's asked on every ready-toggle and
// again when the countdown actually fires, so it only selects what it
// needs: whether every leg has an assignee AND a generated scramble, and
// whether every participant has both approved the distribution and said
// they're ready to solve.
//
// The scramble check specifically closes a real race: scrambles are
// generated in the background once everyone's ready (see
// generateScramblesIfReady), which can legitimately take several seconds
// for some events — without gating on it here too, a fast team could start
// before that background write actually landed, beginning the relay with
// whichever legs' scrambles hadn't committed yet still blank (a bug
// reported as "a random event's scramble just doesn't show up sometimes,
// then fixes itself" — the "fixes itself" was the deferred
// generateScramblesIfReady follow-up broadcast finally arriving).
async function fetchStartGateState(code: string) {
  return prisma.relayRoom.findUnique({
    where: { code },
    select: {
      id: true,
      status: true,
      legs: { select: { assignedToId: true, scramble: true } },
      participants: { select: { id: true, isReady: true, isStartReady: true } },
    },
  });
}

// Cached per room code — presetId/customRelayId never change after a room
// is created, so there's no reason to re-resolve this on every single
// broadcast (emitRelayRoomState fires on every press/release/ready-toggle/
// assignment). For a custom relay this was a real, unnecessary database
// round trip on every one of those, not just a cheap in-memory lookup like
// the preset case already was.
const relayNameCache = new Map<string, string>();
async function resolveRelayName(room: { code: string; presetId: string | null; customRelayId: string | null }): Promise<string> {
  const cached = relayNameCache.get(room.code);
  if (cached) return cached;
  let name: string;
  if (room.presetId) {
    name = getRelayPreset(room.presetId)?.name ?? 'Relay';
  } else if (room.customRelayId) {
    const cr = await prisma.customRelay.findUnique({ where: { id: room.customRelayId } });
    name = cr?.name ?? 'Custom Relay';
  } else {
    name = 'Relay';
  }
  relayNameCache.set(room.code, name);
  return name;
}

function toRelayRoomDTO(room: RoomWithRelations, relayName: string, viewerParticipantId: string | null): RelayRoomDTO {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    presetId: room.presetId,
    customRelayId: room.customRelayId,
    relayName,
    status: room.status,
    countdownStartAt: room.countdownStartAt?.toISOString() ?? null,
    startedAt: room.startedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    participants: room.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.guestName ?? 'Player',
      isReady: p.isReady,
      isStartReady: p.isStartReady,
      isDone: p.isDone,
      isHost: p.id === room.hostParticipantId,
    })),
    legs: room.legs.map((l) => ({
      id: l.id,
      eventId: l.eventId,
      order: l.order,
      // Only the assignee gets their own scramble while the relay is live —
      // everyone else's is blanked out. Pre-ACTIVE it's always '' anyway
      // (not generated yet); once FINISHED, all scrambles are revealed.
      scramble: room.status === 'ACTIVE' && l.assignedToId !== viewerParticipantId ? '' : l.scramble,
      assignedToId: l.assignedToId,
      splitMs: l.splitMs,
    })),
  };
}

async function deleteRoomIfEmpty(code: string): Promise<void> {
  const room = await prisma.relayRoom.findUnique({ where: { code }, include: { participants: { select: { id: true } } } });
  if (room && room.participants.length === 0) {
    await prisma.relayRoom.delete({ where: { id: room.id } });
    relayNameCache.delete(code);
  }
}

// If every leg is assigned and every participant is ready, (re)generates
// every leg's scramble right away rather than at the start itself — the
// countdown is only armed once these have landed (see maybeArmCountdown),
// so generating them here is what lets a team see real scrambles while they
// get their hands on the cube. Safe to do here specifically because
// reaching "everyone ready" already guarantees the assignments are final:
// any further reassignment resets ready state straight back to false (see
// relay_assign_event), which would just re-trigger this same generation
// once ready again.
//
// `force` distinguishes two very different reasons this gets called.
// relay_toggle_ready (force=false, the default) fires on *every* ready
// toggle — including a participant un-readying and re-readying within the
// same assignment session (a stray double-click, or "wait, let me check
// something") — where the legs already generated for this session are
// still exactly right and must NOT be silently swapped out, since a
// teammate could already be staring at one of them. A live reproduction
// confirmed this: everyone ready, scrambles land, one participant
// un-readies and re-readies with no reassignment in between — every leg's
// scramble changed a couple of seconds later. So force=false skips
// straight past regeneration once every leg already has a scramble.
// restartAssigning passes force=true for "Run it again"/"Adjust
// distribution", a genuinely new attempt that must not reuse the previous
// one's scrambles.
//
// getScramble() itself retries transient cubing.js failures once (see
// scramble.ts), but a few events (444, kilominx, fto, redi_cube) have no
// scrambow fallback at all, so a worker that's still unhealthy after that
// retry can still resolve to '' — the exact bug reported ("4x4 simply
// didn't generate a scramble"). This adds a second, room-level retry layer
// on top: only the legs that actually came back empty get retried, across
// a few rounds with a short delay between them (giving a recycled worker
// time to finish respawning), and a successful leg is persisted and
// broadcast (via onProgress) as soon as it lands rather than waiting for
// every round to finish. Never write '' to the database as if it were a
// real scramble — an empty leg is simply left untouched and picked up by
// the next round (or the next ready-toggle/"run again", if every round
// here is exhausted).
const SCRAMBLE_RETRY_ROUNDS = 3;
const SCRAMBLE_RETRY_DELAY_MS = 2_000;
// Guards against a real race: relay_toggle_ready calls this on every toggle
// (see below), and two participants readying up within moments of each
// other both independently observe "everyone's ready now" via their own
// fetchRoom — without this lock, both would kick off a full, unconditional
// regeneration of every leg. Since getScramble is genuinely slow (a cold
// WASM worker can take a couple of seconds — see scramble.ts), the two runs
// don't fail fast or short-circuit against each other; they race to
// completion and each writes+broadcasts its own results. The first run's
// scrambles show up, then the second run's *different* scrambles land a few
// seconds later and silently replace them — the exact bug reported ("we saw
// the scrambles, then they changed a few seconds later"). A call arriving
// while a run for this code is already in flight is a no-op: that run
// already covers the same "everyone ready" condition, so there's nothing
// left for a second one to do.
const generatingRooms = new Set<string>();
async function generateScramblesIfReady(code: string, onProgress?: () => Promise<void>, force = false): Promise<void> {
  if (generatingRooms.has(code)) return;
  generatingRooms.add(code);
  try {
    const room = await fetchRoom(code);
    if (!room || room.legs.length === 0) return;
    if (!room.legs.every((l) => l.assignedToId) || !room.participants.every((p) => p.isReady)) return;
    if (!force && room.legs.every((l) => l.scramble)) return;

    let pending = force ? room.legs : room.legs.filter((l) => !l.scramble);
    for (let round = 1; round <= SCRAMBLE_RETRY_ROUNDS && pending.length > 0; round++) {
      const results = await Promise.all(pending.map(async (l) => ({ leg: l, scramble: await getScramble(l.eventId) })));
      const succeeded = results.filter((r) => r.scramble);
      if (succeeded.length > 0) {
        await prisma.$transaction(
          succeeded.map((r) => prisma.relayRoomLeg.update({ where: { id: r.leg.id }, data: { scramble: r.scramble } })),
        );
        await onProgress?.();
      }
      pending = results.filter((r) => !r.scramble).map((r) => r.leg);
      if (pending.length > 0 && round < SCRAMBLE_RETRY_ROUNDS) {
        console.warn('[relaySocket] retrying scramble generation for', code, '—', pending.map((l) => l.eventId).join(', '), `(round ${round + 1}/${SCRAMBLE_RETRY_ROUNDS})`);
        await new Promise((r) => setTimeout(r, SCRAMBLE_RETRY_DELAY_MS));
      }
    }
    if (pending.length > 0) {
      console.error(
        '[relaySocket] gave up generating scrambles for',
        code,
        '—',
        pending.map((l) => l.eventId).join(', '),
        `after ${SCRAMBLE_RETRY_ROUNDS} rounds; will retry on the next ready-toggle or "run again"`,
      );
    }
  } finally {
    generatingRooms.delete(code);
  }
}

const RECONNECT_GRACE_MS = 30_000;
const MAX_PASSWORD_ATTEMPTS = 5;
const CHAT_RATE_LIMIT = 5;
const CHAT_RATE_WINDOW_MS = 5000;
const MAX_PARTICIPANTS = 20;
// How far ahead the start instant is announced. Long enough for everyone to
// get their hands on the cube, short enough not to drag.
const COUNTDOWN_MS = 3_000;
// The most a participant's self-reported stop instant is allowed to pull the
// recorded finish earlier than the moment their relay_mark_done actually
// reached this server. Sized to cover real network latency and nothing more,
// so a wrong clock — or a doctored payload — can't invent a fast time.
const MAX_STOP_CORRECTION_MS = 5_000;

export function registerRelayHandlers(io: RelayIO): void {
  const pendingCleanup = new Map<string, ReturnType<typeof setTimeout>>();
  const failedPasswordAttempts = new Map<string, number>();
  const chatTimestamps = new Map<string, number[]>();
  // code -> the pending timer that will flip this room to ACTIVE when its
  // announced countdown expires. Presence in this map is also what "a
  // countdown is already armed" means, so it doubles as the lock that keeps
  // two simultaneous ready-toggles from arming two overlapping countdowns.
  const countdownTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // code -> (participantId -> socketId), so ACTIVE-phase state can be
  // personalized per participant (each only ever sees their own legs' scrambles).
  const participantSockets = new Map<string, Map<string, string>>();

  const joinSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(40),
    password: z.string().max(64).optional(),
    protocolVersion: z.number().int().optional(),
  });
  const codeSchema = z.object({ code: z.string().min(1).max(20) });
  const assignEventSchema = z.object({
    code: z.string().min(1).max(20),
    legId: z.string().min(1),
    participantId: z.string().min(1).nullable(),
  });
  const toggleReadySchema = z.object({ code: z.string().min(1).max(20), isReady: z.boolean() });
  const sendChatSchema = z.object({ code: z.string().min(1).max(20), message: z.string().min(1).max(500) });
  const markDoneSchema = z.object({ code: z.string().min(1).max(20), at: z.number().int().positive().optional() });
  const timeSyncSchema = z.object({ clientSentAt: z.number().int().positive() });

  async function emitRelayRoomState(code: string): Promise<void> {
    const room = await fetchRoom(code);
    if (!room) return;
    const relayName = await resolveRelayName(room);
    if (room.status === 'ACTIVE') {
      const sockets = participantSockets.get(code);
      if (sockets) {
        for (const [participantId, socketId] of sockets) {
          io.to(socketId).emit('relay_room_state', toRelayRoomDTO(room, relayName, participantId));
        }
      }
    } else {
      io.to(roomName(code)).emit('relay_room_state', toRelayRoomDTO(room, relayName, null));
    }
  }

  // ── Starting a relay ──────────────────────────────────────────────────
  // Replaces the old hold-to-start handshake (everyone holds spacebar, the
  // first release starts the clock). That design made the shared start
  // instant a consequence of a race between however many clients' key
  // events and round trips, which is exactly the wrong thing to build a
  // clock everyone shares on top of. It's now: everyone readies up, the
  // server picks one instant three seconds out, announces it, and every
  // client counts down to that same instant.
  //
  // The other half of the fix lives on the client (see useRelaySocket's
  // clock-offset estimate). A server timestamp is meaningless to a client
  // that renders it against its own wall clock — a device a few seconds
  // behind the server computed a *negative* elapsed time, and one running
  // ahead showed a total higher than the one the server recorded. Both were
  // reported. Every instant crossing this boundary is server-clock; clients
  // convert.

  function clearCountdownTimer(code: string): void {
    const timer = countdownTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      countdownTimers.delete(code);
    }
  }

  // Calls off an armed countdown and puts everyone back on the ready
  // screen. updateMany rather than update so this stays a no-op (instead of
  // throwing) when the room has already been deleted — leaveRoomCleanup can
  // reach here immediately after deleting the last participant's room.
  async function cancelCountdown(code: string): Promise<void> {
    const wasArmed = countdownTimers.has(code);
    clearCountdownTimer(code);
    const { count } = await prisma.relayRoom.updateMany({
      where: { code, countdownStartAt: { not: null } },
      data: { countdownStartAt: null },
    });
    if (wasArmed || count > 0) io.to(roomName(code)).emit('relay_countdown_cancelled');
  }

  // Arms the countdown if — and only if — the room is genuinely ready to
  // start: every leg assigned, every leg's background-generated scramble
  // landed, everyone happy with the distribution, and — the one that
  // actually gates this — everyone having separately confirmed on the start
  // screen that they're ready to solve. Approving the distribution must not
  // start anything on its own: doing that counted the team down while they
  // were still reaching for their cubes. Idempotent, since several callers
  // fire for the same "everyone's ready now" moment and any can win.
  async function maybeArmCountdown(code: string): Promise<void> {
    if (countdownTimers.has(code)) return;
    const gate = await fetchStartGateState(code);
    if (!gate || gate.status !== 'ASSIGNING') return;
    if (gate.legs.length === 0 || !gate.legs.every((l) => l.assignedToId && l.scramble)) return;
    if (gate.participants.length === 0) return;
    if (!gate.participants.every((p) => p.isReady && p.isStartReady)) return;
    // Re-checked after the await, then the slot is claimed synchronously
    // below — no await sits between this check and the countdownTimers.set,
    // so two concurrent calls can't both get past it. Without that, the
    // second would overwrite the first's timer (leaking it, so the room
    // starts twice) and announce a later instant than the one clients had
    // already started counting down to.
    if (countdownTimers.has(code)) return;

    const startAt = new Date(Date.now() + COUNTDOWN_MS);
    countdownTimers.set(
      code,
      setTimeout(() => {
        fireCountdown(code, startAt).catch((e) =>
          console.error('[relaySocket] countdown failed to start relay:', e instanceof Error ? e.message : e),
        );
      }, COUNTDOWN_MS),
    );
    await prisma.relayRoom.update({ where: { id: gate.id }, data: { countdownStartAt: startAt } });
    io.to(roomName(code)).emit('relay_countdown', { startAt: startAt.toISOString() });
    await emitRelayRoomState(code);
  }

  async function fireCountdown(code: string, startAt: Date): Promise<void> {
    countdownTimers.delete(code);
    const gate = await fetchStartGateState(code);
    // Re-validated rather than assumed: three seconds is plenty of time for
    // someone to drop out, and losing a participant mid-ASSIGNING resets
    // everyone's ready state (see leaveRoomCleanup).
    const stillValid =
      !!gate &&
      gate.status === 'ASSIGNING' &&
      gate.legs.length > 0 &&
      gate.legs.every((l) => l.assignedToId && l.scramble) &&
      gate.participants.length > 0 &&
      gate.participants.every((p) => p.isReady && p.isStartReady);
    if (!stillValid) {
      await cancelCountdown(code);
      return;
    }
    // startedAt is the instant that was *announced*, not whenever this
    // callback happened to run — every client already started its clock at
    // the announced instant, so using the callback's own time would put the
    // server's recorded total permanently out of step with what the whole
    // team watched on screen.
    await prisma.relayRoom.update({
      where: { id: gate.id },
      data: { status: 'ACTIVE', startedAt: startAt, countdownStartAt: null },
    });
    io.to(roomName(code)).emit('relay_started', { startedAt: startAt.toISOString() });
    await emitRelayRoomState(code);
  }

  // Removes a participant from their room. During ACTIVE, the row is
  // deliberately left in place instead of deleted — deleting it would let
  // "everyone has marked done" become vacuously true without them ever
  // finishing their assigned legs. A relay missing a participant mid-run
  // simply can't complete until they reconnect (a documented, accepted
  // simplification — Battle's DNF-and-move-on escape hatch doesn't apply
  // here since a relay's legs aren't interchangeable between participants).
  async function leaveRoomCleanup(participantId: string, code: string): Promise<void> {
    const room = await fetchRoom(code);
    if (!room) return;
    if (room.status === 'ACTIVE') {
      participantSockets.get(code)?.delete(participantId);
      return;
    }
    await prisma.relayRoomLeg.updateMany({ where: { roomId: room.id, assignedToId: participantId }, data: { assignedToId: null } });
    await prisma.relayParticipant.deleteMany({ where: { id: participantId } });
    if (room.status === 'ASSIGNING') {
      await prisma.relayParticipant.updateMany({
        where: { roomId: room.id },
        data: { isReady: false, isStartReady: false },
      });
      // Losing a participant just invalidated the readiness this countdown
      // was armed on, and their legs went back to unassigned besides.
      await cancelCountdown(code);
    }
    if (room.hostParticipantId === participantId) {
      const remaining = room.participants
        .filter((p) => p.id !== participantId)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      await prisma.relayRoom.update({ where: { id: room.id }, data: { hostParticipantId: remaining[0]?.id ?? null } });
    }
    participantSockets.get(code)?.delete(participantId);
    await deleteRoomIfEmpty(code);
    await emitRelayRoomState(code);
  }

  io.on('connection', (socket) => {
    let myParticipantId: string | null = null;
    let myCode: string | null = null;
    let myName: string | null = null;

    const safe =
      <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
      (...args: A) => {
        fn(...args).catch((e) => {
          console.error('[relaySocket] handler error:', e instanceof Error ? e.message : e);
          socket.emit('error_msg', { message: 'A server error occurred' });
        });
      };

    socket.on(
      'join_relay_room',
      safe(async (raw) => {
        const parsed = joinSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit('error_msg', { message: 'Invalid request' });
          return;
        }
        // Checked before anything else, and refused rather than tolerated.
        // A stale bundle that gets into the room is precisely what breaks
        // it: this participant counts towards every "has everyone…?" gate
        // while being unable to satisfy the ones its build doesn't know
        // about, so the room stalls for everybody with nothing on screen to
        // explain why. Better to keep them out and tell them to reload.
        if (parsed.data.protocolVersion !== RELAY_PROTOCOL_VERSION) {
          socket.emit('relay_outdated_client', { serverVersion: RELAY_PROTOCOL_VERSION });
          return;
        }
        const { name, password } = parsed.data;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room) {
          socket.emit('error_msg', { message: 'Room not found' });
          return;
        }

        if (room.password) {
          const attempts = failedPasswordAttempts.get(socket.id) ?? 0;
          if (attempts >= MAX_PASSWORD_ATTEMPTS) {
            socket.emit('error_msg', { message: 'Too many incorrect password attempts' });
            return;
          }
          if (!password) {
            socket.emit('error_msg', { message: 'This room requires a password' });
            return;
          }
          const valid = await bcrypt.compare(password, room.password);
          if (!valid) {
            failedPasswordAttempts.set(socket.id, attempts + 1);
            socket.emit('error_msg', { message: 'Incorrect password' });
            return;
          }
        }

        const safeUserId: string | null = socket.data.userId ?? null;
        const existing = room.participants.find(
          (p) => (safeUserId && p.userId === safeUserId) || (!safeUserId && !p.userId && p.guestName === name),
        );
        if (existing) {
          const pending = pendingCleanup.get(existing.id);
          if (pending) {
            clearTimeout(pending);
            pendingCleanup.delete(existing.id);
          }
        }
        if (!existing && room.participants.length >= MAX_PARTICIPANTS) {
          socket.emit('error_msg', { message: 'Room is full' });
          return;
        }

        // Single-room enforcement (relay-scoped only — independent of Battle's own).
        if (myParticipantId && myCode && myCode !== code) {
          await leaveRoomCleanup(myParticipantId, myCode);
          socket.leave(roomName(myCode));
          myParticipantId = null;
          myCode = null;
        }
        if (safeUserId && !existing) {
          const elsewhere = await prisma.relayParticipant.findMany({
            where: { userId: safeUserId, room: { code: { not: code } } },
            include: { room: { select: { code: true } } },
          });
          for (const p of elsewhere) {
            const pending = pendingCleanup.get(p.id);
            if (pending) {
              clearTimeout(pending);
              pendingCleanup.delete(p.id);
            }
            await leaveRoomCleanup(p.id, p.room.code);
          }
        }

        let participant = existing;
        if (!participant) {
          participant = await prisma.relayParticipant.create({ data: { roomId: room.id, userId: safeUserId, guestName: name } });
          if (!room.hostParticipantId) {
            await prisma.relayRoom.update({ where: { id: room.id }, data: { hostParticipantId: participant.id } });
          }
        }
        myParticipantId = participant.id;
        myCode = code;
        myName = participant.guestName ?? 'Player';
        socket.join(roomName(code));

        let sockets = participantSockets.get(code);
        if (!sockets) {
          sockets = new Map();
          participantSockets.set(code, sockets);
        }
        sockets.set(myParticipantId, socket.id);

        await emitRelayRoomState(code);
      }),
    );

    socket.on(
      'leave_relay_room',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        await leaveRoomCleanup(myParticipantId, code);
        socket.leave(roomName(code));
        myParticipantId = null;
        myCode = null;
      }),
    );

    socket.on(
      'relay_start_room',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room) {
          socket.emit('error_msg', { message: 'Room not found' });
          return;
        }
        if (room.hostParticipantId !== myParticipantId) {
          socket.emit('error_msg', { message: 'Only the host can start the relay' });
          return;
        }
        if (room.status !== 'LOBBY') return;
        await prisma.relayRoom.update({ where: { id: room.id }, data: { status: 'ASSIGNING' } });
        await emitRelayRoomState(code);
      }),
    );

    socket.on(
      'relay_assign_event',
      safe(async (raw) => {
        const parsed = assignEventSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room || room.status !== 'ASSIGNING') return;
        const leg = room.legs.find((l) => l.id === parsed.data.legId);
        if (!leg) return;
        const targetId = parsed.data.participantId;
        if (targetId && !room.participants.some((p) => p.id === targetId)) return;
        await prisma.relayRoomLeg.update({ where: { id: leg.id }, data: { assignedToId: targetId } });
        // Any assignment change sends everyone back to square one — both
        // the distribution approval and the ready-to-solve confirmation,
        // since the legs someone confirmed against just changed — and calls
        // off a countdown armed on the old assignment.
        await prisma.relayParticipant.updateMany({
          where: { roomId: room.id },
          data: { isReady: false, isStartReady: false },
        });
        await cancelCountdown(code);
        await emitRelayRoomState(code);
      }),
    );

    socket.on(
      'relay_toggle_ready',
      safe(async (raw) => {
        const parsed = toggleReadySchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room || room.status !== 'ASSIGNING') return;
        await prisma.relayParticipant.update({ where: { id: myParticipantId }, data: { isReady: parsed.data.isReady } });
        // Broadcast the ready-state change immediately. Scramble generation
        // (below) can legitimately take several seconds for some events
        // (cold WASM workers — see scramble.ts) — awaiting it before this
        // broadcast was the actual cause of "pressing ready feels laggy":
        // the ready badge and the scrambles were both stuck behind the same
        // await, even though nothing about showing "ready" depends on
        // scrambles existing yet. Further broadcasts follow as legs land
        // (onProgress, passed through to each retry round — see
        // generateScramblesIfReady) and once more when it settles either
        // way, so the client's "Generating scrambles…" screen sees legs
        // fill in as they succeed instead of only updating at the very end.
        await emitRelayRoomState(code);
        // Withdrawing approval takes the whole team off the start screen, so
        // nobody's "ready to solve" confirmation still means anything —
        // clear them all rather than let a stale one survive and make the
        // room start the moment approval comes back.
        if (!parsed.data.isReady) {
          await prisma.relayParticipant.updateMany({ where: { roomId: room.id }, data: { isStartReady: false } });
          await cancelCountdown(code);
          await emitRelayRoomState(code);
          return;
        }
        // Approving the distribution does NOT start anything, even when it
        // completes the set of approvals — that's relay_toggle_start_ready's
        // job. All this does is get the scrambles generated so the start
        // screen has something to show while everyone finds a cube.
        //
        // maybeArmCountdown still runs when generation settles, because the
        // last scramble landing can genuinely be the final missing piece if
        // everyone had already confirmed they were ready to solve. It
        // re-checks every condition itself, so it simply declines until
        // that's actually true.
        generateScramblesIfReady(code, () => emitRelayRoomState(code))
          .then(async () => {
            await emitRelayRoomState(code);
            await maybeArmCountdown(code);
          })
          .catch((e) => console.error('[relaySocket] scramble generation failed:', e instanceof Error ? e.message : e));
      }),
    );

    socket.on(
      'relay_toggle_start_ready',
      safe(async (raw) => {
        const parsed = toggleReadySchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room || room.status !== 'ASSIGNING') return;
        // Only meaningful once the distribution is settled — otherwise this
        // is a confirmation against legs that could still be dragged around.
        if (!room.participants.every((p) => p.isReady)) return;
        await prisma.relayParticipant.update({
          where: { id: myParticipantId },
          data: { isStartReady: parsed.data.isReady },
        });
        await emitRelayRoomState(code);
        // Un-confirming is the escape hatch out of an armed countdown — it's
        // what the old design's "let go of spacebar" was for.
        if (!parsed.data.isReady) {
          await cancelCountdown(code);
          return;
        }
        await maybeArmCountdown(code);
      }),
    );

    // Deliberately synchronous and DB-free: this measures the gap between
    // the two clocks, so anything awaited between receiving the probe and
    // reading Date.now() would be measured as clock difference and skew
    // every client's elapsed time by however long it took.
    socket.on('relay_time_sync', (raw) => {
      const parsed = timeSyncSchema.safeParse(raw);
      if (!parsed.success) return;
      socket.emit('relay_time_sync_result', { clientSentAt: parsed.data.clientSentAt, serverNow: Date.now() });
    });

    socket.on(
      'relay_mark_done',
      safe(async (raw) => {
        const parsed = markDoneSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const arrivedAt = Date.now();
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        if (!room || room.status !== 'ACTIVE') return;
        await prisma.relayParticipant.update({ where: { id: myParticipantId }, data: { isDone: true } });

        const fresh = await fetchRoom(code);
        if (!fresh) return;
        const allDone = fresh.participants.every((p) => p.isDone);
        if (!allDone) {
          await emitRelayRoomState(code);
          return;
        }

        // Prefer the presser's own clock-corrected stop instant over "when
        // this message reached the server", so the recorded total is the
        // number that was actually on their screen — a relay time shouldn't
        // include the trip to a server. Clamped, never trusted: no earlier
        // than the start, and no more than MAX_STOP_CORRECTION_MS before
        // this message genuinely arrived, so the correction can only ever
        // be latency-sized.
        const startedMs = fresh.startedAt!.getTime();
        const reportedAt = parsed.data.at;
        const stoppedMs =
          reportedAt === undefined
            ? arrivedAt
            : Math.min(arrivedAt, Math.max(reportedAt, startedMs, arrivedAt - MAX_STOP_CORRECTION_MS));
        const finishedAt = new Date(stoppedMs);
        const totalTimeMs = stoppedMs - startedMs;
        await prisma.relayRoom.update({ where: { id: fresh.id }, data: { status: 'FINISHED', finishedAt } });

        // The "everyone's done, clock stopped" signal every participant is
        // actively waiting on — sent immediately. Personal attempt-history
        // records (below) are saved in the background: nobody's watching
        // for those to appear, so sequentially writing one (or more, with
        // logged-in participants) database row per person before this
        // broadcast was the actual cause of "the clock doesn't stop right
        // away" — the stop signal was stuck behind writes nobody was even
        // looking at yet.
        io.to(roomName(code)).emit('relay_completed', {
          totalTimeMs,
          legs: fresh.legs.map((l) => ({ eventId: l.eventId, order: l.order, assignedToId: l.assignedToId, splitMs: l.splitMs })),
        });
        await emitRelayRoomState(code);

        (async () => {
          const relayName = await resolveRelayName(fresh);
          for (const p of fresh.participants) {
            if (!p.userId) continue;
            const myLegs = fresh.legs.filter((l) => l.assignedToId === p.id).sort((a, b) => a.order - b.order);
            if (myLegs.length === 0) continue;
            await prisma.relayAttempt.create({
              data: {
                userId: p.userId,
                relayName,
                totalTimeMs,
                legs: {
                  create: myLegs.map((l) => ({ eventId: l.eventId, order: l.order, scramble: l.scramble, splitMs: l.splitMs })),
                },
              },
            });
          }
        })().catch((e) => console.error('[relaySocket] failed to record relay attempts:', e instanceof Error ? e.message : e));
        // Deliberately not clearing participantSockets here (as an earlier
        // version did) — "Run it again" can take this same room straight
        // back into another ACTIVE phase without anyone reconnecting, and
        // that per-participant socket map is what makes the personalized
        // (own-scramble-only) emits in emitRelayRoomState possible.
      }),
    );

    // Shared by relay_adjust_distribution/relay_run_again: both take a
    // FINISHED room back to ASSIGNING with the same leg assignments, just
    // differing in whether ready state carries over. `keepReady=true` is
    // "run it again" (nothing changed, so it goes straight into a fresh
    // countdown as soon as the new scrambles land); `keepReady=false` is
    // "adjust distribution" (assignments might change, so everyone has to
    // re-confirm).
    async function restartAssigning(code: string, participantId: string, keepReady: boolean): Promise<void> {
      const room = await fetchRoom(code);
      if (!room) return;
      if (room.hostParticipantId !== participantId) {
        io.to(participantSockets.get(code)?.get(participantId) ?? '').emit('error_msg', { message: 'Only the host can do that' });
        return;
      }
      if (room.status !== 'FINISHED') return;
      await prisma.$transaction([
        prisma.relayRoom.update({
          where: { id: room.id },
          data: { status: 'ASSIGNING', startedAt: null, finishedAt: null, countdownStartAt: null },
        }),
        // isStartReady is always cleared, even for "run it again" where the
        // distribution approval carries over: a new round means new
        // scrambles, so everyone confirms they're ready to solve again
        // rather than being counted down the instant the legs regenerate.
        prisma.relayParticipant.updateMany({
          where: { roomId: room.id },
          data: { isReady: keepReady, isStartReady: false, isDone: false },
        }),
        // Blanking the previous attempt's scrambles is what makes
        // "everyone is ready" mean "ready to start *this* round". With
        // them left in place, "run it again" lands every participant
        // already-ready against legs that still look fully scrambled, so
        // maybeArmCountdown would happily start a countdown — and the
        // relay — against the round they just finished, with the fresh
        // scrambles swapping in underneath them mid-solve.
        prisma.relayRoomLeg.updateMany({ where: { roomId: room.id }, data: { scramble: '' } }),
      ]);
      clearCountdownTimer(code);
      await emitRelayRoomState(code);
      // "Run it again" (keepReady) lands everyone back on the start screen
      // without going through relay_toggle_ready, so it has to kick off
      // scramble generation itself. A no-op for "adjust distribution"
      // (keepReady=false leaves the room unapproved). Not awaited, same
      // reasoning as relay_toggle_ready: generation can take several seconds
      // and nothing about landing on the ASSIGNING screen depends on
      // scrambles already existing. force=true is belt-and-braces now that
      // the transaction above blanks every leg (which by itself already
      // defeats the "everything already has a scramble" early return). The
      // countdown call below declines either way until everyone has
      // confirmed they're ready to solve this round.
      generateScramblesIfReady(code, () => emitRelayRoomState(code), true)
        .then(async () => {
          await emitRelayRoomState(code);
          await maybeArmCountdown(code);
        })
        .catch((e) => console.error('[relaySocket] scramble generation failed:', e instanceof Error ? e.message : e));
    }

    socket.on(
      'relay_adjust_distribution',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        await restartAssigning(parsed.data.code.toUpperCase(), myParticipantId, false);
      }),
    );

    socket.on(
      'relay_run_again',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        await restartAssigning(parsed.data.code.toUpperCase(), myParticipantId, true);
      }),
    );

    socket.on(
      'send_chat_message',
      safe(async (raw) => {
        const parsed = sendChatSchema.safeParse(raw);
        if (!parsed.success) return;
        if (!myParticipantId || !myCode || !myName) return;
        const code = parsed.data.code.toUpperCase();
        if (code !== myCode) return; // only to the relay room this socket is actually in

        const now = Date.now();
        const recent = (chatTimestamps.get(socket.id) ?? []).filter((t) => now - t < CHAT_RATE_WINDOW_MS);
        if (recent.length >= CHAT_RATE_LIMIT) {
          socket.emit('error_msg', { message: 'Slow down — too many messages' });
          return;
        }
        recent.push(now);
        chatTimestamps.set(socket.id, recent);

        const message = parsed.data.message.trim();
        if (!message) return;

        io.to(roomName(code)).emit('chat_message', {
          participantId: myParticipantId,
          name: myName,
          message: censorMessage(message),
          sentAt: new Date().toISOString(),
        });
      }),
    );

    socket.on('disconnect', () => {
      failedPasswordAttempts.delete(socket.id);
      chatTimestamps.delete(socket.id);
      if (!myParticipantId || !myCode) return;
      const participantId = myParticipantId;
      const code = myCode;
      const timer = setTimeout(() => {
        pendingCleanup.delete(participantId);
        leaveRoomCleanup(participantId, code).catch(() => {
          /* room may be gone */
        });
      }, RECONNECT_GRACE_MS);
      pendingCleanup.set(participantId, timer);
    });
  });
}
