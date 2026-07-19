// Shared types and constants used by both the client and the server.

export * from './averaging.js';
export * from './algScramble.js';

export type Role = 'GUEST' | 'USER';
export type Penalty = 'NONE' | 'PLUS2' | 'DNF';
export type BattleStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';

export interface WcaEvent {
  id: string;
  name: string;
  scrambowType: string; // passed to scrambow's Scrambow().setType(); '' = no scrambow support
}

export const WCA_EVENTS: WcaEvent[] = [
  { id: '222', name: '2x2', scrambowType: '222' },
  { id: '333', name: '3x3', scrambowType: '333' },
  // scrambowType is deliberately '' (not '444'): scrambow's 4x4 generator is
  // a random-move picker whose own anti-redundancy filtering is dead code
  // (see server/src/scramble.ts's SCRAMBOW_PREFERRED comment), so this event
  // must never be able to reach it — same "always random-state or keep
  // trying" policy already used for kilominx/fto/redi_cube below.
  { id: '444', name: '4x4', scrambowType: '' },
  { id: '555', name: '5x5', scrambowType: '555' },
  { id: '666', name: '6x6', scrambowType: '666' },
  { id: '777', name: '7x7', scrambowType: '777' },
  { id: '333oh', name: '3x3 One-Handed', scrambowType: '333' },
  { id: '333bf', name: '3x3 Blindfolded', scrambowType: '333' },
  { id: '444bf', name: '4x4 Blindfolded', scrambowType: '444' },
  { id: '555bf', name: '5x5 Blindfolded', scrambowType: '555' },
  { id: 'minx', name: 'Megaminx', scrambowType: 'minx' },
  { id: 'pyram', name: 'Pyraminx', scrambowType: 'pyram' },
  { id: 'clock', name: 'Clock', scrambowType: 'clock' },
  { id: 'skewb', name: 'Skewb', scrambowType: 'skewb' },
  { id: 'sq1', name: 'Square-1', scrambowType: 'sq1' },
];

export const UNOFFICIAL_EVENTS: WcaEvent[] = [
  { id: 'kilominx', name: 'Kilominx', scrambowType: '' },
  { id: 'fto', name: 'FTO', scrambowType: '' },
  { id: 'redi_cube', name: 'Redi Cube', scrambowType: '' },
];

export const ALL_EVENTS: WcaEvent[] = [...WCA_EVENTS, ...UNOFFICIAL_EVENTS];

// Collapse any run of whitespace to a single space (some generators double-space).
export function normalizeScramble(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export const EVENT_IDS = ALL_EVENTS.map((e) => e.id);

export function getEvent(id: string): WcaEvent | undefined {
  return ALL_EVENTS.find((e) => e.id === id);
}

// ---- API DTOs ----

export interface PublicUser {
  id: string;
  email?: string | null;
  wcaId?: string | null;
  displayName: string;
  country?: string | null;
  avatarUrl?: string | null;
  role: Role;
  createdAt: string;
}

export interface SolveDTO {
  id: string;
  sessionId: string;
  userId: string;
  time: number; // milliseconds
  penalty: Penalty;
  scramble: string;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  userId: string;
  eventId: string;
  name: string;
  createdAt: string;
  solveCount?: number;
}

// A timed attempt at one algorithm-library case (Trainer tab), scoped to
// (user, set, case) — unlike SolveDTO's session scoping, this has full
// history per case so PBs/stats are meaningful.
export interface AlgSolveDTO {
  id: string;
  userId: string;
  setId: string;
  caseId: string;
  time: number; // milliseconds
  penalty: Penalty;
  scramble: string;
  createdAt: string;
}

export interface ReconstructionDTO {
  id: string;
  userId: string;
  title: string;
  eventId: string;
  scramble: string;
  solution: string;
  timeMs: number | null;
  createdAt: string;
}

export interface BattleParticipantDTO {
  id: string;
  userId?: string | null;
  name: string;
  points: number;
  time?: number | null;
  penalty?: Penalty | null;
  finishedAt?: string | null;
  // Whether this participant is the current room host — see BattleRoom's
  // hostParticipantId. Whoever created the room starts as host; if they
  // leave, it passes to whoever's been in the room longest.
  isHost: boolean;
}

export interface BattleRoomDTO {
  id: string;
  code: string;
  name: string;
  eventId: string;
  // Non-null only for an algorithm-set battle (e.g. "PLL") — each round then
  // draws a random case+AUF from that set instead of a full scramble for
  // eventId. eventId is still always a valid puzzle id ('333'/'222') in this
  // case too, derived server-side from the set, purely so scramble
  // rendering keeps working unmodified. See shared/src/algScramble.ts.
  algSetId: string | null;
  isPublic: boolean;
  scramble: string;
  roundNumber: number;
  status: BattleStatus;
  participants: BattleParticipantDTO[];
}

export interface BattlePublicRoomDTO {
  code: string;
  name: string;
  eventId: string;
  algSetId: string | null;
  participantCount: number;
  status: BattleStatus;
}

export interface BattleRoundResultEntry {
  participantId: string;
  name: string;
  time: number | null;
  penalty: Penalty | null;
  rank: number;
  pointsEarned: number;
  totalPoints: number;
}

// ---- Socket.io event payloads ----

export interface ChatMessageDTO {
  participantId: string;
  name: string;
  message: string;
  sentAt: string;
}

export interface ServerToClientEvents {
  room_state: (room: BattleRoomDTO) => void;
  round_start: (payload: { scramble: string; roundNumber: number }) => void;
  participant_finished: (payload: { participantId: string; name: string; time: number | null; penalty: Penalty | null }) => void;
  round_result: (payload: { results: BattleRoundResultEntry[]; roundNumber: number }) => void;
  chat_message: (payload: ChatMessageDTO) => void;
  error_msg: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  // userId is intentionally not part of this payload — the server derives
  // identity from the caller's verified access_token cookie (see
  // server/src/socket.ts), never from a client-supplied field.
  join_room: (payload: { code: string; name: string; password?: string }) => void;
  solve_complete: (payload: { code: string; time: number; penalty: Penalty }) => void;
  leave_room: (payload: { code: string }) => void;
  // Host-only: switch the room to a different event/algorithm set. Allowed
  // even mid-round — see server/src/socket.ts.
  change_event: (payload: { code: string; eventId: string; algSetId?: string }) => void;
  send_chat_message: (payload: { code: string; message: string }) => void;
}

// Effective solve time given a penalty. DNF returns Infinity.
export function effectiveTime(time: number, penalty: Penalty): number {
  if (penalty === 'DNF') return Infinity;
  if (penalty === 'PLUS2') return time + 2000;
  return time;
}

// Format milliseconds as a cube timer string, e.g. 12345 -> "12.35", 73210 -> "1:13.21".
// `decimals` controls displayed precision (0 = whole seconds, 2 = centiseconds, 3 = milliseconds).
export function formatTime(
  ms: number | null | undefined,
  penalty: Penalty = 'NONE',
  decimals = 2,
): string {
  if (penalty === 'DNF') return 'DNF';
  if (ms === null || ms === undefined || !isFinite(ms)) return 'DNF';
  const withPenalty = penalty === 'PLUS2' ? ms + 2000 : ms;
  // Round to the displayed precision in whole milliseconds *before* splitting
  // into minutes/seconds/fraction — rounding each piece independently (the
  // previous approach) let a value like 59.9996s at 2 decimals round its
  // seconds part up to "60" without carrying into minutes, e.g. "1:60.00"
  // instead of "2:00.00". Rounding first means the carry always happens.
  const roundTo = 10 ** (3 - decimals);
  const rounded = Math.round(withPenalty / roundTo) * roundTo;
  const totalSeconds = Math.floor(rounded / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  // No decimal point at all when decimals is 0 — the old `padStart(decimals
  // + 3, '0')` assumed a "SS.ddd"-shaped string always existed, which broke
  // for decimals=0 (no dot to account for): e.g. formatTime(62690, ..., 0)
  // came out "1:003" instead of "1:03".
  const frac = decimals > 0 ? `.${String(rounded % 1000).padStart(3, '0').slice(0, decimals)}` : '';
  const base = minutes > 0 ? `${minutes}:${String(secs).padStart(2, '0')}${frac}` : `${secs}${frac}`;
  return penalty === 'PLUS2' ? `${base}+` : base;
}
