import * as SecureStore from 'expo-secure-store';

// JWT storage for the mobile app.
//
// Deliberately expo-secure-store, not AsyncStorage: AsyncStorage is plain
// unencrypted files in the app sandbox, readable by anything that gets at the
// filesystem (a rooted/jailbroken device, an unencrypted device backup). These
// are long-lived credentials. A refresh token is good for 7 days and can mint
// access tokens for the account. So they go in the Keychain (iOS) /
// EncryptedSharedPreferences-backed keystore (Android), which is what
// SecureStore wraps. Non-sensitive state (settings, guest solves) uses
// AsyncStorage instead; see store/settings.ts.
//
// The web client needs no equivalent to any of this: its tokens live in
// httpOnly cookies that JavaScript can't read by design.

const ACCESS_KEY = 'scc.accessToken';
const REFRESH_KEY = 'scc.refreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Cached in memory so the request interceptor doesn't have to await a
// Keychain read on every single API call (SecureStore is a native bridge
// round-trip). loadTokens() populates this at startup; save/clear keep it in
// step with what's actually persisted.
let cached: TokenPair | null = null;

export function getAccessToken(): string | null {
  return cached?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return cached?.refreshToken ?? null;
}

// Reads the persisted pair into the in-memory cache. Called once on boot,
// before anything tries to make an authenticated request.
export async function loadTokens(): Promise<TokenPair | null> {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    // Half a pair is unusable: without a refresh token an expired access
    // token is a dead end, and a refresh token alone is handled fine by the
    // interceptor, but treating a partial pair as "logged in" would just
    // produce a confusing 401 loop. Start clean instead.
    cached = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  } catch {
    // A SecureStore read can fail on a device whose keystore is in a bad
    // state. Treat it as "not logged in" rather than crashing on boot.
    cached = null;
  }
  return cached;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  cached = tokens;
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    ]);
  } catch {
    // Keep the in-memory copy so the current session still works even if
    // persisting failed. The user just gets logged out on next launch.
  }
}

export async function clearTokens(): Promise<void> {
  cached = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {
    /* nothing useful to do if the delete fails */
  }
}
