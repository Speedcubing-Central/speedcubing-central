import type { SolveDTO } from '@scc/shared';
import { trimmedAverage, mean, effectiveTime, type TimedSolve } from '@scc/shared';

export const AVERAGE_SIZES = [3, 5, 12, 50, 100, 1000] as const;
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

// Binary-search insert/remove into an ascending sorted array. O(size) per
// call (array splice), but that's still far cheaper than the full re-sort
// (O(size log size), with real per-comparison overhead) the naive version
// below used to pay for every single window position.
function sortedInsert(arr: number[], v: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, v);
}
function sortedRemove(arr: number[], v: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 1);
}

// Best average of `size` across the whole session, plus the index (in the
// newest-first list) it starts at. Slides a `size`-wide window across
// `solves` one solve at a time, maintaining a sorted copy of the current
// window incrementally (remove the outgoing solve, insert the incoming one)
// instead of re-sorting the whole window from scratch at every position —
// that naive O(n·size·log(size)) approach was the single biggest cost in
// StatsTable, taking several seconds once a session (and `size`, with
// ao1000) got large enough. This is O(n·size): still touches every solve in
// every window, but without the repeated full sort.
//
// A same-value tie for DNF is represented as Infinity throughout, and DNF
// status only depends on how many Infinities are in the window (`dnfCount
// > trim`) — if there are at most `trim` of them, every one necessarily
// falls in the top `trim` (dropped-worst) slice of the sorted window, since
// Infinity is the maximum possible value; there's no way for one to land in
// the kept range without exceeding that count. So dnfCount alone is enough,
// with no need to inspect the kept slice itself for a stray Infinity.
export function bestAverageWithIndex(solves: SolveDTO[], size: number): { value: number | null; index: number | null } {
  const n = solves.length;
  if (n < size) return { value: null, index: null };

  const eff = (s: SolveDTO) => effectiveTime(s.time, s.penalty);

  if (size === 3) {
    // Mo3: mean of all 3, no trimming — any DNF makes the whole thing DNF.
    let best: number | null = null;
    let idx: number | null = null;
    for (let i = 0; i + 3 <= n; i++) {
      const a = eff(solves[i]);
      const b = eff(solves[i + 1]);
      const c = eff(solves[i + 2]);
      if (isFinite(a) && isFinite(b) && isFinite(c)) {
        const value = (a + b + c) / 3;
        if (best === null || value < best) {
          best = value;
          idx = i;
        }
      }
    }
    return { value: best, index: idx };
  }

  const trim = Math.max(1, Math.ceil(size * 0.05));
  const keptCount = size - 2 * trim;
  let dnfCount = 0;
  const window: number[] = [];
  for (let k = 0; k < size; k++) {
    const v = eff(solves[k]);
    if (v === Infinity) dnfCount++;
    sortedInsert(window, v);
  }

  let best: number | null = null;
  let idx: number | null = null;
  const evalWindow = (start: number) => {
    if (dnfCount > trim) return;
    let sum = 0;
    for (let k = trim; k < size - trim; k++) sum += window[k];
    const value = sum / keptCount;
    if (best === null || value < best) {
      best = value;
      idx = start;
    }
  };

  evalWindow(0);
  for (let start = 1; start + size <= n; start++) {
    const outV = eff(solves[start - 1]);
    const inV = eff(solves[start + size - 1]);
    if (outV === Infinity) dnfCount--;
    sortedRemove(window, outV);
    if (inV === Infinity) dnfCount++;
    sortedInsert(window, inV);
    evalWindow(start);
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
  window: SolveDTO[]; // chronological order: first solve first, last solve last
  droppedIndices: number[]; // indices into `window` (chronological order)
}

// `window` (from windowEndingAt) and the dropped indices computed over it are
// both in the solves list's newest-first order — fine internally, but
// consumers (AverageDetail, the copy-to-clipboard formatter) display them
// numbered "1, 2, 3…" as if reading left-to-right through the solve, so they
// need chronological order instead. Reverse both here, once, rather than
// making every consumer remember to do it.
function toChronological(size: number, window: SolveDTO[], droppedIndices: number[]): { window: SolveDTO[]; droppedIndices: number[] } {
  return {
    window: [...window].reverse(),
    droppedIndices: droppedIndices.map((i) => size - 1 - i),
  };
}

// Build a SolveAverage view for a window of `size` starting at `startIndex`.
export function makeAverageView(solves: SolveDTO[], startIndex: number, size: AvgSize): SolveAverage | null {
  const window = windowEndingAt(solves, startIndex, size);
  if (!window) return null;
  const r = computeAvg(window.map(toTimed), size);
  return { size, value: r.isDNF ? Infinity : r.value, ...toChronological(size, window, r.droppedIndices) };
}

export type SolveSortBy = 'date' | 'single' | 'ao5' | 'ao12';

// Indices into `solves` (which stays newest-first and is never itself
// reordered — ao5/ao12 windows are computed from chronological adjacency,
// so the array order is load-bearing, not just a display choice), in the
// order they should be *displayed* for the given sort criterion. 'date' is
// the identity order (already newest-first). For 'single'/'ao5'/'ao12', a
// solve with no penalty-adjusted time (DNF) or without enough preceding
// history for the requested average sorts last (Infinity), matching the
// DNF-sorts-last convention used throughout this file.
export function sortedSolveIndices(solves: SolveDTO[], sortBy: SolveSortBy): number[] {
  const indices = solves.map((_, i) => i);
  if (sortBy === 'date') return indices;
  const valueAt = (i: number): number => {
    if (sortBy === 'single') {
      const t = effectiveTime(solves[i].time, solves[i].penalty);
      return isFinite(t) ? t : Infinity;
    }
    const view = makeAverageView(solves, i, sortBy === 'ao5' ? 5 : 12);
    if (!view || view.value === null) return Infinity;
    return view.value;
  };
  return indices
    .map((i) => ({ i, v: valueAt(i) }))
    .sort((a, b) => a.v - b.v)
    .map(({ i }) => i);
}

// Averages (mo3/ao5/ao12/…) that were current at the moment the given solve completed.
export function averagesForSolve(solves: SolveDTO[], index: number): SolveAverage[] {
  const out: SolveAverage[] = [];
  for (const size of AVERAGE_SIZES) {
    const window = windowEndingAt(solves, index, size);
    if (!window) continue;
    const r = computeAvg(window.map(toTimed), size);
    out.push({ size, value: r.isDNF ? Infinity : r.value, ...toChronological(size, window, r.droppedIndices) });
  }
  return out;
}
