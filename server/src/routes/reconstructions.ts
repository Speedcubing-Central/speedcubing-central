import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, optionalAuth } from '../auth/middleware.js';
import { toReconstructionDTO } from '../util/dto.js';
import { EVENT_IDS } from '@scc/shared';

const router = Router();

const createSchema = z.object({
  title: z.string().max(80).default(''),
  eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event'),
  scramble: z.string().max(2000),
  solution: z.string().min(1).max(20000),
  timeMs: z.number().int().nonnegative().nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().max(80).optional(),
  eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event').optional(),
  scramble: z.string().max(2000).optional(),
  solution: z.string().min(1).max(20000).optional(),
  timeMs: z.number().int().nonnegative().nullable().optional(),
});

// GET /api/reconstructions — list current user's saved reconstructions
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const reconstructions = await prisma.reconstruction.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reconstructions.map(toReconstructionDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/reconstructions — save a reconstruction
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, eventId, scramble, solution, timeMs } = createSchema.parse(req.body);
    const reconstruction = await prisma.reconstruction.create({
      data: { title, eventId, scramble, solution, timeMs, userId: req.user!.sub },
    });
    res.status(201).json(toReconstructionDTO(reconstruction));
  } catch (e) {
    next(e);
  }
});

// GET /api/reconstructions/:id — fetch a single reconstruction (public, for share links)
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const reconstruction = await prisma.reconstruction.findUnique({ where: { id: req.params.id } });
    if (!reconstruction) {
      res.status(404).json({ error: 'Reconstruction not found' });
      return;
    }
    res.json(toReconstructionDTO(reconstruction));
  } catch (e) {
    next(e);
  }
});

// PATCH /api/reconstructions/:id — update (rename and/or replace scramble/solution/event)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.reconstruction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Reconstruction not found' });
      return;
    }
    const updated = await prisma.reconstruction.update({ where: { id: req.params.id }, data });
    res.json(toReconstructionDTO(updated));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/reconstructions/:id — delete
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.reconstruction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Reconstruction not found' });
      return;
    }
    await prisma.reconstruction.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
