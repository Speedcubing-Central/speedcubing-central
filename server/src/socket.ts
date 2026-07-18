import { Server as IOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { DefaultEventsMap } from 'socket.io';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { getRoundScramble } from './scramble.js';
import { verifyAccessToken } from './auth/jwt.js';
import {
  effectiveTime,
  EVENT_IDS,
  ALG_SET_IDS,
  getAlgSet,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type BattleRoomDTO,
  type BattleRoundResultEntry,
} from '@scc/shared';

interface SocketData {
  // Set from the verified access_token cookie at handshake time (see the
  // io.use() middleware below) — never from client-supplied event payloads.
  // Undefined means "not logged in" (a guest), which is a legitimate,
  // allowed state, not an auth failure.
  userId?: string;
}

// Tiny manual parse instead of pulling in a cookie-parsing dependency just
// for this one read — Socket.io's handshake only exposes the raw header.
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

const POINTS_BY_RANK = [5, 3, 2];
const POINTS_DEFAULT = 1;

function rankPoints(rank: number): number {
  return POINTS_BY_RANK[rank - 1] ?? POINTS_DEFAULT;
}

async function buildRoomDTO(code: string): Promise<BattleRoomDTO | null> {
  const room = await prisma.battleRoom.findUnique({
    where: { code },
    include: { participants: { orderBy: { id: 'asc' } } },
  });
  if (!room) return null;
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    eventId: room.eventId,
    algSetId: room.algSetId,
    isPublic: room.isPublic,
    scramble: room.scramble,
    roundNumber: room.roundNumber,
    status: room.status,
    participants: room.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.guestName ?? 'Player',
      points: p.points,
      time: p.time,
      penalty: p.penalty,
      finishedAt: p.finishedAt?.toISOString() ?? null,
      isHost: p.id === room.hostParticipantId,
    })),
  };
}

async function deleteRoomIfEmpty(code: string): Promise<void> {
  const room = await prisma.battleRoom.findUnique({
    where: { code },
    include: { participants: { select: { id: true } } },
  });
  if (room && room.participants.length === 0) {
    await prisma.battleRoom.delete({ where: { id: room.id } });
  }
}

// How long a disconnected participant's row is kept around before it's
// actually cleaned up (see leaveRoomCleanup / the disconnect handler below)
// — long enough for a reconnect to resume the same participant (and its
// accumulated points) instead of starting over at 0, per a live report of
// exactly that happening.
const RECONNECT_GRACE_MS = 30_000;

// pingTimeout/pingInterval default to 20s/25s in socket.io. The most common
// cause of an "I keep getting disconnected" report for a page like this one
// isn't network loss — it's the browser throttling JS timers in a
// backgrounded tab (switching tabs, minimizing, a phone screen lock), which
// can delay the client's pong past a 20s window even though the connection
// itself is fine. Raising both gives a backgrounded tab much more slack to
// respond before the server gives up on it, without materially delaying
// detection of a *real* drop (nobody's waiting on a 90s timer to notice
// their opponent is gone — round completion and the reconnect grace period
// above are what actually gate the experience).
const PING_INTERVAL_MS = 25_000;
const PING_TIMEOUT_MS = 90_000;

export function attachSocket(server: HttpServer): IOServer {
  const io = new IOServer<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(server, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
  });

  // Derives identity from the same httpOnly access_token cookie requireAuth
  // verifies for REST requests — never trust a client-supplied userId in an
  // event payload (that was the original bug this closes: anyone could claim
  // to be any user id and get treated as them). Cookies already flow on this
  // same-origin connection with no client-side change needed (dev via the
  // Vite proxy, prod via the single server). An invalid/missing/expired
  // token just means "not logged in" — guests must still be allowed to
  // connect and join rooms, so this never blocks the handshake.
  io.use((socket, next) => {
    const token = readCookie(socket.request.headers.cookie, 'access_token');
    if (token) {
      try {
        socket.data.userId = verifyAccessToken(token).sub;
      } catch {
        /* invalid/expired token — treat as guest */
      }
    }
    next();
  });

  // participantId -> the timer that will actually remove them once the
  // reconnect grace period elapses. join_room cancels this when the same
  // participant (by userId, or by name for guests) rejoins in time.
  const pendingCleanup = new Map<string, ReturnType<typeof setTimeout>>();

  // socket.id -> number of incorrect room-password attempts this connection
  // has made, so a raw socket client can't brute-force a private room's
  // password by just retrying join_room. Cleared on disconnect.
  const failedPasswordAttempts = new Map<string, number>();
  const MAX_PASSWORD_ATTEMPTS = 5;

  const joinRoomSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(40),
    password: z.string().max(64).optional(),
  });
  const solveCompleteSchema = z.object({
    code: z.string().min(1).max(20),
    time: z.number().int().nonnegative().max(24 * 60 * 60 * 1000),
    penalty: z.enum(['NONE', 'PLUS2', 'DNF']),
  });
  const leaveRoomSchema = z.object({ code: z.string().min(1).max(20) });
  const changeEventSchema = z.object({
    code: z.string().min(1).max(20),
    eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event'),
    algSetId: z.string().refine((id) => ALG_SET_IDS.includes(id), 'Invalid algorithm set').optional(),
  });

  async function emitRoomState(code: string) {
    const dto = await buildRoomDTO(code);
    if (dto) io.to(code).emit('room_state', dto);
  }

  async function startRound(roomId: string, code: string, eventId: string, algSetId: string | null, currentRoundNumber: number) {
    const scramble = await getRoundScramble(eventId, algSetId);
    const roundNumber = currentRoundNumber + 1;
    await prisma.battleRoom.update({
      where: { id: roomId },
      data: { status: 'ACTIVE', scramble, roundNumber },
    });
    io.to(code).emit('round_start', { scramble, roundNumber });
    await emitRoomState(code);
  }

  async function checkRoundCompletion(code: string): Promise<void> {
    const room = await prisma.battleRoom.findUnique({
      where: { code },
      include: { participants: { orderBy: { id: 'asc' } } },
    });
    if (!room || room.status !== 'ACTIVE') return;

    const participants = room.participants;
    if (participants.length < 2) return;
    if (!participants.every((p) => p.finishedAt !== null)) return;

    const ranked = [...participants].sort(
      (a, b) =>
        effectiveTime(a.time ?? Infinity, a.penalty ?? 'NONE') -
        effectiveTime(b.time ?? Infinity, b.penalty ?? 'NONE'),
    );

    const results: BattleRoundResultEntry[] = [];
    for (let i = 0; i < ranked.length; i++) {
      const p = ranked[i];
      const et = effectiveTime(p.time ?? Infinity, p.penalty ?? 'NONE');
      const isDNF = !isFinite(et);
      const pointsEarned = isDNF ? 0 : rankPoints(i + 1);

      await prisma.battleParticipant.update({
        where: { id: p.id },
        data: { points: { increment: pointsEarned } },
      });

      results.push({
        participantId: p.id,
        name: p.guestName ?? 'Player',
        time: p.time,
        penalty: p.penalty,
        rank: i + 1,
        pointsEarned,
        totalPoints: p.points + pointsEarned,
      });
    }

    await prisma.battleParticipant.updateMany({
      where: { roomId: room.id },
      data: { time: null, penalty: null, finishedAt: null },
    });
    await prisma.battleRoom.update({
      where: { id: room.id },
      data: { status: 'WAITING' },
    });

    io.to(code).emit('round_result', { results, roundNumber: room.roundNumber });

    // Auto-start next round after 5 seconds if ≥2 players remain.
    setTimeout(() => {
      void (async () => {
        try {
          const fresh = await prisma.battleRoom.findUnique({
            where: { code },
            include: { participants: { select: { id: true } } },
          });
          if (!fresh || fresh.participants.length < 2) return;
          await startRound(fresh.id, code, fresh.eventId, fresh.algSetId, fresh.roundNumber);
        } catch {
          /* room may be gone */
        }
      })();
    }, 5000);
  }

  // Remove a participant from their room, handling in-progress round cleanup.
  // Used by leave_room, disconnect, and the single-room enforcement in join_room.
  async function leaveRoomCleanup(participantId: string, code: string): Promise<void> {
    const room = await prisma.battleRoom.findUnique({
      where: { code },
      include: { participants: true },
    });
    if (room?.status === 'ACTIVE') {
      const me = room.participants.find((p) => p.id === participantId);
      if (me && !me.finishedAt) {
        await prisma.battleParticipant.update({
          where: { id: participantId },
          data: { finishedAt: new Date(), penalty: 'DNF', time: null },
        });
      }
    }
    await prisma.battleParticipant.deleteMany({ where: { id: participantId } });
    // If the host just left, hand the room to whoever's been in it longest
    // among the remaining participants — ids are cuids, which are
    // time-ordered, so ascending id is "who joined earliest" (same
    // assumption buildRoomDTO/checkRoundCompletion already sort by).
    if (room && room.hostParticipantId === participantId) {
      const remaining = room.participants
        .filter((p) => p.id !== participantId)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      await prisma.battleRoom.update({
        where: { id: room.id },
        data: { hostParticipantId: remaining[0]?.id ?? null },
      });
    }
    if (room?.status === 'ACTIVE') {
      // A round can never complete with fewer than 2 players — left as-is,
      // checkRoundCompletion's own `< 2` guard would just bail every time
      // without ever resetting status, leaving the room stuck ACTIVE forever
      // (no new round auto-starts, and the remaining player's timer would
      // stay live against a round that can't finish). Reset to WAITING and
      // clear whatever in-round submission state is left over instead, so a
      // fresh round starts cleanly once someone else joins.
      if (room.participants.length - 1 < 2) {
        await prisma.battleRoom.update({ where: { id: room.id }, data: { status: 'WAITING' } });
        await prisma.battleParticipant.updateMany({
          where: { roomId: room.id },
          data: { time: null, penalty: null, finishedAt: null },
        });
      } else {
        await checkRoundCompletion(code);
      }
    }
    await deleteRoomIfEmpty(code);
    await emitRoomState(code);
  }

  io.on('connection', (socket) => {
    let myParticipantId: string | null = null;
    let myCode: string | null = null;

    const safe =
      <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
      (...args: A) => {
        fn(...args).catch((e) => {
          console.error('[socket] handler error:', e instanceof Error ? e.message : e);
          socket.emit('error_msg', { message: 'A server error occurred' });
        });
      };

    socket.on(
      'join_room',
      safe(async (raw) => {
        const parsed = joinRoomSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit('error_msg', { message: 'Invalid request' });
          return;
        }
        const { name, password } = parsed.data;
        const code = parsed.data.code.toUpperCase();
        const room = await prisma.battleRoom.findUnique({
          where: { code },
          include: { participants: true },
        });
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

        // Identity comes only from the verified access_token cookie (see the
        // io.use() middleware above) — never from the client payload.
        const safeUserId: string | null = socket.data.userId ?? null;

        // Matches this join against an already-present participant so a
        // reconnect (see the client's join-on-reconnect fix in
        // BattleRoom.tsx) reuses the same row — and its accumulated points
        // — instead of starting a new one at 0. Reliable for logged-in
        // users (matched by userId) for as long as their old row still
        // exists, which is now RECONNECT_GRACE_MS after their previous
        // socket dropped (see the disconnect handler below), not just the
        // instant before that — a live report of a reconnect resetting
        // their score to 0 was this exact gap: the old row was deleted
        // *immediately* on disconnect, before a same-second reconnect (see
        // the disconnect handler below) could have ever caught it. Guests
        // are matched best-effort by name (no stable identity otherwise),
        // which two guests could share — a false match is still strictly
        // better than always creating a new row and leaving the old,
        // now-abandoned one sitting unfinished, which blocks round
        // completion for the whole room, not just the reconnecting player.
        const existing = room.participants.find((p) =>
          (safeUserId && p.userId === safeUserId) || (!safeUserId && !p.userId && p.guestName === name),
        );
        if (existing) {
          const pending = pendingCleanup.get(existing.id);
          if (pending) {
            clearTimeout(pending);
            pendingCleanup.delete(existing.id);
          }
        }
        if (!existing && room.participants.length >= 10) {
          socket.emit('error_msg', { message: 'Room is full (max 10 players)' });
          return;
        }

        // ── Single-room enforcement ───────────────────────────────────────
        // If this socket is already in a different room, leave it first.
        if (myParticipantId && myCode && myCode !== code) {
          await leaveRoomCleanup(myParticipantId, myCode);
          socket.leave(myCode);
          myParticipantId = null;
          myCode = null;
        }

        // If this logged-in user has participant records elsewhere (second tab),
        // remove them so they can only be in one room at a time.
        if (safeUserId && !existing) {
          const elsewhere = await prisma.battleParticipant.findMany({
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
        // ─────────────────────────────────────────────────────────────────

        let participant = existing;
        if (!participant) {
          participant = await prisma.battleParticipant.create({
            data: { roomId: room.id, userId: safeUserId, guestName: name },
          });
          // The very first participant a room ever gets becomes its host.
          // room.hostParticipantId is only null before that first join — it's
          // kept populated afterward by leaveRoomCleanup's reassignment below,
          // so this never re-fires for a room that's already had a host.
          if (!room.hostParticipantId) {
            await prisma.battleRoom.update({ where: { id: room.id }, data: { hostParticipantId: participant.id } });
          }
        }
        myParticipantId = participant.id;
        myCode = code;
        socket.join(code);

        // Auto-start round when this join brings us to ≥2 players.
        const afterJoin = await prisma.battleRoom.findUnique({
          where: { code },
          include: { participants: { select: { id: true } } },
        });
        if (afterJoin && afterJoin.status === 'WAITING' && afterJoin.participants.length >= 2) {
          await startRound(room.id, code, room.eventId, room.algSetId, afterJoin.roundNumber);
        } else {
          await emitRoomState(code);
        }
      }),
    );

    socket.on(
      'solve_complete',
      safe(async (raw) => {
        const parsed = solveCompleteSchema.safeParse(raw);
        if (!parsed.success) return;
        const { time, penalty } = parsed.data;
        const code = parsed.data.code.toUpperCase();
        if (!myParticipantId) return;
        const room = await prisma.battleRoom.findUnique({
          where: { code },
          include: { participants: true },
        });
        if (!room || room.status !== 'ACTIVE') return;

        const me = room.participants.find((p) => p.id === myParticipantId);
        if (!me || me.finishedAt) return;

        await prisma.battleParticipant.update({
          where: { id: myParticipantId },
          data: { time, penalty, finishedAt: new Date() },
        });

        socket.to(code).emit('participant_finished', {
          participantId: myParticipantId,
          name: me.guestName ?? 'Player',
          time,
          penalty,
        });

        await checkRoundCompletion(code);
        await emitRoomState(code);
      }),
    );

    socket.on(
      'leave_room',
      safe(async (raw) => {
        const parsed = leaveRoomSchema.safeParse(raw);
        if (!parsed.success) return;
        const code = parsed.data.code.toUpperCase();
        if (!myParticipantId) return;
        await leaveRoomCleanup(myParticipantId, code);
        socket.leave(code);
        myParticipantId = null;
        myCode = null;
      }),
    );

    socket.on(
      'change_event',
      safe(async (raw) => {
        const parsed = changeEventSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit('error_msg', { message: 'Invalid request' });
          return;
        }
        if (!myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await prisma.battleRoom.findUnique({
          where: { code },
          include: { participants: { select: { id: true } } },
        });
        if (!room) {
          socket.emit('error_msg', { message: 'Room not found' });
          return;
        }
        if (room.hostParticipantId !== myParticipantId) {
          socket.emit('error_msg', { message: 'Only the host can change the event' });
          return;
        }
        if (room.status === 'ACTIVE') {
          socket.emit('error_msg', { message: "Can't change the event mid-round" });
          return;
        }

        // Same server-side derivation battle.ts's room-creation route uses —
        // eventId is never trusted from the client when an alg set is chosen.
        const algSet = parsed.data.algSetId ? getAlgSet(parsed.data.algSetId) : undefined;
        const eventId = algSet ? algSet.puzzle : parsed.data.eventId;
        const algSetId = parsed.data.algSetId ?? null;

        // A new event means the old round history no longer makes sense —
        // reset the room to a fresh WAITING state and clear every
        // participant's points/round state along with it.
        await prisma.battleRoom.update({
          where: { id: room.id },
          data: { eventId, algSetId, roundNumber: 0, status: 'WAITING', scramble: '' },
        });
        await prisma.battleParticipant.updateMany({
          where: { roomId: room.id },
          data: { points: 0, time: null, penalty: null, finishedAt: null },
        });

        // Mirrors join_room's own auto-start: if ≥2 players are already
        // here, nothing else would ever kick off round 1 for the new event.
        if (room.participants.length >= 2) {
          await startRound(room.id, code, eventId, algSetId, 0);
        } else {
          await emitRoomState(code);
        }
      }),
    );

    socket.on('disconnect', () => {
      failedPasswordAttempts.delete(socket.id);
      if (!myParticipantId || !myCode) return;
      const participantId = myParticipantId;
      const code = myCode;
      // Defer the actual removal (see RECONNECT_GRACE_MS) instead of
      // cleaning up immediately, so a reconnect within the grace window
      // (join_room, above) finds this participant still here and resumes
      // it — same points, same identity — rather than starting over at 0.
      // Explicit leaves (leave_room) and the single-room-enforcement path
      // in join_room intentionally bypass this and clean up immediately;
      // this timer is specifically for "the connection dropped", not "the
      // player chose to leave".
      const timer = setTimeout(() => {
        pendingCleanup.delete(participantId);
        leaveRoomCleanup(participantId, code).catch(() => {
          /* room may be gone */
        });
      }, RECONNECT_GRACE_MS);
      pendingCleanup.set(participantId, timer);
    });
  });

  return io;
}
