import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../auth/middleware.js';
import { toPublicUser } from '../util/dto.js';

const router = Router();

const nameSchema = z.object({ displayName: z.string().min(1).max(40) });

// PUT /api/profile/me — update display name
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { displayName } = nameSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { displayName },
    });
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
