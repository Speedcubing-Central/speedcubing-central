import { create } from 'zustand';
import type { PublicUser } from '@scc/shared';
import { api, setAuthLostHandler } from '../lib/api';
import { loadTokens, saveTokens, clearTokens, type TokenPair } from '../lib/tokens';

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
