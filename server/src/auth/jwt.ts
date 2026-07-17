import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env, isProd } from '../env.js';

export interface JwtPayload {
  sub: string; // user id
  role: 'GUEST' | 'USER';
  // Must match the user's current User.tokenVersion — bumped on logout/
  // password change to revoke every outstanding refresh token at once.
  // Only checked on refresh (see routes/auth.ts), not on every access-token
  // verification, so authenticated requests stay a stateless, no-DB-hit check.
  tokenVersion: number;
}

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ALGORITHM = 'HS256';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TTL, algorithm: ALGORITHM });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL, algorithm: ALGORITHM });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM] }) as JwtPayload;
}

const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(res: Response, payload: JwtPayload): void {
  res.cookie('access_token', signAccessToken(payload), {
    ...cookieBase,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', signRefreshToken(payload), {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', cookieBase);
  res.clearCookie('refresh_token', cookieBase);
}
