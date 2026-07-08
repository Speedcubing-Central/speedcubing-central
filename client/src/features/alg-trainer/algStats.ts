import { effectiveTime, type AlgSolveDTO } from '@scc/shared';

export interface CaseStats {
  caseId: string;
  count: number;
  pb: AlgSolveDTO | null; // solve with the best effective time; null only if every attempt is DNF
  mostRecent: AlgSolveDTO;
}

// Per-case attempt count / PB / most-recent, derived from the full solve
// history rather than stored — same "recompute from history" convention as
// features/timer/stats.ts. `solves` must be newest-first (both the server
// and the guest store already return them that way), so the first attempt
// seen per case is its most recent one.
export function statsByCase(solves: AlgSolveDTO[]): Map<string, CaseStats> {
  const map = new Map<string, CaseStats>();
  for (const s of solves) {
    let entry = map.get(s.caseId);
    if (!entry) {
      entry = { caseId: s.caseId, count: 0, pb: null, mostRecent: s };
      map.set(s.caseId, entry);
    }
    entry.count += 1;
    const eff = effectiveTime(s.time, s.penalty);
    if (eff < (entry.pb ? effectiveTime(entry.pb.time, entry.pb.penalty) : Infinity)) {
      entry.pb = s;
    }
  }
  return map;
}

export function summarize(solves: AlgSolveDTO[]): { count: number; caseCount: number } {
  return { count: solves.length, caseCount: new Set(solves.map((s) => s.caseId)).size };
}
