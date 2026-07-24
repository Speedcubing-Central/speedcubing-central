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
  // A blank/whitespace-only comment clears it back to no comment at all
  // (stored as null) rather than persisting an empty string.
  comment: z.string().max(2000).optional(),
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1).max(2000) });

// PATCH /api/solves/:id — update penalty, time, and/or comment
router.patch('/:id', async (req, res, next) => {
  try {
    const solve = await prisma.solve.findUnique({ where: { id: req.params.id } });
    if (!solve || solve.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Solve not found' });
      return;
    }
    const { comment, ...rest } = patchSchema.parse(req.body);
    const updated = await prisma.solve.update({
      where: { id: solve.id },
      data: { ...rest, ...(comment !== undefined ? { comment: comment.trim() || null } : {}) },
    });
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

// POST /api/solves/bulk-delete — delete many solves at once (owner-scoped,
// so any ids that aren't the caller's are silently ignored rather than
// erroring). POST (not DELETE) to avoid relying on a request body with the
// DELETE method, which some proxies strip.
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = bulkDeleteSchema.parse(req.body);
    const result = await prisma.solve.deleteMany({
      where: { id: { in: ids }, userId: req.user!.sub },
    });
    res.json({ count: result.count });
  } catch (e) {
    next(e);
  }
});

export default router;
