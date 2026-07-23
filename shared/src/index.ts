// Shared types and constants used by both the client and the server.

export * from './averaging.js';
export * from './algScramble.js';
export * from './relays.js';

import type { RelayServerToClientEvents, RelayClientToServerEvents } from './relays.js';

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
  // FMC scrambles are ordinary random-state 3x3 scrambles (cubing.js's own
  // event registry maps '333fm' to the same puzzleID/scramble type as
  // '333' — see server/src/scramble.ts's getScramble, which needs no
  // special-casing here since this id is passed straight through to both
  // cubing.js and scrambow). scrambowType reuses '333' for the same reason.
  { id: '333fm', name: 'FMC', scrambowType: '333' },
];

// FMC's input/scoring model (a 1-hour time limit, move-count results
// instead of a stopwatch time, solution verification) only makes sense on
// the Timer page — Battle, Relays, Reconstruction, and the Algorithm
// Library all assume a normal timed single solve. Rather than hardcoding
// '333fm' as a magic string in every feature's own event-list filter, this
// is the one place that decision lives; each feature's picker excludes
// whatever's listed here (see EventSelector's excludeIds, EventPicker's
// explicit allowlist which already excludes it implicitly, and
// ReconstructionPage's own filter).
export const TIMER_ONLY_EVENT_IDS = ['333fm'];

// No random-state 3x3 scramble is solvable in fewer moves than this — used
// to floor BPA/target-move-count projections at a value that's actually
// reachable, instead of the idealized-but-impossible 0 every time-based
// event's equivalent projection uses (see client/src/features/timer/stats.ts's
// `minValue` param).
export const FMC_MIN_MOVES = 15;

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
  // FMC only: the move sequence that was actually submitted. Undefined for
  // every other event, and for an FMC solve that was given up on or timed
  // out before a solution was ever submitted.
  solution?: string;
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

export interface ServerToClientEvents extends RelayServerToClientEvents {
  room_state: (room: BattleRoomDTO) => void;
  round_start: (payload: { scramble: string; roundNumber: number }) => void;
  participant_finished: (payload: { participantId: string; name: string; time: number | null; penalty: Penalty | null }) => void;
  round_result: (payload: { results: BattleRoundResultEntry[]; roundNumber: number }) => void;
  chat_message: (payload: ChatMessageDTO) => void;
  error_msg: (payload: { message: string }) => void;
}

export interface ClientToServerEvents extends RelayClientToServerEvents {
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

// FMC results are a move count, not a time — SolveDTO's `time` field is
// reused to hold that count (in whole moves, not milliseconds) rather than
// adding a parallel field just for one event, since every other consumer
// of a solve (averaging, DNF handling, PB detection) only cares that
// "lower is better" and already works on a bare number regardless of unit.
// This formatter is the one place that number gets displayed as what it
// actually is — callers that already know they're rendering an FMC solve
// should use this instead of formatTime. FMC never carries a PLUS2 penalty
// (see the Timer page's FMC input flow, which only ever submits NONE or
// DNF), but the check is here anyway since penalty is still a plain
// Penalty value that could in principle be anything.
//
// `decimals` defaults to 0 (a single solve is always a whole move count —
// every existing 2-arg call site keeps that behavior unchanged) but callers
// formatting a mean/average (mo3, ao5, ...) pass 2, matching WCA's own
// convention of reporting FMC means to 2 decimal places even though no
// individual solve ever has a fractional move count.
export function formatMoveCount(moves: number | null | undefined, penalty: Penalty = 'NONE', decimals = 0): string {
  if (penalty === 'DNF') return 'DNF';
  if (moves === null || moves === undefined || !isFinite(moves)) return 'DNF';
  return decimals > 0 ? moves.toFixed(decimals) : String(Math.round(moves));
}
