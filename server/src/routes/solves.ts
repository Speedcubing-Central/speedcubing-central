import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../auth/middleware.js';
import { toSolveDTO } from '../util/dto.js';

const router = Router();
router.use(requireAuth);

const patchSchema = z.object({
  penalty: z.enum(['NONE', 'PLUS2', 'DNF']).optional(),
  time: z.number().int().positive().optional(),
});

// PATCH /api/solves/:id — update penalty and/or time
router.patch('/:id', async (req, res, next) => {
  try {
    const solve = await prisma.solve.findUnique({ where: { id: req.params.id } });
    if (!solve || solve.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Solve not found' });
      return;
    }
    const patch = patchSchema.parse(req.body);
    const updated = await prisma.solve.update({ where: { id: solve.id }, data: patch });
    res.json(toSolveDTO(updated));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/solves/:id — delete solve
router.delete('/:id', async (req, res, next) => {
  try {
    const solve = await prisma.solve.findUnique({ where: { id: req.params.id } });
    if (!solve || solve.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Solve not found' });
      return;
    }
    await prisma.solve.delete({ where: { id: solve.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
