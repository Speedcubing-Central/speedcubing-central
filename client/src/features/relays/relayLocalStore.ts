import type { CustomRelayDTO, CustomRelayEventEntry, RelayAttemptDTO } from '@scc/shared';

// Guest persistence in localStorage (no account) — mirrors
// features/timer/localStore.ts's pattern exactly: one key, `g_`-prefixed ids
// (deliberately not globally unique, since local-only data is never shared).
const SKEY = 'scc-guest-relay-data';

interface GuestRelayData {
  customRelays: CustomRelayDTO[];
  attempts: RelayAttemptDTO[];
}

function read(): GuestRelayData {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return JSON.parse(raw) as GuestRelayData;
  } catch {
    /* ignore */
  }
  return { customRelays: [], attempts: [] };
}

function write(data: GuestRelayData) {
  localStorage.setItem(SKEY, JSON.stringify(data));
}

function uid() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

export const guestRelayStore = {
  listCustomRelays(): CustomRelayDTO[] {
    return read().customRelays;
  },
  saveCustomRelay(name: string, events: CustomRelayEventEntry[]): CustomRelayDTO {
    const data = read();
    const relay: CustomRelayDTO = { id: uid(), userId: 'guest', name, events, createdAt: new Date().toISOString() };
    data.customRelays.unshift(relay);
    write(data);
    return relay;
  },
  deleteCustomRelay(id: string) {
    const data = read();
    data.customRelays = data.customRelays.filter((r) => r.id !== id);
    write(data);
  },
  listAttempts(): RelayAttemptDTO[] {
    return read().attempts;
  },
  addAttempt(relayName: string, totalTimeMs: number, legs: RelayAttemptDTO['legs']): RelayAttemptDTO {
    const data = read();
    const attempt: RelayAttemptDTO = { id: uid(), userId: 'guest', relayName, totalTimeMs, createdAt: new Date().toISOString(), legs };
    data.attempts.unshift(attempt);
    write(data);
    return attempt;
  },
  updateAttempt(id: string, totalTimeMs: number): RelayAttemptDTO | null {
    const data = read();
    const attempt = data.attempts.find((a) => a.id === id);
    if (!attempt) return null;
    attempt.totalTimeMs = totalTimeMs;
    write(data);
    return attempt;
  },
  deleteAttempt(id: string) {
    const data = read();
    data.attempts = data.attempts.filter((a) => a.id !== id);
    write(data);
  },
};
