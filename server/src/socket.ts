import { Server as IOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { getScramble } from './scramble.js';
import {
  effectiveTime,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type BattleRoomDTO,
  type BattleRoundResultEntry,
} from '@scc/shared';

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

export function attachSocket(server: HttpServer): IOServer {
  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  async function emitRoomState(code: string) {
    const dto = await buildRoomDTO(code);
    if (dto) io.to(code).emit('room_state', dto);
  }

  async function startRound(roomId: string, code: string, eventId: string, currentRoundNumber: number) {
    const scramble = await getScramble(eventId);
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
          await startRound(fresh.id, code, fresh.eventId, fresh.roundNumber);
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
    if (room?.status === 'ACTIVE') {
      await checkRoundCompletion(code);
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
      safe(async ({ code, userId, name, password }) => {
        code = code.toUpperCase();
        const room = await prisma.battleRoom.findUnique({
          where: { code },
          include: { participants: true },
        });
        if (!room) {
          socket.emit('error_msg', { message: 'Room not found' });
          return;
        }

        if (room.password) {
          if (!password) {
            socket.emit('error_msg', { message: 'This room requires a password' });
            return;
          }
          const valid = await bcrypt.compare(password, room.password);
          if (!valid) {
            socket.emit('error_msg', { message: 'Incorrect password' });
            return;
          }
        }

        let safeUserId: string | null = null;
        if (userId) {
          const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
          safeUserId = exists ? userId : null;
        }

        const existing = safeUserId ? room.participants.find((p) => p.userId === safeUserId) : undefined;
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
            await leaveRoomCleanup(p.id, p.room.code);
          }
        }
        // ─────────────────────────────────────────────────────────────────

        let participant = existing;
        if (!participant) {
          participant = await prisma.battleParticipant.create({
            data: { roomId: room.id, userId: safeUserId, guestName: name },
          });
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
          await startRound(room.id, code, room.eventId, afterJoin.roundNumber);
        } else {
          await emitRoomState(code);
        }
      }),
    );

    socket.on(
      'solve_complete',
      safe(async ({ code, time, penalty }) => {
        code = code.toUpperCase();
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
      safe(async ({ code }) => {
        code = code.toUpperCase();
        if (!myParticipantId) return;
        await leaveRoomCleanup(myParticipantId, code);
        socket.leave(code);
        myParticipantId = null;
        myCode = null;
      }),
    );

    socket.on('disconnect', async () => {
      if (!myParticipantId || !myCode) return;
      try {
        await leaveRoomCleanup(myParticipantId, myCode);
      } catch {
        /* room may be gone */
      }
    });
  });

  return io;
}
