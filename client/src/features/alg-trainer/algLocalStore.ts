import type { AlgSolveDTO, Penalty } from '@scc/shared';

// Guest persistence in localStorage (no account). Mirrors the server DTO
// shape, keyed by algorithm-set id instead of a timer session id — see
// features/timer/localStore.ts for the pattern this follows.
const SKEY = 'scc-guest-alg-solves';

type GuestAlgData = Record<string, AlgSolveDTO[]>; // setId -> solves (newest first)

function read(): GuestAlgData {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return JSON.parse(raw) as GuestAlgData;
  } catch {
    /* ignore */
  }
  return {};
}

function write(data: GuestAlgData) {
  localStorage.setItem(SKEY, JSON.stringify(data));
}

function uid() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

export const guestAlgStore = {
  listSolves(setId: string): AlgSolveDTO[] {
    return read()[setId] ?? [];
  },
  addSolve(setId: string, caseId: string, time: number, penalty: Penalty, plusTwoCount: number, scramble: string): AlgSolveDTO {
    const data = read();
    const solve: AlgSolveDTO = {
      id: uid(),
      userId: 'guest',
      setId,
      caseId,
      time,
      penalty,
      plusTwoCount: penalty === 'DNF' ? 0 : plusTwoCount,
      scramble,
      createdAt: new Date().toISOString(),
    };
    (data[setId] ??= []).unshift(solve);
    write(data);
    return solve;
  },
  updatePenalty(setId: string, solveId: string, penalty: Penalty, plusTwoCount: number) {
    const data = read();
    const solve = data[setId]?.find((x) => x.id === solveId);
    if (solve) {
      solve.penalty = penalty;
      solve.plusTwoCount = penalty === 'DNF' ? 0 : plusTwoCount;
    }
    write(data);
  },
  updateTime(setId: string, solveId: string, time: number) {
    const data = read();
    const solve = data[setId]?.find((x) => x.id === solveId);
    if (solve) solve.time = time;
    write(data);
  },
  deleteSolve(setId: string, solveId: string) {
    const data = read();
    if (data[setId]) {
      data[setId] = data[setId].filter((x) => x.id !== solveId);
    }
    write(data);
  },
};

// Guest persistence of which cases were last selected to drill in a set —
// separate key from solves since it's a different concern (one snapshot per
// set, not an append-only history).
const SELECTION_KEY = 'scc-guest-alg-selection';

type GuestSelectionData = Record<string, string[]>; // setId -> caseIds

function readSelection(): GuestSelectionData {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (raw) return JSON.parse(raw) as GuestSelectionData;
  } catch {
    /* ignore */
  }
  return {};
}

export const guestAlgSelectionStore = {
  get(setId: string): string[] | null {
    return readSelection()[setId] ?? null;
  },
  set(setId: string, caseIds: string[]) {
    const data = readSelection();
    data[setId] = caseIds;
    localStorage.setItem(SELECTION_KEY, JSON.stringify(data));
  },
};
