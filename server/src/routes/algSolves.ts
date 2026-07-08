import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../auth/middleware.js';
import { toAlgSolveDTO } from '../util/dto.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  setId: z.string().min(1),
  caseId: z.string().min(1),
  time: z.number().int().nonnegative(),
  penalty: z.enum(['NONE', 'PLUS2', 'DNF']).default('NONE'),
  scramble: z.string().default(''),
});

const patchSchema = z.object({
  penalty: z.enum(['NONE', 'PLUS2', 'DNF']).optional(),
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
      data: { ...data, userId: req.user!.sub },
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
    const updated = await prisma.algSolve.update({ where: { id: solve.id }, data: patch });
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
