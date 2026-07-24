import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';

// Applied globally (except /api/health and /api/auth) whenever this
// deployment is the beta site — see server/src/app.ts and env.BETA_SITE.
// Assumes optionalAuth already ran so req.user is populated if the caller is
// logged in. Checks the database directly rather than trusting a
// JWT-embedded flag, so revoking someone's beta access takes effect
// immediately instead of waiting for their access token to expire/refresh.
export async function requireBetaAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(403).json({ error: 'This is a private beta. Please log in with an approved account.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { betaAccess: true } });
  if (!user?.betaAccess) {
    res.status(403).json({ error: 'Your account does not have beta access yet.' });
    return;
  }
  next();
}
