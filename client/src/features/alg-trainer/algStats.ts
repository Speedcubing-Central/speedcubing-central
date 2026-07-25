import { effectiveTime, type AlgSolveDTO } from '@scc/shared';

export interface CaseStats {
  setId: string;
  caseId: string;
  count: number;
  pb: AlgSolveDTO | null; // solve with the best effective time; null only if every attempt is DNF
  mostRecent: AlgSolveDTO;
}

// Case ids are unique within their own set but not guaranteed unique
// *across* sets (most sets prefix their ids, e.g. "OLL1", but PLL's are
// bare short strings like "Ua" or "H") — grouping by bare caseId alone
// would silently merge two unrelated cases' solve histories together the
// moment a Trainer session (or the Stats page) ever combines a set with a
// colliding id. Keying by setId+caseId costs nothing when there's only one
// set in play and is the only thing that's actually safe once there's more
// than one — use statsKey to look entries up consistently.
export function statsKey(setId: string, caseId: string): string {
  return `${setId}:${caseId}`;
}

// Per-case attempt count / PB / most-recent, derived from the full solve
// history rather than stored — same "recompute from history" convention as
// features/timer/stats.ts. `solves` must be newest-first (both the server
// and the guest store already return them that way), so the first attempt
// seen per case is its most recent one.
export function statsByCase(solves: AlgSolveDTO[]): Map<string, CaseStats> {
  const map = new Map<string, CaseStats>();
  for (const s of solves) {
    const key = statsKey(s.setId, s.caseId);
    let entry = map.get(key);
    if (!entry) {
      entry = { setId: s.setId, caseId: s.caseId, count: 0, pb: null, mostRecent: s };
      map.set(key, entry);
    }
    entry.count += 1;
    const eff = effectiveTime(s.time, s.penalty, s.plusTwoCount);
    if (eff < (entry.pb ? effectiveTime(entry.pb.time, entry.pb.penalty, entry.pb.plusTwoCount) : Infinity)) {
      entry.pb = s;
    }
  }
  return map;
}

export function summarize(solves: AlgSolveDTO[]): { count: number; caseCount: number } {
  return { count: solves.length, caseCount: new Set(solves.map((s) => statsKey(s.setId, s.caseId))).size };
}
