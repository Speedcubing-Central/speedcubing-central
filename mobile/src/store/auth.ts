import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import type { PublicUser } from '@scc/shared';
import { api, setAuthLostHandler } from '../lib/api';
import { SERVER_ORIGIN } from '../lib/config';
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
  /** Runs the native WCA OAuth flow. Resolves false if the user backed out. */
  loginWithWca: () => Promise<boolean>;
  logout: () => Promise<void>;
}

// Dismissing the auth browser is best effort. Android has no programmatic
// dismiss (expo-web-browser throws UnavailabilityError there, because a Chrome
// custom tab can only be closed by the user), and on any platform the session
// may already be gone. Neither is a reason to report a sign-in that has
// actually completed as a failure, which is what letting this throw did.
function closeBrowser(alreadyDismissed: boolean): void {
  if (alreadyDismissed) return;
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    /* the browser stays until the user closes it; the app is signed in regardless */
  }
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
    // Ask the server for a flow first. The id it returns never appears in a URL,
    // so it isn't written to browser history and can't be delivered to another
    // app; and because the app polls for the result, there is no redirect back
    // into the app to arrange. That's what makes this work identically in Expo
    // Go, a dev build and a store build, with nothing to configure.
    const { data: flow } = await api.post<{ flowId: string; authorizeUrl: string }>('/auth/wca/start');

    // The system browser, not an in-app WebView: it's the only surface that
    // shares Safari's cookie jar, so someone already signed in to WCA isn't made
    // to type their password again, and credentials are never entered in a view
    // this app could read.
    let dismissed = false;
    let browserFailure: unknown = null;
    void WebBrowser.openAuthSessionAsync(flow.authorizeUrl, null).then(
      () => {
        dismissed = true;
      },
      (e) => {
        // The session never opened at all (one is already presented, or the
        // platform refused it). Without this branch the rejection would go
        // unhandled and the loop below would poll a flow nobody can reach for
        // five minutes before reporting a timeout, which describes neither
        // what happened nor what to do about it.
        dismissed = true;
        browserFailure = e;
      },
    );

    // A closed browser is not proof the sign-in failed. WCA can be approved and
    // the page closed by hand inside the 1.2s before the next poll, by which
    // point the flow is already resolved server-side and one more request would
    // collect it. So the browser going away starts a short grace window rather
    // than ending the flow on the tick that notices.
    const GRACE_POLLS = 3;
    let pollsSinceDismiss = 0;

    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1200));
      if (browserFailure) throw browserFailure;
      let resp;
      try {
        resp = await api.post<{ user?: PublicUser; tokens?: TokenPair; status?: string }>(
          '/auth/wca/poll',
          { flowId: flow.flowId },
          // 202 means "still waiting", which is a normal beat of this loop
          // rather than a failure, so it must not go down the error path.
          { validateStatus: (s) => s === 200 || s === 202 || s === 401 },
        );
      } catch {
        // A dropped poll (a blip while the browser is foregrounded) shouldn't
        // end the flow; the next tick tries again.
        continue;
      }
      if (resp.status === 401) throw new Error('Sign-in expired. Please try again.');
      if (resp.status === 200 && resp.data.user) {
        if (resp.data.tokens) await saveTokens(resp.data.tokens);
        set({ user: resp.data.user });
        // Close the browser for them: the flow is done and the page behind it
        // says as much, but nobody should have to dismiss it themselves.
        closeBrowser(dismissed);
        return true;
      }
      // The user closed the browser without finishing, and the grace window
      // above has passed without the flow resolving.
      if (dismissed && ++pollsSinceDismiss > GRACE_POLLS) return false;
    }
    closeBrowser(dismissed);
    throw new Error('Sign-in timed out. Please try again.');
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
