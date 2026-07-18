import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { optionalAuth } from '../auth/middleware.js';
import { getRoundScramble } from '../scramble.js';
import { EVENT_IDS, ALG_SET_IDS, getAlgSet } from '@scc/shared';

const router = Router();

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event').default('333'),
  algSetId: z.string().refine((id) => ALG_SET_IDS.includes(id), 'Invalid algorithm set').optional(),
  isPublic: z.boolean().default(true),
  password: z.string().min(1).max(64).optional(),
});

// POST /api/battle — create a room
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { name, eventId: rawEventId, algSetId, isPublic, password } = createSchema.parse(req.body ?? {});
    if (!isPublic && !password) {
      res.status(400).json({ error: 'Private rooms require a password' });
      return;
    }
    // When an algorithm set is chosen, eventId is always derived from its
    // own puzzle rather than trusted from the client — this is purely a
    // rendering hint for ScramblePanel, and deriving it server-side means a
    // stale/buggy client can never send a mismatched eventId/algSetId pair
    // into the DB.
    const algSet = algSetId ? getAlgSet(algSetId) : undefined;
    const eventId = algSet ? algSet.puzzle : rawEventId;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.battleRoom.findUnique({ where: { code } });
      if (!exists) break;
      code = makeCode();
    }
    const scramble = await getRoundScramble(eventId, algSetId ?? null);
    const room = await prisma.battleRoom.create({
      data: { name, code, eventId, algSetId: algSetId ?? null, isPublic, password: hashedPassword, scramble },
    });
    res.status(201).json({ code: room.code, id: room.id });
  } catch (e) {
    next(e);
  }
});

// GET /api/battle/public — list public rooms
router.get('/public', async (_req, res, next) => {
  try {
    const rooms = await prisma.battleRoom.findMany({
      where: { isPublic: true },
      include: { _count: { select: { participants: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(
      rooms.map((r) => ({
        code: r.code,
        name: r.name,
        eventId: r.eventId,
        algSetId: r.algSetId,
        participantCount: r._count.participants,
        status: r.status,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// GET /api/battle/:code — room info
router.get('/:code', async (req, res, next) => {
  try {
    const room = await prisma.battleRoom.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { participants: true },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({
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
    });
  } catch (e) {
    next(e);
  }
});

export default router;
