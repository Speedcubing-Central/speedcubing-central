import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { env, isProd } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import solvesRouter from './routes/solves.js';
import wcaRouter from './routes/wca.js';
import profileRouter from './routes/profile.js';
import battleRouter from './routes/battle.js';
import algRouter from './routes/alg.js';
import algSolvesRouter from './routes/algSolves.js';
import scrambleRouter from './routes/scramble.js';
import reconstructionsRouter from './routes/reconstructions.js';
import ccRouter from './routes/cubingContests.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  // Large solve-history responses (thousands of rows) compress down to a
  // fraction of their size — this is the biggest single win for "loading
  // all my times" on big sessions, cheaper than any client-side change.
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Rate limit all API routes.
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/auth', authRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/solves', solvesRouter);
  app.use('/api/wca', wcaRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/battle', battleRouter);
  app.use('/api/alg', algRouter);
  app.use('/api/alg-solves', algSolvesRouter);
  app.use('/api/scramble', scrambleRouter);
  app.use('/api/reconstructions', reconstructionsRouter);
  app.use('/api/cc', ccRouter);

  // 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Serve the built React app for all non-API routes.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Centralized error handler — never leaks stack traces.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (env.NODE_ENV !== 'test') console.error('[error]', message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
