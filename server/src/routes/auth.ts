import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { User } from '@prisma/client';
import { prisma } from '../prisma.js';
import { env, isProd } from '../env.js';
import {
  setAuthCookies,
  clearAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from '../auth/jwt.js';
import { requireAuth, optionalAuth } from '../auth/middleware.js';
import { toPublicUser } from '../util/dto.js';

const router = Router();

// ── Bearer-token clients (the mobile app) ─────────────────────────────────
// httpOnly cookies are the wrong primitive for a native HTTP client: there's
// no browser cookie jar, and a React Native fetch/axios stack can't read a
// Set-Cookie that the OS networking layer may or may not have persisted. So
// a native client opts in to being handed the JWTs directly, in the response
// body, by sending `X-Auth-Mode: bearer`. It then stores them in
// expo-secure-store and sends the access token as an `Authorization: Bearer`
// header (which requireAuth/optionalAuth already accept as a fallback, see
// server/src/auth/middleware.ts's extractToken).
//
// This is purely additive: cookies are still set on exactly the same
// responses as before, and the web client never sends this header, so its
// behaviour is byte-for-byte unchanged. The tokens handed out here are minted
// from the same signAccessToken/signRefreshToken with the same payload,
// TTLs, and tokenVersion semantics as the cookie pair. There is no second,
// weaker auth path, just a second transport for the same credential.
function wantsBearerTokens(req: Request): boolean {
  return req.get('x-auth-mode')?.toLowerCase() === 'bearer';
}

interface AuthResponseBody {
  user: ReturnType<typeof toPublicUser>;
  tokens?: { accessToken: string; refreshToken: string };
}

// Builds the login/register/refresh response body: always the user (what the
// web client reads), plus the token pair only for a client that asked for it.
function authBody(req: Request, user: User, payload: JwtPayload): AuthResponseBody {
  const body: AuthResponseBody = { user: toPublicUser(user) };
  if (wantsBearerTokens(req)) {
    body.tokens = { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
  }
  return body;
}

// Stricter than the blanket 300/min-per-IP limiter on all of /api (see
// app.ts) — login/register/password-change are the routes an attacker would
// actually want to brute-force, so they get their own tighter budget.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(40),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, displayName } = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName, role: 'USER' },
    });
    const payload: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    setAuthCookies(res, payload);
    res.status(201).json(authBody(req, user, payload));
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const payload: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    setAuthCookies(res, payload);
    res.json(authBody(req, user, payload));
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/logout — clears cookies, and if the caller was actually
// authenticated, bumps tokenVersion so their refresh token (and any other
// outstanding refresh tokens for this user) can no longer mint new access
// tokens. optionalAuth (not requireAuth) so logout still succeeds and
// clears cookies even if the access token had already expired.
router.post('/logout', optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      await prisma.user.update({ where: { id: req.user.sub }, data: { tokenVersion: { increment: 1 } } });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/refresh
//
// Same logical flow for both transports: verify the refresh token, re-read
// the user, reject a stale tokenVersion, mint a fresh pair. The only
// difference is where the incoming refresh token comes from and where the new
// pair goes: the cookie jar for web, the request/response body for a bearer
// client. The cookie is still checked first, so the web client's path is
// untouched.
router.post('/refresh', async (req, res) => {
  const bodyToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  const token = req.cookies?.refresh_token ?? bodyToken;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }
  try {
    const payload = verifyRefreshToken(token);
    // Re-read role in case it changed.
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }
    if (payload.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ error: 'Session revoked' });
      return;
    }
    const fresh: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    setAuthCookies(res, fresh);
    res.json(authBody(req, user, fresh));
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me — current user (used by client on boot)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

// ---- Account updates ----

const changeEmailSchema = z.object({ email: z.string().email() });

// PUT /api/auth/email — change email (requires auth)
router.put('/email', requireAuth, async (req, res, next) => {
  try {
    const { email } = changeEmailSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.user!.sub) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data: { email } });
    res.json({ user: toPublicUser(user) });
  } catch (e) { next(e); }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

// PUT /api/auth/password — change password (requires auth + current password)
router.put('/password', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) { res.status(404).json({ error: 'Not found' }); return; }
    if (!user.passwordHash) {
      res.status(400).json({ error: 'WCA-only accounts cannot set a password here' });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) { res.status(401).json({ error: 'Current password is incorrect' }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Changing the password also revokes every other outstanding session —
    // the same tokenVersion bump logout uses (see /logout above).
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- WCA OAuth ----

// GET /api/auth/config reports which login methods are available, and whether
// this deployment is the beta site.
//
// `betaSite` exists for the mobile app. The web client learns this at *build*
// time from VITE_BETA_SITE (client/src/lib/betaSite.ts), because the main and
// beta sites are separate builds of the same repo. A single mobile binary
// can't work that way: it's one build that can be pointed at either API base
// URL, so it has to ask the server it's actually talking to instead. This
// endpoint is mounted before app.ts's beta gate, so it's reachable on the
// beta deployment even by an account without beta access, exactly like
// /login is on web.
router.get('/config', (_req, res) => {
  res.json({
    wcaEnabled: Boolean(env.WCA_CLIENT_ID && env.WCA_CLIENT_SECRET),
    betaSite: env.BETA_SITE,
  });
});

const OAUTH_STATE_COOKIE = 'oauth_state';

// ── Native WCA sign-in ────────────────────────────────────────────────────
//
// The web flow ends by setting cookies and redirecting to the site. A native app
// has neither a cookie jar nor a page to land on, so it needs the JWT pair the
// bearer path uses, delivered somewhere the app can pick it up.
//
// The app opens this same /wca endpoint with ?mobile=1 in a system auth browser
// and waits for a redirect back to its own URL scheme. That flag rides in the
// `state` parameter rather than a second cookie, because `state` is the one
// value WCA is contractually obliged to hand back unchanged, and it's already
// round-tripped and checked.
//
// The callback does NOT redirect with tokens in the URL. Instead it mints a
// single-use, short-lived code, hands that to the app, and the app trades it for
// tokens over POST (see /wca/exchange). A redirect URL is the most-logged,
// most-observed string in an OAuth flow: it lands in browser history, and on
// Android any app registering the same scheme can receive it. A code that is
// useless seconds later and dies on first use is a much smaller thing to leak
// than a 7-day refresh token.
//
// Nothing about the web flow changes: no ?mobile=1 means no marker in the state,
// and the callback takes exactly the branch it always did.
const MOBILE_STATE_PREFIX = 'm.';
const MOBILE_REDIRECT = 'speedcubingcentral://wca-auth';
const OAUTH_RETURN_COOKIE = 'oauth_return';
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

// Where the callback may send a mobile client back to.
//
// The app has to supply this rather than the server hardcoding one address,
// because the return URL genuinely differs by build: a standalone app owns
// `speedcubingcentral://`, but the same code running in Expo Go during
// development is reached at `exp://<dev-host>/--/...` instead.
//
// Which makes this an open-redirect surface, and the thing being redirected is a
// code that can be traded for a session, so it's allowlisted rather than
// trusted. The app's own scheme is always allowed. Expo's dev schemes are
// allowed only outside production, where a dev server URL is meaningless anyway
// and permitting it would let anyone who can craft a link have the code
// delivered to a host of their choosing.
function safeMobileReturn(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 300) return null;
  if (raw.startsWith('speedcubingcentral://')) return raw;
  if (!isProd && /^exp(\+[a-z0-9-]+)?:\/\//i.test(raw)) return raw;
  return null;
}

interface PendingExchange {
  userId: string;
  expiresAt: number;
}

// In-memory rather than Redis: these live for two minutes, are single-use, and a
// lost one just means signing in again. Surviving a restart isn't worth a
// dependency, and this deliberately doesn't use cache.ts, whose entries are
// shared, long-lived WCA API responses.
const pendingExchanges = new Map<string, PendingExchange>();

function putExchange(userId: string): string {
  const code = crypto.randomBytes(32).toString('hex');
  pendingExchanges.set(code, { userId, expiresAt: Date.now() + EXCHANGE_TTL_MS });
  // Opportunistic sweep, so an abandoned flow can't accumulate forever.
  if (pendingExchanges.size > 64) {
    const now = Date.now();
    for (const [k, v] of pendingExchanges) if (v.expiresAt <= now) pendingExchanges.delete(k);
  }
  return code;
}

function takeExchange(code: string): string | null {
  const hit = pendingExchanges.get(code);
  // Deleted on the first read whether or not it's still valid, so a code can
  // never be redeemed twice.
  if (hit) pendingExchanges.delete(code);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.userId;
}

// POST /api/auth/wca/exchange — trade a single-use code for the token pair.
router.post('/wca/exchange', authLimiter, async (req, res, next) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const userId = code ? takeExchange(code) : null;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired sign-in code' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired sign-in code' });
      return;
    }
    const payload: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    // Cookies are set here too, harmlessly: a native client ignores them, and it
    // keeps this response shaped exactly like every other auth response.
    setAuthCookies(res, payload);
    res.json(authBody(req, user, payload));
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/wca — redirect to WCA's authorize endpoint
router.get('/wca', (req, res) => {
  // If WCA OAuth isn't configured, bounce back with a clear in-app message
  // rather than sending the user to WCA's "Missing required parameter" error.
  if (!env.WCA_CLIENT_ID) {
    res.redirect(`${env.FRONTEND_URL}/login?error=wca_not_configured`);
    return;
  }
  // CSRF-linking protection: a random state, round-tripped via a short-lived
  // httpOnly cookie, so the callback can confirm this response actually
  // corresponds to a flow we started (not an attacker's crafted callback URL
  // tricking a victim into linking the attacker's WCA account).
  // The marker rides in the state so the callback knows where to send the user
  // back to. It's covered by the same round-trip check as the rest of the state,
  // so it can't be forged into a flow that didn't start as a mobile one.
  const state = (req.query.mobile === '1' ? MOBILE_STATE_PREFIX : '') + crypto.randomBytes(16).toString('hex');
  if (req.query.mobile === '1') {
    // Carried in a cookie rather than the state so it survives the round trip
    // without being echoed through WCA, and so it's never attacker-supplied at
    // the point it's used: whatever comes back, this is what the server chose.
    const ret = safeMobileReturn(req.query.return_url) ?? MOBILE_REDIRECT;
    res.cookie(OAUTH_RETURN_COOKIE, ret, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });
  const url = new URL(`${env.WCA_BASE}/oauth/authorize`);
  url.searchParams.set('client_id', env.WCA_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.WCA_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  // WCA OAuth: 'public' is the only valid scope and is the default.
  // Omitting scope avoids "invalid scope" errors on some WCA environments.
  res.redirect(url.toString());
});

// GET /api/auth/wca/callback — exchange code, fetch profile, upsert user
router.get('/wca/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
  // Read off the *expected* state, the value this server issued, never off the
  // one echoed back in the query string, which is attacker-controllable.
  const isMobile = typeof expectedState === 'string' && expectedState.startsWith(MOBILE_STATE_PREFIX);
  // Re-validated on the way out, not just on the way in: a cookie is client
  // storage, so this is checked against the allowlist again rather than trusted
  // because we set it earlier.
  const mobileReturn = safeMobileReturn(req.cookies?.[OAUTH_RETURN_COOKIE]) ?? MOBILE_REDIRECT;
  res.clearCookie(OAUTH_RETURN_COOKIE, { path: '/' });
  const joiner = mobileReturn.includes('?') ? '&' : '?';
  const fail = (reason: string) => {
    if (isMobile) res.redirect(`${mobileReturn}${joiner}error=${reason}`);
    else res.redirect(`${env.FRONTEND_URL}/login?error=${reason}`);
  };
  if (!code) {
    fail('wca_no_code');
    return;
  }
  if (!expectedState || state !== expectedState) {
    fail('wca_failed');
    return;
  }
  try {
    const tokenResp = await axios.post(`${env.WCA_BASE}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: env.WCA_CLIENT_ID,
      client_secret: env.WCA_CLIENT_SECRET,
      redirect_uri: env.WCA_REDIRECT_URI,
      code,
    });
    const accessToken = tokenResp.data.access_token as string;

    const meResp = await axios.get(`${env.WCA_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = meResp.data.me;
    const wcaId: string | null = me.wca_id ?? null;
    const displayName: string = me.name ?? 'WCA User';
    const email: string | null = me.email ?? null;
    const country: string | null = me.country_iso2 ?? me.country?.iso2 ?? null;
    const avatarUrl: string | null = me.avatar?.url ?? null;

    // Upsert by wcaId (preferred) then email.
    let user = wcaId ? await prisma.user.findUnique({ where: { wcaId } }) : null;
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { wcaId, displayName, country, avatarUrl, email: email ?? user.email },
      });
    } else {
      user = await prisma.user.create({
        data: { wcaId, displayName, email, country, avatarUrl, role: 'USER' },
      });
    }

    const payload: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    if (isMobile) {
      // Hand back a single-use code, not the tokens themselves: this URL is
      // about to be written to browser history and, on Android, delivered to
      // every app registered for the scheme.
      res.redirect(`${mobileReturn}${joiner}code=${putExchange(user.id)}`);
      return;
    }
    setAuthCookies(res, payload);
    res.redirect(`${env.FRONTEND_URL}/profile`);
  } catch (e) {
    const msg = axios.isAxiosError(e) ? e.message : 'wca_error';
    console.error('[wca] callback error:', msg);
    fail('wca_failed');
  }
});

export default router;
