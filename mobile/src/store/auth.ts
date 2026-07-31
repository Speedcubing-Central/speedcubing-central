import { create } from 'zustand';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { PublicUser } from '@scc/shared';
import { api, setAuthLostHandler } from '../lib/api';
import { SERVER_ORIGIN } from '../lib/config';
import { loadTokens, saveTokens, clearTokens, type TokenPair } from '../lib/tokens';

// Must match the server's MOBILE_REDIRECT and app.json's `scheme`. Built from
// the scheme rather than hardcoded so the two can't drift apart silently.
const WCA_RETURN_URL = Linking.createURL('wca-auth');

// Mobile counterpart of client/src/store/auth.ts. Same endpoints and the same
// resulting PublicUser (including its `betaAccess` flag, which the beta gate
// reads). The difference is that login/register also persist the returned JWT
// pair into expo-secure-store, and boot has to load that pair back before it
// can ask /auth/me who we are.
interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  init: () => Promise<void>;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  /** Runs the native WCA OAuth flow. Resolves false if the user backed out. */
  loginWithWca: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    const tokens = await loadTokens();
    if (!tokens) {
      // No stored credential. A guest. Not an error state: the Timer, the
      // calculator and the trainers all work signed out, exactly as on web.
      set({ user: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get<{ user: PublicUser }>('/auth/me');
      set({ user: data.user, loading: false });
    } catch {
      // The api interceptor already tried a refresh and cleared the tokens if
      // it failed, so reaching here means the stored session is genuinely dead.
      set({ user: null, loading: false });
    }
  },
  // Re-reads the current user from the server. betaAccess is checked fresh
  // from the database on every request server-side (server/src/auth/
  // betaGate.ts), so this is how the app picks up an access change without a
  // reinstall.
  refreshUser: async () => {
    try {
      const { data } = await api.get<{ user: PublicUser }>('/auth/me');
      set({ user: data.user });
    } catch {
      /* leave the current user in place; the interceptor handles a dead session */
    }
  },
  login: async (email, password) => {
    const { data } = await api.post<{ user: PublicUser; tokens?: TokenPair }>('/auth/login', {
      email,
      password,
    });
    if (data.tokens) await saveTokens(data.tokens);
    set({ user: data.user });
  },
  register: async (email, password, displayName) => {
    const { data } = await api.post<{ user: PublicUser; tokens?: TokenPair }>('/auth/register', {
      email,
      password,
      displayName,
    });
    if (data.tokens) await saveTokens(data.tokens);
    set({ user: data.user });
  },
  loginWithWca: async () => {
    // The system auth browser, not an in-app WebView: it's the only surface that
    // shares Safari's cookie jar, so someone already signed in to WCA isn't made
    // to type their password again, and credentials are never entered in a view
    // this app could read.
    // The return URL is sent along because it isn't fixed: a standalone build is
    // reached at speedcubingcentral://, but the same code in Expo Go is reached
    // at exp://<dev-host>/--/. The server allowlists what it will accept.
    const result = await WebBrowser.openAuthSessionAsync(
      `${SERVER_ORIGIN}/api/auth/wca?mobile=1&return_url=${encodeURIComponent(WCA_RETURN_URL)}`,
      WCA_RETURN_URL,
    );
    // 'cancel' (dismissed) and 'dismiss' both mean the user backed out.
    if (result.type !== 'success') return false;

    const { queryParams } = Linking.parse(result.url);
    const err = typeof queryParams?.error === 'string' ? queryParams.error : null;
    if (err) throw new Error(err === 'wca_not_configured' ? 'WCA sign-in is not configured on this server.' : 'WCA sign-in failed.');

    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!code) throw new Error('WCA sign-in did not return a sign-in code.');

    // The redirect carries a single-use code, never the tokens. Trading it over
    // POST keeps the credentials out of the URL, and out of browser history.
    const { data } = await api.post<{ user: PublicUser; tokens?: TokenPair }>('/auth/wca/exchange', { code });
    if (data.tokens) await saveTokens(data.tokens);
    set({ user: data.user });
    return true;
  },
  logout: async () => {
    try {
      // Bumps tokenVersion server-side, which revokes every outstanding
      // refresh token for this account. The same thing the web client's
      // logout does, and the reason this is worth attempting even though the
      // local tokens are about to be deleted regardless.
      await api.post('/auth/logout');
    } catch {
      /* log out locally even if the server call fails */
    }
    await clearTokens();
    set({ user: null });
  },
}));

// Lets the api interceptor drop the app back to a logged-out state when a
// refresh definitively fails, without importing this store (which imports it).
setAuthLostHandler(() => useAuth.setState({ user: null }));
