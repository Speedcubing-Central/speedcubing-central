import Constants from 'expo-constants';

// Where the Speedcubing Central API lives for this build.
//
// The web client doesn't need this. It's served by the same Express process
// that serves its API, so a relative '/api' baseURL always resolves correctly
// (in dev the Vite proxy handles it). A native app has no origin of its own,
// so it has to be told the absolute URL.
//
// Resolution order:
//   1. EXPO_PUBLIC_API_URL, env var, inlined by Metro at bundle time.
//      This is how you point a build at production vs. beta vs. a laptop.
//   2. app.json's extra.apiBaseUrl. The committed default.
//
// Note for local development: 'localhost' from a phone or emulator means the
// *device*, not your development machine, so a real device needs your
// machine's LAN address (e.g. http://192.168.1.20:3001). The Android emulator
// reaches the host at 10.0.2.2.
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const fromAppConfig = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;

export const SERVER_ORIGIN = (fromEnv || fromAppConfig || 'http://localhost:3001').replace(/\/+$/, '');

// Matches the web client's axios baseURL of '/api'.
export const API_BASE_URL = `${SERVER_ORIGIN}/api`;
