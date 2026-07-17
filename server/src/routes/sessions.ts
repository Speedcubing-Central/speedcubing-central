import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../auth/middleware.js';
import { toSessionDTO, toSolveDTO } from '../util/dto.js';
import { EVENT_IDS } from '@scc/shared';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(60),
  eventId: z.string().refine((id) => EVENT_IDS.includes(id), 'Invalid event'),
});

const renameSchema = z.object({ name: z.string().min(1).max(60) });

const solveSchema = z.object({
  time: z.number().int().nonnegative(),
  penalty: z.enum(['NONE', 'PLUS2', 'DNF']).default('NONE'),
  scramble: z.string().max(2000).default(''),
});

// Bulk import (e.g. from an external timer export) — allows a custom
// createdAt per solve so historical dates survive the import, capped well
// above the client's own chunk size (1000) as a defensive limit.
const bulkImportSchema = z.object({
  solves: z.array(solveSchema.extend({ createdAt: z.string().datetime().optional() })).min(1).max(2000),
});

// GET /api/sessions — list user's sessions
router.get('/', async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.sub },
      include: { _count: { select: { solves: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessions.map(toSessionDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/sessions — create session
router.post('/', async (req, res, next) => {
  try {
    const { name, eventId } = createSchema.parse(req.body);
    const session = await prisma.session.create({
      data: { name, eventId, userId: req.user!.sub },
    });
    res.status(201).json(toSessionDTO(session));
  } catch (e) {
    next(e);
  }
});

// PATCH /api/sessions/:id — rename
router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = renameSchema.parse(req.body);
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const updated = await prisma.session.update({ where: { id: req.params.id }, data: { name } });
    res.json(toSessionDTO(updated));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/sessions/:id — delete session
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await prisma.session.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /api/sessions/:id/solves — get solves for session
router.get('/:id/solves', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    // Secondary sort on id (which — see cstimerImport.ts's dedupeTimestamps —
    // is generated in insertion order even across a single createMany call)
    // so solves sharing an identical createdAt still come back in a stable,
    // correct order instead of whatever Postgres feels like for ties.
    const solves = await prisma.solve.findMany({
      where: { sessionId: session.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(solves.map(toSolveDTO));
  } catch (e) {
    next(e);
  }
});

// POST /api/sessions/:id/solves — save solve
router.post('/:id/solves', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const data = solveSchema.parse(req.body);
    const solve = await prisma.solve.create({
      data: {
        sessionId: session.id,
        userId: req.user!.sub,
        time: data.time,
        penalty: data.penalty,
        scramble: data.scramble,
      },
    });
    res.status(201).json(toSolveDTO(solve));
  } catch (e) {
    next(e);
  }
});

// POST /api/sessions/:id/solves/bulk — bulk import solves (e.g. from cstimer)
router.post('/:id/solves/bulk', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const { solves } = bulkImportSchema.parse(req.body);
    const result = await prisma.solve.createMany({
      data: solves.map((s) => ({
        sessionId: session.id,
        userId: req.user!.sub,
        time: s.time,
        penalty: s.penalty,
        scramble: s.scramble,
        ...(s.createdAt ? { createdAt: new Date(s.createdAt) } : {}),
      })),
    });
    res.status(201).json({ count: result.count });
  } catch (e) {
    next(e);
  }
});

export default router;
