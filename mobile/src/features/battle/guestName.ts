import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The display name a signed-out player last battled under.
//
// Mobile counterpart of client/src/lib/guestName.ts, and it exists for the same
// server-side reason rather than as a convenience. `join_room` matches a
// reconnecting guest to their existing participant row *by name* (a guest has no
// stable identity to match on), so a guest who comes back under a different name
// does not resume their row: they get a second one, at zero points, and the
// original sits in the room unfinished, which blocks round completion for
// everybody rather than just for them.
//
// The web version reads localStorage synchronously. AsyncStorage has no
// synchronous API, so the value is hydrated once and served from memory after
// that, the same shape as features/timer/guestStore.ts.
const KEY = 'scc-guest-display-name';

let cached = '';
let hydrated = false;
let hydrating: Promise<void> | null = null;

export function hydrateGuestName(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = AsyncStorage.getItem(KEY)
    .then((raw) => {
      cached = raw ?? '';
    })
    .catch(() => {
      /* storage unavailable; an empty name just means we ask for one */
    })
    .finally(() => {
      hydrated = true;
      hydrating = null;
    });
  return hydrating;
}

export function getGuestName(): string {
  return cached;
}

export function setGuestName(name: string): void {
  cached = name;
  hydrated = true;
  AsyncStorage.setItem(KEY, name).catch(() => {
    /* in-memory value still serves this session */
  });
}

/**
 * The stored name, and whether the lookup has finished.
 *
 * The `ready` flag is the part that matters. Joining before hydration finishes
 * would send an empty name, which is exactly the mismatch described above, so
 * callers wait for this rather than reading `getGuestName()` on first render.
 */
export function useGuestName(): { name: string; ready: boolean } {
  const [state, setState] = useState(() => ({ name: cached, ready: hydrated }));
  useEffect(() => {
    let cancelled = false;
    hydrateGuestName().then(() => {
      if (!cancelled) setState({ name: cached, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
