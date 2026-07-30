import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionDTO, SolveDTO, Penalty } from '@scc/shared';

// Guest (not-logged-in) persistence, the mobile equivalent of
// client/src/features/timer/localStore.ts. Same DTO shapes, same semantics,
// same "newest first" ordering.
//
// The web version reads and writes localStorage synchronously on every call.
// AsyncStorage has no synchronous API, so this keeps the whole (small) dataset
// in memory and writes through asynchronously: `hydrate()` loads it once at
// boot, every read is served from memory, and every mutation updates memory
// then schedules a save. That keeps the call signatures synchronous, which is
// what lets useTimerData below stay a near-verbatim port of the web hook
// instead of a differently-shaped async rewrite.
//
// Note this only ever holds *guest* data. A logged-in user's solves are never
// cached here. They're read from and written to the server on every operation,
// which is what guarantees a user sees the same solves on web and on mobile.
const SKEY = 'scc-guest-data';

interface GuestData {
  sessions: SessionDTO[];
  solves: Record<string, SolveDTO[]>;
}

let data: GuestData = { sessions: [], solves: {} };
let hydrated = false;

// Coalesces bursts of writes (e.g. a bulk import) into one serialization.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function write(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(SKEY, JSON.stringify(data)).catch(() => {
      /* out of disk / storage unavailable, in-memory state still works */
    });
  }, 150);
}

export async function hydrateGuestStore(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(SKEY);
    if (raw) data = JSON.parse(raw) as GuestData;
  } catch {
    data = { sessions: [], solves: {} };
  }
  hydrated = true;
}

function uid(): string {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

// Reads hand out copies, never live references into `data`.
//
// This store keeps its state in memory (unlike the web client's, which re-reads
// and re-parses localStorage on every call and so returns fresh objects for
// free). Returning the stored objects directly aliased them into React state,
// and the mutating writers below then changed state out from under React. That
// produced a real bug: addSolve incremented solveCount on the stored object, and
// useTimerData's optimistic update then read that already-incremented value and
// added one again, so a session with two solves reported four.
export const guestStore = {
  listSessions(): SessionDTO[] {
    return data.sessions.map((s) => ({ ...s }));
  },
  createSession(name: string, eventId: string, subset?: string): SessionDTO {
    const session: SessionDTO = {
      id: uid(),
      userId: 'guest',
      eventId,
      name,
      subset: subset ?? null,
      createdAt: new Date().toISOString(),
      solveCount: 0,
    };
    data.sessions.unshift(session);
    data.solves[session.id] = [];
    write();
    return { ...session };
  },
  renameSession(id: string, name: string): void {
    const s = data.sessions.find((x) => x.id === id);
    if (s) s.name = name;
    write();
  },
  deleteSession(id: string): void {
    data.sessions = data.sessions.filter((s) => s.id !== id);
    delete data.solves[id];
    write();
  },
  listSolves(sessionId: string): SolveDTO[] {
    return (data.solves[sessionId] ?? []).map((s) => ({ ...s }));
  },
  addSolve(
    sessionId: string,
    time: number,
    penalty: Penalty,
    plusTwoCount: number,
    scramble: string,
    solution?: string,
  ): SolveDTO {
    const solve: SolveDTO = {
      id: uid(),
      sessionId,
      userId: 'guest',
      time,
      penalty,
      plusTwoCount: penalty === 'DNF' ? 0 : plusTwoCount,
      scramble,
      solution,
      createdAt: new Date().toISOString(),
    };
    (data.solves[sessionId] ??= []).unshift(solve);
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s) s.solveCount = (s.solveCount ?? 0) + 1;
    write();
    return { ...solve };
  },
  updatePenalty(sessionId: string, solveId: string, penalty: Penalty, plusTwoCount: number): void {
    const solve = data.solves[sessionId]?.find((x) => x.id === solveId);
    if (solve) {
      solve.penalty = penalty;
      solve.plusTwoCount = penalty === 'DNF' ? 0 : plusTwoCount;
    }
    write();
  },
  updateTime(sessionId: string, solveId: string, time: number): void {
    const solve = data.solves[sessionId]?.find((x) => x.id === solveId);
    if (solve) solve.time = time;
    write();
  },
  updateComment(sessionId: string, solveId: string, comment: string): void {
    const solve = data.solves[sessionId]?.find((x) => x.id === solveId);
    if (solve) solve.comment = comment.trim() || undefined;
    write();
  },
  deleteSolve(sessionId: string, solveId: string): void {
    if (data.solves[sessionId]) {
      data.solves[sessionId] = data.solves[sessionId].filter((x) => x.id !== solveId);
    }
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s && s.solveCount) s.solveCount -= 1;
    write();
  },
  deleteSolvesBulk(sessionId: string, solveIds: string[]): void {
    if (data.solves[sessionId]) {
      const idSet = new Set(solveIds);
      const before = data.solves[sessionId].length;
      data.solves[sessionId] = data.solves[sessionId].filter((x) => !idSet.has(x.id));
      const removed = before - data.solves[sessionId].length;
      const s = data.sessions.find((x) => x.id === sessionId);
      if (s && s.solveCount) s.solveCount = Math.max(0, s.solveCount - removed);
    }
    write();
  },
};
