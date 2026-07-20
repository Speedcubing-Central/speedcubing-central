import type { Server as IOServer, DefaultEventsMap } from 'socket.io';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { getScramble } from './scramble.js';
import { censorMessage } from './profanity.js';
import type { SocketData } from './socket.js';
import {
  getRelayPreset,
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

async function resolveRelayName(room: { presetId: string | null; customRelayId: string | null }): Promise<string> {
  if (room.presetId) return getRelayPreset(room.presetId)?.name ?? 'Relay';
  if (room.customRelayId) {
    const cr = await prisma.customRelay.findUnique({ where: { id: room.customRelayId } });
    return cr?.name ?? 'Custom Relay';
  }
  return 'Relay';
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
    startedAt: room.startedAt?.toISOString() ?? null,
    finishedAt: room.finishedAt?.toISOString() ?? null,
    participants: room.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.guestName ?? 'Player',
      isReady: p.isReady,
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
  }
}

const RECONNECT_GRACE_MS = 30_000;
const MAX_PASSWORD_ATTEMPTS = 5;
const CHAT_RATE_LIMIT = 5;
const CHAT_RATE_WINDOW_MS = 5000;
const MAX_PARTICIPANTS = 20;

export function registerRelayHandlers(io: RelayIO): void {
  const pendingCleanup = new Map<string, ReturnType<typeof setTimeout>>();
  const failedPasswordAttempts = new Map<string, number>();
  const chatTimestamps = new Map<string, number[]>();
  // code -> set of participantIds currently holding spacebar (hold-to-start phase).
  const holding = new Map<string, Set<string>>();
  // code -> (participantId -> socketId), so ACTIVE-phase state can be
  // personalized per participant (each only ever sees their own legs' scrambles).
  const participantSockets = new Map<string, Map<string, string>>();

  const joinSchema = z.object({ code: z.string().min(1).max(20), name: z.string().min(1).max(40), password: z.string().max(64).optional() });
  const codeSchema = z.object({ code: z.string().min(1).max(20) });
  const assignEventSchema = z.object({
    code: z.string().min(1).max(20),
    legId: z.string().min(1),
    participantId: z.string().min(1).nullable(),
  });
  const toggleReadySchema = z.object({ code: z.string().min(1).max(20), isReady: z.boolean() });
  const sendChatSchema = z.object({ code: z.string().min(1).max(20), message: z.string().min(1).max(500) });

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
      holding.get(code)?.delete(participantId);
      return;
    }
    await prisma.relayRoomLeg.updateMany({ where: { roomId: room.id, assignedToId: participantId }, data: { assignedToId: null } });
    await prisma.relayParticipant.deleteMany({ where: { id: participantId } });
    if (room.status === 'ASSIGNING') {
      await prisma.relayParticipant.updateMany({ where: { roomId: room.id }, data: { isReady: false } });
    }
    if (room.hostParticipantId === participantId) {
      const remaining = room.participants
        .filter((p) => p.id !== participantId)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      await prisma.relayRoom.update({ where: { id: room.id }, data: { hostParticipantId: remaining[0]?.id ?? null } });
    }
    participantSockets.get(code)?.delete(participantId);
    holding.get(code)?.delete(participantId);
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
        // Any assignment change requires everyone to re-confirm readiness.
        await prisma.relayParticipant.updateMany({ where: { roomId: room.id }, data: { isReady: false } });
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
        await emitRelayRoomState(code);
      }),
    );

    socket.on(
      'relay_press',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const room = await fetchRoom(code);
        // Only allowed once every leg is assigned and everyone has readied
        // up — validated server-side, never just trusted from the client.
        if (!room || room.status !== 'ASSIGNING') return;
        if (room.legs.some((l) => !l.assignedToId) || room.participants.some((p) => !p.isReady)) return;
        let set = holding.get(code);
        if (!set) {
          set = new Set();
          holding.set(code, set);
        }
        set.add(myParticipantId);
        io.to(roomName(code)).emit('relay_hold_state', { holding: [...set] });
      }),
    );

    socket.on(
      'relay_release',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
        const code = parsed.data.code.toUpperCase();
        const set = holding.get(code);
        if (!set || !set.has(myParticipantId)) return;
        const room = await fetchRoom(code);
        if (!room || room.status !== 'ASSIGNING') {
          set.delete(myParticipantId);
          return;
        }

        // The trigger is a release observed while every participant was
        // simultaneously holding — the first person to let go starts the
        // shared clock. A release before everyone was holding just drops
        // this participant out of the hold set (they must press again).
        const everyoneWasHolding = room.participants.length > 0 && room.participants.every((p) => set.has(p.id));
        set.delete(myParticipantId);

        if (!everyoneWasHolding) {
          io.to(roomName(code)).emit('relay_hold_state', { holding: [...set] });
          return;
        }

        holding.delete(code);
        // Scrambles are deliberately generated now (not at assignment time)
        // so a last-second reassignment can never leave a stale scramble
        // attached to the wrong assignee.
        const scrambles = await Promise.all(room.legs.map((l) => getScramble(l.eventId)));
        await prisma.$transaction([
          ...room.legs.map((l, i) => prisma.relayRoomLeg.update({ where: { id: l.id }, data: { scramble: scrambles[i] } })),
          prisma.relayRoom.update({ where: { id: room.id }, data: { status: 'ACTIVE', startedAt: new Date() } }),
        ]);
        const fresh = await fetchRoom(code);
        if (fresh?.startedAt) {
          io.to(roomName(code)).emit('relay_started', { startedAt: fresh.startedAt.toISOString() });
        }
        await emitRelayRoomState(code);
      }),
    );

    socket.on(
      'relay_mark_done',
      safe(async (raw) => {
        const parsed = codeSchema.safeParse(raw);
        if (!parsed.success || !myParticipantId) return;
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

        const finishedAt = new Date();
        const totalTimeMs = finishedAt.getTime() - fresh.startedAt!.getTime();
        await prisma.relayRoom.update({ where: { id: fresh.id }, data: { status: 'FINISHED', finishedAt } });

        // Give every logged-in participant their own attempt record (only
        // the legs they actually solved), all sharing the team's total time.
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

        io.to(roomName(code)).emit('relay_completed', {
          totalTimeMs,
          legs: fresh.legs.map((l) => ({ eventId: l.eventId, order: l.order, assignedToId: l.assignedToId, splitMs: l.splitMs })),
        });
        await emitRelayRoomState(code);
        participantSockets.delete(code);
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
