import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, optionalAuth } from '../auth/middleware.js';
import { toCustomRelayDTO, toRelayAttemptDTO } from '../util/dto.js';
import { EVENT_IDS, getRelayPreset, expandToLegs, type CustomRelayEventEntry } from '@scc/shared';

const router = Router();

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const customRelayEventSchema = z.object({
  eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event'),
  quantity: z.number().int().min(1).max(10),
});

// ---- Custom relays (save/share) ----

const createCustomRelaySchema = z.object({
  name: z.string().min(1).max(60),
  events: z.array(customRelayEventSchema).min(1).max(30),
});

// GET /api/relays/custom — list current user's saved custom relays
router.get('/custom', requireAuth, async (req, res, next) => {
  try {
    const relays = await prisma.customRelay.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json(relays.map(toCustomRelayDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/relays/custom — save a custom relay
router.post('/custom', requireAuth, async (req, res, next) => {
  try {
    const { name, events } = createCustomRelaySchema.parse(req.body);
    const relay = await prisma.customRelay.create({
      data: { name, events: events as unknown as Prisma.InputJsonValue, userId: req.user!.sub },
    });
    res.status(201).json(toCustomRelayDTO(relay));
  } catch (e) {
    next(e);
  }
});

// GET /api/relays/custom/:id — fetch a single custom relay (public, for share links)
router.get('/custom/:id', optionalAuth, async (req, res, next) => {
  try {
    const relay = await prisma.customRelay.findUnique({ where: { id: req.params.id } });
    if (!relay) {
      res.status(404).json({ error: 'Custom relay not found' });
      return;
    }
    res.json(toCustomRelayDTO(relay));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/relays/custom/:id
router.delete('/custom/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.customRelay.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Custom relay not found' });
      return;
    }
    await prisma.customRelay.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- Solo relay attempt history ----

const createAttemptSchema = z.object({
  relayName: z.string().min(1).max(80),
  totalTimeMs: z.number().int().nonnegative().max(24 * 60 * 60 * 1000),
  legs: z
    .array(
      z.object({
        eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event'),
        order: z.number().int().nonnegative(),
        scramble: z.string().max(2000),
        splitMs: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .min(1)
    .max(30),
});

// GET /api/relays/attempts — list current user's relay attempt history
router.get('/attempts', requireAuth, async (req, res, next) => {
  try {
    const attempts = await prisma.relayAttempt.findMany({
      where: { userId: req.user!.sub },
      include: { legs: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(attempts.map(toRelayAttemptDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/relays/attempts — record a completed solo relay attempt
router.post('/attempts', requireAuth, async (req, res, next) => {
  try {
    const { relayName, totalTimeMs, legs } = createAttemptSchema.parse(req.body);
    const attempt = await prisma.relayAttempt.create({
      data: {
        userId: req.user!.sub,
        relayName,
        totalTimeMs,
        legs: { create: legs.map((l) => ({ eventId: l.eventId, order: l.order, scramble: l.scramble, splitMs: l.splitMs ?? null })) },
      },
      include: { legs: true },
    });
    res.status(201).json(toRelayAttemptDTO(attempt));
  } catch (e) {
    next(e);
  }
});

const patchAttemptSchema = z.object({
  totalTimeMs: z.number().int().positive().max(24 * 60 * 60 * 1000),
});

// PATCH /api/relays/attempts/:id — edit a recorded attempt's total time (no
// penalty concept here, unlike a single solve — a relay total is just a
// plain duration).
router.patch('/attempts/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.relayAttempt.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }
    const { totalTimeMs } = patchAttemptSchema.parse(req.body);
    const updated = await prisma.relayAttempt.update({
      where: { id: existing.id },
      data: { totalTimeMs },
      include: { legs: true },
    });
    res.json(toRelayAttemptDTO(updated));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/relays/attempts/:id
router.delete('/attempts/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.relayAttempt.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }
    await prisma.relayAttempt.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- Team relay rooms ----

const createRoomSchema = z
  .object({
    name: z.string().min(1).max(40),
    presetId: z.string().optional(),
    customRelayId: z.string().optional(),
    isPublic: z.boolean().default(true),
    password: z.string().min(1).max(64).optional(),
  })
  .refine((v) => !!v.presetId !== !!v.customRelayId, 'Specify exactly one of presetId or customRelayId');

// POST /api/relays/rooms — create a team relay room
router.post('/rooms', optionalAuth, async (req, res, next) => {
  try {
    const { name, presetId, customRelayId, isPublic, password } = createRoomSchema.parse(req.body ?? {});
    if (!isPublic && !password) {
      res.status(400).json({ error: 'Private rooms require a password' });
      return;
    }

    let legEventIds: string[];
    if (presetId) {
      const preset = getRelayPreset(presetId);
      if (!preset) {
        res.status(400).json({ error: 'Unknown preset' });
        return;
      }
      legEventIds = preset.events;
    } else {
      const custom = await prisma.customRelay.findUnique({ where: { id: customRelayId! } });
      if (!custom) {
        res.status(404).json({ error: 'Custom relay not found' });
        return;
      }
      legEventIds = expandToLegs(custom.events as unknown as CustomRelayEventEntry[]);
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.relayRoom.findUnique({ where: { code } });
      if (!exists) break;
      code = makeCode();
    }

    const room = await prisma.relayRoom.create({
      data: {
        name,
        code,
        presetId: presetId ?? null,
        customRelayId: customRelayId ?? null,
        isPublic,
        password: hashedPassword,
        legs: { create: legEventIds.map((eventId, order) => ({ eventId, order })) },
      },
    });
    res.status(201).json({ code: room.code, id: room.id });
  } catch (e) {
    next(e);
  }
});

// GET /api/relays/rooms/public — list public rooms
router.get('/rooms/public', async (_req, res, next) => {
  try {
    const rooms = await prisma.relayRoom.findMany({
      where: { isPublic: true, status: { not: 'FINISHED' } },
      include: { _count: { select: { participants: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const names = await Promise.all(
      rooms.map(async (r) => {
        if (r.presetId) return getRelayPreset(r.presetId)?.name ?? 'Relay';
        if (r.customRelayId) {
          const cr = await prisma.customRelay.findUnique({ where: { id: r.customRelayId } });
          return cr?.name ?? 'Custom Relay';
        }
        return 'Relay';
      }),
    );
    res.json(
      rooms.map((r, i) => ({
        code: r.code,
        name: r.name,
        relayName: names[i],
        participantCount: r._count.participants,
        status: r.status,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// GET /api/relays/rooms/:code — room existence/info lookup before joining over
// the socket. Scrambles are deliberately never included here — they're only
// ever generated once the room goes ACTIVE and delivered per-participant over
// the socket (see server/src/relaySocket.ts), never a plain unauthenticated fetch.
router.get('/rooms/:code', async (req, res, next) => {
  try {
    const room = await prisma.relayRoom.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { _count: { select: { participants: true } } },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const relayName = room.presetId
      ? getRelayPreset(room.presetId)?.name ?? 'Relay'
      : room.customRelayId
        ? (await prisma.customRelay.findUnique({ where: { id: room.customRelayId } }))?.name ?? 'Custom Relay'
        : 'Relay';
    res.json({
      code: room.code,
      name: room.name,
      relayName,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      participantCount: room._count.participants,
      status: room.status,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
