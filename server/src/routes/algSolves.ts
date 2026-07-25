import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../auth/middleware.js';
import { toAlgSolveDTO } from '../util/dto.js';
import { getAlgSet, MAX_PLUS_TWO_COUNT } from '@scc/shared';

const router = Router();
router.use(requireAuth);

const createSchema = z
  .object({
    setId: z.string().min(1),
    caseId: z.string().min(1),
    time: z.number().int().nonnegative(),
    penalty: z.enum(['NONE', 'DNF']).default('NONE'),
    plusTwoCount: z.number().int().min(0).max(MAX_PLUS_TWO_COUNT).default(0),
    scramble: z.string().max(2000).default(''),
  })
  .refine((d) => getAlgSet(d.setId)?.caseIds.includes(d.caseId), 'Invalid setId/caseId');

const patchSchema = z.object({
  penalty: z.enum(['NONE', 'DNF']).optional(),
  plusTwoCount: z.number().int().min(0).max(MAX_PLUS_TWO_COUNT).optional(),
  time: z.number().int().positive().optional(),
});

// GET /api/alg-solves/:setId — full solve history for a set
router.get('/:setId', async (req, res, next) => {
  try {
    const solves = await prisma.algSolve.findMany({
      where: { userId: req.user!.sub, setId: req.params.setId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(solves.map(toAlgSolveDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/alg-solves — save a drill attempt
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const solve = await prisma.algSolve.create({
      data: { ...data, plusTwoCount: data.penalty === 'DNF' ? 0 : data.plusTwoCount, userId: req.user!.sub },
    });
    res.status(201).json(toAlgSolveDTO(solve));
  } catch (e) {
    next(e);
  }
});

// PATCH /api/alg-solves/:id — update penalty and/or time
router.patch('/:id', async (req, res, next) => {
  try {
    const solve = await prisma.algSolve.findUnique({ where: { id: req.params.id } });
    if (!solve || solve.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Solve not found' });
      return;
    }
    const patch = patchSchema.parse(req.body);
    const nextPenalty = patch.penalty ?? solve.penalty;
    // A DNF never carries stacked +2s — silently zero plusTwoCount rather
    // than rejecting the request, since the client only ever sends one or
    // the other.
    const plusTwoCount = nextPenalty === 'DNF' ? 0 : patch.plusTwoCount ?? solve.plusTwoCount;
    const updated = await prisma.algSolve.update({ where: { id: solve.id }, data: { ...patch, plusTwoCount } });
    res.json(toAlgSolveDTO(updated));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/alg-solves/:id — delete a drill attempt
router.delete('/:id', async (req, res, next) => {
  try {
    const solve = await prisma.algSolve.findUnique({ where: { id: req.params.id } });
    if (!solve || solve.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Solve not found' });
      return;
    }
    await prisma.algSolve.delete({ where: { id: solve.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
