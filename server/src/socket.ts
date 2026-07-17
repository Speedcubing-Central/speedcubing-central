import { Server as IOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { getRoundScramble } from './scramble.js';
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
  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
  });

  // participantId -> the timer that will actually remove them once the
  // reconnect grace period elapses. join_room cancels this when the same
  // participant (by userId, or by name for guests) rejoins in time.
  const pendingCleanup = new Map<string, ReturnType<typeof setTimeout>>();

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

    socket.on('disconnect', () => {
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
