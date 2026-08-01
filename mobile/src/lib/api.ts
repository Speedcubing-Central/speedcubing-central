import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens, type TokenPair } from './tokens';

// The mobile counterpart of client/src/lib/api.ts. Same server, same routes,
// same refresh-once-and-replay behaviour on a 401. The only difference is the
// credential transport: an `Authorization: Bearer` header read from
// expo-secure-store instead of a browser cookie jar.
//
// `X-Auth-Mode: bearer` tells the server to include the JWT pair in the
// login/register/refresh response body (see server/src/routes/auth.ts). The
// web client never sends it, which is why adding this changed nothing for web.
// A request that cannot finish has to fail rather than hang.
//
// Axios defaults `timeout` to 0, meaning wait forever, and without this the app
// could sit on its boot spinner indefinitely: useAuth.init() awaits /auth/me
// before the beta gate will render anything, so a server that accepts the TCP
// connection but never answers (a wedged dev server, a captive portal, a
// dropped connection) left "Loading…" on screen with no error and no retry.
// Actively refused connections were always fine; it is the silent-drop case
// that hangs, which is also the one a phone hits most often.
//
// 15s is long enough for a slow mobile network to answer a cold request and
// short enough that a stuck one becomes a visible failure rather than a
// permanent spinner. getScramble sets its own, longer, per-request timeout
// (see lib/scramble.ts) and is unaffected by this default.
const REQUEST_TIMEOUT_MS = 15_000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'X-Auth-Mode': 'bearer' },
});

// Called when the refresh token turns out to be dead (revoked by a logout or
// password change elsewhere, expired, or the user was deleted). Set by the
// auth store so it can drop back to the logged-out state; kept as a hook
// rather than a direct import to avoid a store <-> api import cycle.
let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(fn: () => void): void {
  onAuthLost = fn;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One shared in-flight refresh, so a burst of concurrent 401s (very easy to hit
// on this app: the Timer screen loads sessions and solves at once)
// results in a single refresh call rather than one per request. Mirrors the
// `refreshing` promise in the web client's interceptor.
let refreshing: Promise<TokenPair> | null = null;

async function doRefresh(): Promise<TokenPair> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      // Bare axios, not `api`: this must not go through the interceptors
      // below, or a failing refresh would recurse into itself.
      const { data } = await axios.post<{ tokens?: TokenPair }>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        // Bare axios does not inherit the instance's timeout, so it has to be
        // repeated here or a hung refresh would hang every request queued
        // behind it.
        { headers: { 'X-Auth-Mode': 'bearer' }, timeout: REQUEST_TIMEOUT_MS },
      );
      if (!data.tokens) throw new Error('Refresh response did not include tokens');
      await saveTokens(data.tokens);
      return data.tokens;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    // Same exclusion list as the web client: a 401 from the auth endpoints
    // themselves is a real answer ("wrong password", "session revoked"), not
    // something a refresh could fix.
    const isAuthCall =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const tokens = await doRefresh();
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch {
        // The refresh token is gone or no longer valid. This session is
        // over. Clear it out so the app stops sending a dead credential.
        await clearTokens();
        onAuthLost?.();
      }
    }
    return Promise.reject(error);
  },
);

// Same shape as the web client's apiError so screens report server-supplied
// messages identically.
export function apiError(e: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(e)) {
    return (e.response?.data as { error?: string })?.error ?? e.message ?? fallback;
  }
  return fallback;
}
