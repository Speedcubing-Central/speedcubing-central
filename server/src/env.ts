import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load the root .env (two levels up from server/src or server/dist)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // also pick up a local .env if present

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    if (process.env.NODE_ENV === 'production') {
      // A missing secret in production must never silently fall back to a
      // guessable default — that would let anyone forge valid auth tokens.
      throw new Error(`[env] Missing required env var ${name} in production`);
    }
    // Don't crash hard for optional dev secrets — warn and use a dev default.
    console.warn(`[env] Missing ${name}; using insecure development default.`);
    return `dev-${name.toLowerCase()}`;
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  WCA_CLIENT_ID: process.env.WCA_CLIENT_ID ?? '',
  WCA_CLIENT_SECRET: process.env.WCA_CLIENT_SECRET ?? '',
  WCA_REDIRECT_URI: process.env.WCA_REDIRECT_URI ?? 'http://localhost:3001/api/auth/wca/callback',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  REDIS_URL: process.env.REDIS_URL ?? '',
  // True only on the beta-hosted deployment (beta.speedcubingcentral.com) —
  // see server/src/auth/betaGate.ts and CLAUDE.md's "Beta site" note.
  BETA_SITE: process.env.BETA_SITE === 'true',
  WCA_BASE: 'https://www.worldcubeassociation.org',
  WCA_API_BASE: 'https://www.worldcubeassociation.org/api/v0',
};

export const isProd = env.NODE_ENV === 'production';
