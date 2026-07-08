// Shared types and constants used by both the client and the server.

export * from './averaging.js';

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
  { id: '444', name: '4x4', scrambowType: '444' },
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

export interface GoalDTO {
  eventId: string;
  targetTime: number;
}

export interface DailyScrambleDTO {
  id: string;
  date: string;
  eventId: string;
  scramble: string;
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

export interface DailyLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  wcaId?: string | null;
  time: number;
  penalty: Penalty;
}

export interface BattleParticipantDTO {
  id: string;
  userId?: string | null;
  name: string;
  points: number;
  time?: number | null;
  penalty?: Penalty | null;
  finishedAt?: string | null;
}

export interface BattleRoomDTO {
  id: string;
  code: string;
  name: string;
  eventId: string;
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

export interface ServerToClientEvents {
  room_state: (room: BattleRoomDTO) => void;
  round_start: (payload: { scramble: string; roundNumber: number }) => void;
  participant_finished: (payload: { participantId: string; name: string; time: number | null; penalty: Penalty | null }) => void;
  round_result: (payload: { results: BattleRoundResultEntry[]; roundNumber: number }) => void;
  error_msg: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (payload: { code: string; userId?: string; name: string; password?: string }) => void;
  solve_complete: (payload: { code: string; time: number; penalty: Penalty }) => void;
  leave_room: (payload: { code: string }) => void;
}

// Effective solve time given a penalty. DNF returns Infinity.
export function effectiveTime(time: number, penalty: Penalty): number {
  if (penalty === 'DNF') return Infinity;
  if (penalty === 'PLUS2') return time + 2000;
  return time;
}

// Format milliseconds as a cube timer string, e.g. 12345 -> "12.35", 73210 -> "1:13.21".
// `decimals` controls displayed precision (2 = centiseconds, 3 = milliseconds).
export function formatTime(
  ms: number | null | undefined,
  penalty: Penalty = 'NONE',
  decimals = 2,
): string {
  if (penalty === 'DNF') return 'DNF';
  if (ms === null || ms === undefined || !isFinite(ms)) return 'DNF';
  const withPenalty = penalty === 'PLUS2' ? ms + 2000 : ms;
  const totalSeconds = withPenalty / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secStr = seconds.toFixed(decimals).padStart(decimals + 3, '0');
  const base = minutes > 0 ? `${minutes}:${secStr}` : seconds.toFixed(decimals);
  return penalty === 'PLUS2' ? `${base}+` : base;
}
