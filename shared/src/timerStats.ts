// Session statistics derived from a list of solves: rolling/best averages,
// BPA/WPA/target projections, PB detection, and the average-window views the
// Timer's stats table and solve list render.
//
// This lives in shared/ rather than in the web client because both the web
// client and the mobile app render these numbers, and they must agree
// exactly. A user checking their ao12 on their phone and on the web has to
// see the same value for the same session. The underlying WCA
// trim/DNF rules come from ./averaging.js; this module is the derived layer
// on top of them.
import type { SolveDTO } from './index.js';
import { effectiveTime } from './index.js';
import { trimmedAverage, mean, type TimedSolve } from './averaging.js';

export const AVERAGE_SIZES = [3, 5, 12, 50, 100, 1000] as const;
export type AvgSize = (typeof AVERAGE_SIZES)[number];

const toTimed = (s: SolveDTO): TimedSolve => ({ time: s.time, penalty: s.penalty, plusTwoCount: s.plusTwoCount });

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
  const finite = solves.map((s) => effectiveTime(s.time, s.penalty, s.plusTwoCount)).filter((v) => isFinite(v));
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

  const eff = (s: SolveDTO) => effectiveTime(s.time, s.penalty, s.plusTwoCount);

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
  // ── A typed array with copyWithin, not an array with splice ──
  //
  // Same algorithm, different container, and the difference is not academic:
  // this shifts elements about twice per window, so ao1000 over a 14,700-solve
  // session performs roughly 27,000 splices on a 1000-element array. On V8 that
  // is fine. On Hermes, on a phone, the whole of detectNewPBs was measured on
  // device at over four and a half seconds of frozen UI after every solve, and
  // this was the bulk of it. Float64Array.copyWithin is a memmove; splice on a
  // generic array is not.
  //
  // Float64Array also stores Infinity natively, which is how a DNF is carried
  // through here, so nothing about the ordering or the DNF counting changes.
  const window = new Float64Array(size);
  let windowLen = 0;
  const windowSeek = (v: number): number => {
    let lo = 0;
    let hi = windowLen;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (window[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const windowInsert = (v: number): void => {
    const at = windowSeek(v);
    window.copyWithin(at + 1, at, windowLen);
    window[at] = v;
    windowLen++;
  };
  const windowRemove = (v: number): void => {
    const at = windowSeek(v);
    if (window[at] !== v) return;
    window.copyWithin(at, at + 1, windowLen);
    windowLen--;
  };
  // Running sum of the FINITE values in the window, maintained as the window
  // rolls. See evalWindow for why this exists and why it is finite-only.
  let finiteSum = 0;
  for (let k = 0; k < size; k++) {
    const v = eff(solves[k]);
    if (v === Infinity) dnfCount++;
    else finiteSum += v;
    windowInsert(v);
  }

  let best: number | null = null;
  let idx: number | null = null;

  // ── Why this does not walk the kept range ──
  //
  // It used to sum window[trim .. size-trim) for every window, which is O(size)
  // per window and therefore O(n x size) overall. With AVERAGE_SIZES ending at
  // 1000 and a real session holding 14,700 solves, that is about 14 million
  // additions for ao1000 alone, twice per solve (detectNewPBs asks for the
  // before and after). On V8 that is tens of milliseconds; on Hermes, on a
  // phone, it was measured on device at over four and a half seconds of frozen
  // UI after every single solve, with the timer blocked the whole time.
  //
  // The window is sorted, so the kept range is everything except `trim` from
  // each end. Tracking the sum makes each window O(trim) instead of O(size):
  // 100 operations for ao1000 rather than 1000.
  //
  // Finite-only because a DNF is Infinity, and Infinity - Infinity is NaN. The
  // DNFs all sort to the end, and this branch is only reached when there are no
  // more of them than `trim`, so they are always inside the trimmed-off top and
  // never in the kept range. Subtracting just the finite part of that top slice
  // gives exactly the same total.
  //
  // Exact, not approximate: effective times are whole milliseconds, and a
  // session's worth of them stays far inside the range where integer addition
  // and subtraction in a double are exact. The value produced is bit-identical
  // to the old sum, which the differential test in the harness asserts.
  const evalWindow = (start: number) => {
    if (dnfCount > trim) return;
    let sum = finiteSum;
    for (let k = 0; k < trim; k++) sum -= window[k];
    // The top `trim` slots hold the DNFs plus enough finite values to fill
    // them; only the finite ones are in `finiteSum`.
    for (let k = size - trim; k < size - dnfCount; k++) sum -= window[k];
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
    else finiteSum -= outV;
    windowRemove(outV);
    if (inV === Infinity) dnfCount++;
    else finiteSum += inV;
    windowInsert(inV);
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
    const t = effectiveTime(s.time, s.penalty, s.plusTwoCount);
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

// `minValue` is the smallest a single result could ever legitimately be —
// 0 for every time-based event (an idealized, never-actually-reachable
// floor, which is fine for a hypothetical "best possible" projection), but
// FMC has a real, non-zero floor: no scramble can be solved in fewer than
// 15 moves, so a BPA/target projection that ignores that would suggest a
// mathematically impossible next result instead of just an unrealistic one.
export function bpa(solves: SolveDTO[], size: number, minValue = 0): number | null {
  return projected(solves, size, { time: minValue, penalty: 'NONE' });
}

// Mo3: any DNF = DNF, so WPA is always DNF and therefore not useful to show.
// No minValue param needed — the hypothetical here is a DNF, and DNF
// short-circuits computeAvg to Infinity regardless of the `time` field.
export function wpa(solves: SolveDTO[], size: number): number | null {
  if (size === 3) return null;
  return projected(solves, size, { time: 0, penalty: 'DNF' });
}

// Largest single (ms) on the next solve that would still beat the session best.
// Returns null if no best yet or beating it is impossible even with a perfect solve.
// `precomputedBest` lets buildStatsTable pass in a value it already computed
// instead of this doing its own extra O(n·size) pass to find it again.
export function targetForBest(solves: SolveDTO[], size: number, precomputedBest?: number | null, minValue = 0): number | null {
  const best = precomputedBest !== undefined ? precomputedBest : bestAverage(solves, size);
  if (best === null || solves.length < size - 1) return null;
  const win = solves.slice(0, size - 1).map(toTimed);
  const avgAt = (x: number) => {
    const r = computeAvg([...win, { time: x, penalty: 'NONE' as const }], size);
    if (r.isDNF) return Infinity;
    return r.value ?? Infinity;
  };
  if (avgAt(minValue) >= best) return null; // can't PB even with the best legitimately-possible next result
  let lo = minValue;
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

export function buildStatsTable(solves: SolveDTO[], minValue = 0): AvgRow[] {
  return AVERAGE_SIZES.map((size) => {
    const { value: best, index: bestIndex } = bestAverageWithIndex(solves, size);
    return {
      size,
      current: currentAverage(solves, size),
      best,
      bestIndex,
      bpa: bpa(solves, size, minValue),
      wpa: wpa(solves, size),
      target: targetForBest(solves, size, best, minValue),
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
      const t = effectiveTime(solves[i].time, solves[i].penalty, solves[i].plusTwoCount);
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

export interface PbHit {
  label: string; // 'single' | 'mo3' | 'ao5' | 'ao12' | …
  value: number; // ms
}

// Which single/average PBs (if any) the most recently completed solve just
// set, session-scoped (same "best" the Best column already means — see
// StatsTable). `prevSolves` is the session's solves *before* this one;
// `newSolve` is the one that was just added. Adding one solve to the front
// of a newest-first list can only ever improve the session's overall best
// for a given average size if the new size-window that includes it (i.e.
// the one starting at index 0) is the new minimum — every other window is
// just a shifted copy of one that already existed in `prevSolves` — so a
// strict improvement here always corresponds to a genuine new PB set by
// this solve, not a coincidental tie carried over from before.
export function detectNewPBs(prevSolves: SolveDTO[], newSolve: SolveDTO): PbHit[] {
  const newSolves = [newSolve, ...prevSolves];
  const hits: PbHit[] = [];

  const prevSingleBest = singleStats(prevSolves).best;
  const newSingleBest = singleStats(newSolves).best;
  if (newSingleBest !== null && (prevSingleBest === null || newSingleBest < prevSingleBest)) {
    hits.push({ label: 'single', value: newSingleBest });
  }

  for (const size of AVERAGE_SIZES) {
    const prevBest = bestAverage(prevSolves, size);
    // Only ONE window can be new: the one ending on the solve just recorded.
    // Every other window of `newSolves` is a window of `prevSolves` and was
    // already covered by `prevBest`, so scanning the whole history a second
    // time re-derived an answer we are holding. At 14,700 solves that second
    // scan was half of a multi-second freeze after every solve.
    const newestWindow = newSolves.length >= size ? bestAverage(newSolves.slice(0, size), size) : null;
    const newBest =
      prevBest === null
        ? newestWindow
        : newestWindow === null
          ? prevBest
          : Math.min(prevBest, newestWindow);
    if (newBest !== null && isFinite(newBest) && (prevBest === null || newBest < prevBest)) {
      hits.push({ label: size === 3 ? 'mo3' : `ao${size}`, value: newBest });
    }
  }

  return hits;
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
