import type { SolveDTO } from '@scc/shared';
import { trimmedAverage, mean, effectiveTime, type TimedSolve } from '@scc/shared';

export const AVERAGE_SIZES = [3, 5, 12, 50, 100] as const;
export type AvgSize = (typeof AVERAGE_SIZES)[number];

const toTimed = (s: SolveDTO): TimedSolve => ({ time: s.time, penalty: s.penalty });

// Infinity is used to represent a DNF average (sorts last, formats as "DNF").
function avgValue(window: TimedSolve[]): number | null {
  const r = trimmedAverage(window);
  if (r.isDNF) return Infinity;
  return r.value;
}

export interface SingleStats {
  count: number;
  best: number | null;
  worst: number | null;
}

export function singleStats(solves: SolveDTO[]): SingleStats {
  const finite = solves.map((s) => effectiveTime(s.time, s.penalty)).filter((v) => isFinite(v));
  return {
    count: solves.length,
    best: finite.length ? Math.min(...finite) : null,
    worst: finite.length ? Math.max(...finite) : null,
  };
}

function computeAvg(window: TimedSolve[], size: number) {
  return size === 3 ? mean(window) : trimmedAverage(window);
}

// Current rolling average of the most recent `size` solves (newest-first list).
export function currentAverage(solves: SolveDTO[], size: number): number | null {
  if (solves.length < size) return null;
  const r = computeAvg(solves.slice(0, size).map(toTimed), size);
  if (r.isDNF) return Infinity;
  return r.value;
}

// Best average of `size` across the whole session, plus the index (in the
// newest-first list) it starts at — combined into one O(n·size) pass since
// computing them separately (and a third time inside targetForBest) was the
// single biggest cost in StatsTable for sessions with thousands of solves.
export function bestAverageWithIndex(solves: SolveDTO[], size: number): { value: number | null; index: number | null } {
  let best: number | null = null;
  let idx: number | null = null;
  for (let i = 0; i + size <= solves.length; i++) {
    const r = computeAvg(solves.slice(i, i + size).map(toTimed), size);
    if (r.value !== null && (best === null || r.value < best)) {
      best = r.value;
      idx = i;
    }
  }
  return { value: best, index: idx };
}

// Best average of `size` across the whole session.
export function bestAverage(solves: SolveDTO[], size: number): number | null {
  return bestAverageWithIndex(solves, size).value;
}

// Start index (in the newest-first list) of the best average of `size`.
export function bestAverageIndex(solves: SolveDTO[], size: number): number | null {
  return bestAverageWithIndex(solves, size).index;
}

// Index of the best (fastest, non-DNF) single.
export function bestSingleIndex(solves: SolveDTO[]): number | null {
  let best: number | null = null;
  let idx: number | null = null;
  solves.forEach((s, i) => {
    const t = effectiveTime(s.time, s.penalty);
    if (isFinite(t) && (best === null || t < best)) {
      best = t;
      idx = i;
    }
  });
  return idx;
}

// BPA / WPA for the in-progress average (most recent size-1 solves + a hypothetical).
function projected(solves: SolveDTO[], size: number, hypothetical: TimedSolve): number | null {
  if (solves.length < size - 1) return null;
  const win = solves.slice(0, size - 1).map(toTimed);
  const r = computeAvg([...win, hypothetical], size);
  if (r.isDNF) return Infinity;
  return r.value;
}

export function bpa(solves: SolveDTO[], size: number): number | null {
  return projected(solves, size, { time: 0, penalty: 'NONE' });
}

// Mo3: any DNF = DNF, so WPA is always DNF and therefore not useful to show.
export function wpa(solves: SolveDTO[], size: number): number | null {
  if (size === 3) return null;
  return projected(solves, size, { time: 0, penalty: 'DNF' });
}

// Largest single (ms) on the next solve that would still beat the session best.
// Returns null if no best yet or beating it is impossible even with a perfect solve.
// `precomputedBest` lets buildStatsTable pass in a value it already computed
// instead of this doing its own extra O(n·size) pass to find it again.
export function targetForBest(solves: SolveDTO[], size: number, precomputedBest?: number | null): number | null {
  const best = precomputedBest !== undefined ? precomputedBest : bestAverage(solves, size);
  if (best === null || solves.length < size - 1) return null;
  const win = solves.slice(0, size - 1).map(toTimed);
  const avgAt = (x: number) => {
    const r = computeAvg([...win, { time: x, penalty: 'NONE' as const }], size);
    if (r.isDNF) return Infinity;
    return r.value ?? Infinity;
  };
  if (avgAt(0) >= best) return null; // can't PB even with a perfect solve
  let lo = 0;
  let hi = Math.max(best * size, 600000);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (avgAt(mid) < best) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

export interface AvgRow {
  size: AvgSize;
  current: number | null;
  best: number | null;
  bestIndex: number | null;
  bpa: number | null;
  wpa: number | null;
  target: number | null;
}

export function buildStatsTable(solves: SolveDTO[]): AvgRow[] {
  return AVERAGE_SIZES.map((size) => {
    const { value: best, index: bestIndex } = bestAverageWithIndex(solves, size);
    return {
      size,
      current: currentAverage(solves, size),
      best,
      bestIndex,
      bpa: bpa(solves, size),
      wpa: wpa(solves, size),
      target: targetForBest(solves, size, best),
    };
  });
}

// The `size` solves whose rolling average "belongs" to the solve at `index`
// (newest-first list): the completing solve plus the size-1 before it.
export function windowEndingAt(solves: SolveDTO[], index: number, size: number): SolveDTO[] | null {
  if (index + size > solves.length) return null;
  return solves.slice(index, index + size);
}

export interface SolveAverage {
  size: AvgSize;
  value: number | null;
  window: SolveDTO[];
  droppedIndices: number[];
}

// Build a SolveAverage view for a window of `size` starting at `startIndex`.
export function makeAverageView(solves: SolveDTO[], startIndex: number, size: AvgSize): SolveAverage | null {
  const window = windowEndingAt(solves, startIndex, size);
  if (!window) return null;
  const r = computeAvg(window.map(toTimed), size);
  return { size, value: r.isDNF ? Infinity : r.value, window, droppedIndices: r.droppedIndices };
}

// Averages (mo3/ao5/ao12/…) that were current at the moment the given solve completed.
export function averagesForSolve(solves: SolveDTO[], index: number): SolveAverage[] {
  const out: SolveAverage[] = [];
  for (const size of AVERAGE_SIZES) {
    const window = windowEndingAt(solves, index, size);
    if (!window) continue;
    const r = computeAvg(window.map(toTimed), size);
    out.push({ size, value: r.isDNF ? Infinity : r.value, window, droppedIndices: r.droppedIndices });
  }
  return out;
}
