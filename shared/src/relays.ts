// Relay definitions, DTOs, and socket payload types shared by the client and server.

export interface RelayPreset {
  id: string;
  name: string;
  group: 'quick' | 'guildford';
  // Flat ordered event ids — presets are always 1x each event (quantities
  // are a custom-relay-only concept).
  events: string[];
}

// Guildford's fixed running order: NxN ladder (small to large), OH, then
// Clock/FTO, then the remaining non-cube events. Mini variants drop 6x6/7x7
// but otherwise keep the same order; New-Style variants swap Clock for FTO
// in the same slot.
const GUILDFORD_TAIL = ['minx', 'pyram', 'skewb', 'sq1'];
const MINI_CUBES = ['222', '333', '444', '555'];
const FULL_CUBES = [...MINI_CUBES, '666', '777'];

export const RELAY_PRESETS: RelayPreset[] = [
  { id: '2-4', name: '2-4 Relay', group: 'quick', events: ['222', '333', '444'] },
  { id: '2-5', name: '2-5 Relay', group: 'quick', events: ['222', '333', '444', '555'] },
  { id: '2-6', name: '2-6 Relay', group: 'quick', events: ['222', '333', '444', '555', '666'] },
  { id: '2-7', name: '2-7 Relay', group: 'quick', events: ['222', '333', '444', '555', '666', '777'] },
  { id: 'mini-guildford', name: 'Mini Guildford', group: 'guildford', events: [...MINI_CUBES, '333oh', 'clock', ...GUILDFORD_TAIL] },
  { id: 'guildford', name: 'Guildford', group: 'guildford', events: [...FULL_CUBES, '333oh', 'clock', ...GUILDFORD_TAIL] },
  { id: 'mini-guildford-ns', name: 'New-Style Mini Guildford', group: 'guildford', events: [...MINI_CUBES, '333oh', 'fto', ...GUILDFORD_TAIL] },
  { id: 'guildford-ns', name: 'New-Style Guildford', group: 'guildford', events: [...FULL_CUBES, '333oh', 'fto', ...GUILDFORD_TAIL] },
];

export function getRelayPreset(id: string): RelayPreset | undefined {
  return RELAY_PRESETS.find((p) => p.id === id);
}

export interface CustomRelayEventEntry {
  eventId: string;
  quantity: number;
}

// Normalizes either a preset's flat event list or a custom relay's
// {eventId, quantity}[] into the same flat ordered leg list. One code path
// feeds scramble generation, room-leg creation, and attempt recording
// regardless of preset vs. custom.
export function expandToLegs(events: CustomRelayEventEntry[]): string[] {
  const legs: string[] = [];
  for (const { eventId, quantity } of events) {
    for (let i = 0; i < quantity; i++) legs.push(eventId);
  }
  return legs;
}

export function presetToLegs(preset: RelayPreset): string[] {
  return [...preset.events];
}

// ---- DTOs ----

export interface CustomRelayDTO {
  id: string;
  userId: string;
  name: string;
  events: CustomRelayEventEntry[];
  createdAt: string;
}

export interface RelayAttemptLegDTO {
  id: string;
  eventId: string;
  order: number;
  scramble: string;
  splitMs: number | null;
}

export interface RelayAttemptDTO {
  id: string;
  userId: string;
  relayName: string;
  totalTimeMs: number;
  createdAt: string;
  legs: RelayAttemptLegDTO[];
}

export type RelayRoomStatus = 'LOBBY' | 'ASSIGNING' | 'ACTIVE' | 'FINISHED';

export interface RelayParticipantDTO {
  id: string;
  userId?: string | null;
  name: string;
  // Approved the event distribution (the ASSIGNING screen's Ready button).
  isReady: boolean;
  // Confirmed, on the start screen with their scramble in front of them,
  // that they're ready to solve. The countdown waits on this one.
  isStartReady: boolean;
  isDone: boolean;
  isHost: boolean;
}

export interface RelayRoomLegDTO {
  id: string;
  eventId: string;
  order: number;
  // Only populated for the assignee once the room is ACTIVE — other
  // participants never receive someone else's scramble.
  scramble: string;
  assignedToId: string | null;
  splitMs: number | null;
}

export interface RelayRoomDTO {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  presetId: string | null;
  customRelayId: string | null;
  relayName: string;
  status: RelayRoomStatus;
  // Set once everyone is ready and every leg's scramble has landed — the
  // server-clock instant the relay will actually start. Present only during
  // that countdown window (status is still 'ASSIGNING'); null before it and
  // cleared once status flips to 'ACTIVE' (startedAt takes over from there).
  countdownStartAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  participants: RelayParticipantDTO[];
  legs: RelayRoomLegDTO[];
}

export interface RelayPublicRoomDTO {
  code: string;
  name: string;
  relayName: string;
  participantCount: number;
  status: RelayRoomStatus;
}

export interface RelayCompletedResult {
  totalTimeMs: number;
  legs: { eventId: string; order: number; assignedToId: string | null; splitMs: number | null }[];
}

// Bumped whenever a change to the relay socket contract leaves an older
// client unable to take part correctly — not for additive changes an old
// client can simply ignore.
//
// This exists because a team relay is one shared state machine driven by
// several browsers, and a browser can be running a bundle from before the
// last deploy (a cached index.html is enough). That is not a cosmetic
// mismatch: when start-readiness was split out of distribution-readiness,
// the previous build had no way to send `relay_toggle_start_ready` at all,
// so a single stale tab could never become ready, the countdown could never
// arm, and the room hung for everyone with no error and nothing to press.
// Both sides compile this constant in, so an old bundle carries the old
// value and is caught at join time rather than deadlocking the room.
//
// 1 — hold-to-start (everyone holds space, first release starts the clock)
// 2 — server-announced countdown, and start-readiness as its own gate
export const RELAY_PROTOCOL_VERSION = 2;

// ---- Socket.io event payloads (merged into shared/src/index.ts's
// ServerToClientEvents / ClientToServerEvents) ----

export interface RelayServerToClientEvents {
  relay_room_state: (room: RelayRoomDTO) => void;
  // The relay will start at `startAt` (server clock). Every client renders
  // the same countdown against its own clock-offset estimate (see
  // relay_time_sync), so all of them hit zero at the same real instant
  // regardless of how wrong their local clocks are.
  relay_countdown: (payload: { startAt: string }) => void;
  // The armed countdown was called off before it fired (someone left, or
  // readiness/assignment stopped holding) — back to the ready screen.
  relay_countdown_cancelled: () => void;
  relay_started: (payload: { startedAt: string }) => void;
  relay_completed: (payload: RelayCompletedResult) => void;
  // This client's bundle predates the server's relay protocol, so its join
  // was refused — letting it in is what hangs the room. The client's only
  // move is to reload and pick up the current build.
  relay_outdated_client: (payload: { serverVersion: number }) => void;
  // Reply to relay_time_sync. `clientSentAt` is echoed back untouched so the
  // client can compute this sample's round trip; `serverNow` is the server's
  // wall clock at the moment it replied.
  relay_time_sync_result: (payload: { clientSentAt: number; serverNow: number }) => void;
}

export interface RelayClientToServerEvents {
  // protocolVersion is optional only so the type admits the builds that
  // predate it — the server treats a missing value as "too old" rather than
  // as "skip the check", which is exactly the case that has to be caught.
  join_relay_room: (payload: { code: string; name: string; password?: string; protocolVersion?: number }) => void;
  leave_relay_room: (payload: { code: string }) => void;
  relay_start_room: (payload: { code: string }) => void; // host-only: LOBBY -> ASSIGNING
  relay_assign_event: (payload: { code: string; legId: string; participantId: string | null }) => void;
  // Approve/withdraw approval of the event distribution. Gates leaving the
  // ASSIGNING screen; does NOT by itself start anything.
  relay_toggle_ready: (payload: { code: string; isReady: boolean }) => void;
  // "Cube in hand, count me down" — pressed on the start screen, with the
  // scramble already visible. Only once every participant has sent this does
  // the server arm the countdown.
  relay_toggle_start_ready: (payload: { code: string; isReady: boolean }) => void;
  // NTP-style clock-offset probe. Relay clocks are shared across machines, so
  // every client has to render elapsed time against the *server's* clock, not
  // its own — see useRelaySocket's offset estimate.
  relay_time_sync: (payload: { clientSentAt: number }) => void;
  // `at` is the presser's own best estimate (in server-clock terms) of when
  // they actually stopped. Sent so the recorded total matches the number that
  // was on screen at that moment instead of including the trip to the server;
  // the server clamps it to a plausible window rather than trusting it.
  relay_mark_done: (payload: { code: string; at?: number }) => void;
  // host-only, room.status === 'FINISHED': back to ASSIGNING, keeping the
  // existing event assignments so the host can rearrange them — resets
  // everyone's ready/done state, since the assignments might change.
  relay_adjust_distribution: (payload: { code: string }) => void;
  // host-only, room.status === 'FINISHED': back to ASSIGNING with the exact
  // same assignments and everyone already marked ready (nothing changed, so
  // there's nothing to re-confirm) — goes straight into a fresh countdown
  // once the new scrambles land.
  relay_run_again: (payload: { code: string }) => void;
}
