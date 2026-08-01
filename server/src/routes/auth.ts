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
// This does NOT redirect back into the app. The obvious design is a custom URL
// scheme (speedcubingcentral://...), and it has two problems. It is an
// open-redirect surface guarding a credential: the app must supply the return
// URL, because it differs between a standalone build and Expo Go, and a crafted
// link naming an attacker's host, completed by a signed-in victim, hands over
// that victim's account. And it does not work in Expo Go at all, which owns no
// custom scheme, so testing against a deployed server needed a standing
// allowlist exception.
//
// Instead the app never leaves the conversation. It asks for a flow up front,
// gets back an opaque id and the WCA URL to open, then polls for the result:
//
//   POST /wca/start  ->  { flowId, authorizeUrl }
//   (user approves at WCA; the callback resolves the flow and shows a plain page)
//   POST /wca/poll   ->  202 while pending, then the token pair, once
//
// The flow id never appears in any URL, so it is not in browser history and not
// deliverable to another app. There is no redirect target to validate, which
// removes the open-redirect surface rather than guarding it, and the same code
// path works in Expo Go, a dev build and a store build with no configuration.
//
// Nothing about the web flow changes: no mobile flow means no marker in the
// state, and the callback takes exactly the branch it always did.
const MOBILE_STATE_PREFIX = 'm.';
const FLOW_TTL_MS = 10 * 60 * 1000;

interface WcaFlow {
  /** The `state` handed to WCA, and the only way back to this flow. */
  state: string;
  /** Set once WCA has been exchanged and the user resolved. */
  userId: string | null;
  expiresAt: number;
}

// In-memory rather than Redis: these live ten minutes, are read once, and a lost
// one just means signing in again. Surviving a restart isn't worth a dependency,
// and this deliberately doesn't use cache.ts, whose entries are shared,
// long-lived WCA API responses.
const wcaFlows = new Map<string, WcaFlow>();

function sweepFlows(): void {
  const now = Date.now();
  for (const [k, v] of wcaFlows) if (v.expiresAt <= now) wcaFlows.delete(k);
}

function findFlowByState(state: string): { flowId: string; flow: WcaFlow } | null {
  for (const [flowId, flow] of wcaFlows) {
    if (flow.state === state && flow.expiresAt > Date.now()) return { flowId, flow };
  }
  return null;
}

function buildAuthorizeUrl(state: string): string {
  const url = new URL(`${env.WCA_BASE}/oauth/authorize`);
  url.searchParams.set('client_id', env.WCA_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.WCA_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

// Every host:port this request could be said to have arrived on. Host and not a
// full origin on purpose: behind a proxy the scheme lives in a forwarded header
// and getting that wrong would reject a perfectly good deployment. All the
// candidates rather than one, for the same reason: a proxy may pass the public
// host through untouched, or rewrite Host and put the original in
// X-Forwarded-Host, and treating a match on either as a match means a
// deployment can only be flagged when nothing about the request agrees with the
// configuration.
function requestHosts(req: Request): string[] {
  const forwarded = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  return [req.get('host'), forwarded].filter((h): h is string => !!h);
}

// A native flow only completes if WCA's callback lands back on *this* server:
// the flow lives in this process's memory, and it is this process the app polls.
// So the configured WCA_REDIRECT_URI has to be on the same origin the app just
// reached us on.
//
// When it isn't, the flow is already doomed at the moment it starts, and it
// fails somewhere the app can't explain: either WCA refuses the authorize
// request outright ("The requested redirect URI is malformed or doesn't match
// the client redirect URI") because the URI isn't registered on the OAuth
// application, or it accepts it and sends the phone's browser to an origin the
// phone can't reach (a `localhost` callback means the phone itself). The common
// case is a dev server: WCA_REDIRECT_URI defaults to http://localhost:3001,
// which is right for a browser on the development machine and wrong for
// anything holding a phone.
//
// Only the native route checks this. The web flow legitimately runs across two
// origins (the client on :5173, the callback on :3001) and is left alone.
function nativeRedirectMismatch(req: Request): string | null {
  const hosts = requestHosts(req);
  if (hosts.length === 0) return null;
  let callback: URL;
  try {
    callback = new URL(env.WCA_REDIRECT_URI);
  } catch {
    return 'This server has an invalid WCA_REDIRECT_URI, so WCA sign-in cannot be started.';
  }
  if (hosts.includes(callback.host)) return null;
  return (
    `WCA sign-in is not available on this server: it returns from WCA to ${callback.origin}, ` +
    `but this app is connected to ${hosts[0]}. Point the app at the deployed site, or set ` +
    `WCA_REDIRECT_URI to this server's own address and register that URL with WCA.`
  );
}

// POST /api/auth/wca/start — begin a native sign-in.
router.post('/wca/start', authLimiter, (req, res) => {
  if (!env.WCA_CLIENT_ID) {
    res.status(503).json({ error: 'WCA sign-in is not configured on this server.' });
    return;
  }
  const mismatch = nativeRedirectMismatch(req);
  if (mismatch) {
    res.status(503).json({ error: mismatch });
    return;
  }
  sweepFlows();
  const state = MOBILE_STATE_PREFIX + crypto.randomBytes(24).toString('hex');
  const flowId = crypto.randomBytes(32).toString('hex');
  wcaFlows.set(flowId, { state, userId: null, expiresAt: Date.now() + FLOW_TTL_MS });
  res.json({ flowId, authorizeUrl: buildAuthorizeUrl(state) });
});

// POST /api/auth/wca/poll — collect the result of a native sign-in.
router.post('/wca/poll', async (req, res, next) => {
  try {
    const flowId = typeof req.body?.flowId === 'string' ? req.body.flowId : '';
    const flow = flowId ? wcaFlows.get(flowId) : undefined;
    if (!flow || flow.expiresAt <= Date.now()) {
      if (flow) wcaFlows.delete(flowId);
      res.status(401).json({ error: 'Sign-in expired. Please try again.' });
      return;
    }
    if (!flow.userId) {
      // Still waiting on WCA. Not an error: the app polls until this changes.
      res.status(202).json({ status: 'pending' });
      return;
    }
    // Read once: the tokens are handed over a single time, so a replayed flowId
    // is worth nothing even before it expires.
    wcaFlows.delete(flowId);
    const user = await prisma.user.findUnique({ where: { id: flow.userId } });
    if (!user) {
      res.status(401).json({ error: 'Sign-in expired. Please try again.' });
      return;
    }
    const payload: JwtPayload = { sub: user.id, role: user.role as JwtPayload['role'], tokenVersion: user.tokenVersion };
    setAuthCookies(res, payload);
    res.json(authBody(req, user, payload));
  } catch (e) {
    next(e);
  }
});

// The page the browser lands on after a native sign-in. Plain HTML rather than a
// redirect into the web client, which would show a login screen to someone who
// has just signed in. The app closes this itself the moment its poll succeeds;
// this is what's behind it in the meantime, and what remains if the user got
// here in an ordinary browser.
function nativeDonePage(message: string, detail: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Speedcubing Central</title><style>body{background:#0f1117;color:#e8eaf0;font:16px/1.5 system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}div{max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.15rem;margin:0 0 .5rem}p{margin:0;color:#9aa3b8}</style></head><body><div><h1>${message}</h1><p>${detail}</p></div></body></html>`;
}

// GET /api/auth/wca — redirect to WCA's authorize endpoint
router.get('/wca', (_req, res) => {
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
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(buildAuthorizeUrl(state));
});

// GET /api/auth/wca/callback — exchange code, fetch profile, upsert user
router.get('/wca/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
  // Read off the *expected* state, the value this server issued, never off the
  // one echoed back in the query string, which is attacker-controllable.
  // A native flow is identified by its own state, which this server generated
  // and still holds. Nothing here is taken from the query string on trust.
  const mobile = typeof state === 'string' && state.startsWith(MOBILE_STATE_PREFIX) ? findFlowByState(state) : null;
  const isMobile = mobile !== null;
  const fail = (reason: string) => {
    if (isMobile) {
      res.status(400).send(nativeDonePage('Sign-in failed', 'Return to the app and try again.'));
    } else {
      res.redirect(`${env.FRONTEND_URL}/login?error=${reason}`);
    }
  };
  if (!code) {
    fail('wca_no_code');
    return;
  }
  // The web flow proves itself with the round-tripped cookie. The native flow
  // proves itself by the state matching a live flow this server created, which
  // is the same guarantee without requiring a cookie to survive a system
  // browser handing control back to the app.
  if (!isMobile && (!expectedState || state !== expectedState)) {
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
    if (mobile) {
      // Resolve the flow the app is polling. Nothing sensitive goes to the
      // browser: it only gets a page telling the user they're done.
      mobile.flow.userId = user.id;
      res.send(nativeDonePage('Signed in', 'You can close this and return to the app.'));
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
