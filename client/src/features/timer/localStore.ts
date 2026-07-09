import type { SessionDTO, SolveDTO, Penalty } from '@scc/shared';

// Guest persistence in localStorage (no account). Mirrors the server DTO shapes.
const SKEY = 'scc-guest-data';

interface GuestData {
  sessions: SessionDTO[];
  solves: Record<string, SolveDTO[]>; // sessionId -> solves (newest first)
}

function read(): GuestData {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return JSON.parse(raw) as GuestData;
  } catch {
    /* ignore */
  }
  return { sessions: [], solves: {} };
}

function write(data: GuestData) {
  localStorage.setItem(SKEY, JSON.stringify(data));
}

function uid() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

export const guestStore = {
  listSessions(): SessionDTO[] {
    return read().sessions;
  },
  createSession(name: string, eventId: string): SessionDTO {
    const data = read();
    const session: SessionDTO = {
      id: uid(),
      userId: 'guest',
      eventId,
      name,
      createdAt: new Date().toISOString(),
      solveCount: 0,
    };
    data.sessions.unshift(session);
    data.solves[session.id] = [];
    write(data);
    return session;
  },
  renameSession(id: string, name: string) {
    const data = read();
    const s = data.sessions.find((x) => x.id === id);
    if (s) s.name = name;
    write(data);
  },
  deleteSession(id: string) {
    const data = read();
    data.sessions = data.sessions.filter((s) => s.id !== id);
    delete data.solves[id];
    write(data);
  },
  listSolves(sessionId: string): SolveDTO[] {
    return read().solves[sessionId] ?? [];
  },
  addSolve(sessionId: string, time: number, penalty: Penalty, scramble: string): SolveDTO {
    const data = read();
    const solve: SolveDTO = {
      id: uid(),
      sessionId,
      userId: 'guest',
      time,
      penalty,
      scramble,
      createdAt: new Date().toISOString(),
    };
    (data.solves[sessionId] ??= []).unshift(solve);
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s) s.solveCount = (s.solveCount ?? 0) + 1;
    write(data);
    return solve;
  },
  updatePenalty(sessionId: string, solveId: string, penalty: Penalty) {
    const data = read();
    const solve = data.solves[sessionId]?.find((x) => x.id === solveId);
    if (solve) solve.penalty = penalty;
    write(data);
  },
  updateTime(sessionId: string, solveId: string, time: number) {
    const data = read();
    const solve = data.solves[sessionId]?.find((x) => x.id === solveId);
    if (solve) solve.time = time;
    write(data);
  },
  // Bulk insert (e.g. an import) — unlike addSolve, entries may predate or
  // postdate existing solves, so the merged list is re-sorted by actual
  // timestamp rather than assumed to already be newest-first.
  addSolvesBulk(
    sessionId: string,
    entries: { time: number; penalty: Penalty; scramble: string; createdAt: string }[],
  ): SolveDTO[] {
    const data = read();
    const newSolves: SolveDTO[] = entries.map((e) => ({
      id: uid(),
      sessionId,
      userId: 'guest',
      time: e.time,
      penalty: e.penalty,
      scramble: e.scramble,
      createdAt: e.createdAt,
    }));
    const existing = data.solves[sessionId] ?? [];
    const merged = [...existing, ...newSolves].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    data.solves[sessionId] = merged;
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s) s.solveCount = merged.length;
    write(data);
    return newSolves;
  },
  deleteSolve(sessionId: string, solveId: string) {
    const data = read();
    if (data.solves[sessionId]) {
      data.solves[sessionId] = data.solves[sessionId].filter((x) => x.id !== solveId);
    }
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s && s.solveCount) s.solveCount -= 1;
    write(data);
  },
  deleteSolvesBulk(sessionId: string, solveIds: string[]) {
    const data = read();
    if (data.solves[sessionId]) {
      const idSet = new Set(solveIds);
      const before = data.solves[sessionId].length;
      data.solves[sessionId] = data.solves[sessionId].filter((x) => !idSet.has(x.id));
      const removed = before - data.solves[sessionId].length;
      const s = data.sessions.find((x) => x.id === sessionId);
      if (s && s.solveCount) s.solveCount = Math.max(0, s.solveCount - removed);
    }
    write(data);
  },
};
