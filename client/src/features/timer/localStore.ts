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
  deleteSolve(sessionId: string, solveId: string) {
    const data = read();
    if (data.solves[sessionId]) {
      data.solves[sessionId] = data.solves[sessionId].filter((x) => x.id !== solveId);
    }
    const s = data.sessions.find((x) => x.id === sessionId);
    if (s && s.solveCount) s.solveCount -= 1;
    write(data);
  },
};
