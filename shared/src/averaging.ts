// WCA-style average and mean computation, shared by the timer and the calculator.
import type { Penalty } from './index.js';

export interface TimedSolve {
  time: number; // milliseconds (raw, before penalty)
  penalty: Penalty;
  // Number of stacked +2s (0-8), only meaningful when penalty is 'NONE'.
  // Optional so a plain hypothetical (e.g. a BPA/WPA probe) can omit it.
  plusTwoCount?: number;
}

// Effective value for averaging: Infinity for DNF, time+2000*plusTwoCount otherwise.
function eff(s: TimedSolve): number {
  if (s.penalty === 'DNF') return Infinity;
  return s.time + (s.plusTwoCount ?? 0) * 2000;
}

export interface AverageResult {
  value: number | null; // null means DNF/not enough solves; Infinity-safe -> null
  isDNF: boolean;
  best: number | null;
  worst: number | null;
  droppedIndices: number[]; // indices (within the window) that were dropped
  counted: number;
}

/**
 * WCA trimmed average: drop best + worst, mean the rest.
 * More than one DNF (or when a DNF lands in the kept set) => DNF.
 * Used for Ao5, Ao12, Ao50, Ao100, Ao25, etc.
 */
export function trimmedAverage(solves: TimedSolve[]): AverageResult {
  const n = solves.length;
  if (n < 3) {
    return { value: null, isDNF: false, best: null, worst: null, droppedIndices: [], counted: 0 };
  }
  const values = solves.map(eff);
  // number to trim from each end: 5% rounded, min 1 for standard averages
  const trim = Math.max(1, Math.ceil(n * 0.05));

  const indexed = values.map((v, i) => ({ v, i }));
  const sorted = [...indexed].sort((a, b) => a.v - b.v);

  const droppedLow = sorted.slice(0, trim);
  const droppedHigh = sorted.slice(n - trim);
  const droppedIndices = [...droppedLow, ...droppedHigh].map((x) => x.i);

  const kept = sorted.slice(trim, n - trim);
  const dnfCount = values.filter((v) => v === Infinity).length;

  const best = sorted[0].v;
  const worst = sorted[n - 1].v;
  const bestOut = isFinite(best) ? best : null;
  const worstOut = isFinite(worst) ? worst : null;

  // DNF if more DNFs than we can trim away from the top.
  if (dnfCount > trim) {
    return { value: null, isDNF: true, best: bestOut, worst: null, droppedIndices, counted: kept.length };
  }
  // If any kept value is Infinity the average is DNF.
  if (kept.some((k) => k.v === Infinity)) {
    return { value: null, isDNF: true, best: bestOut, worst: null, droppedIndices, counted: kept.length };
  }

  const sum = kept.reduce((acc, k) => acc + k.v, 0);
  const value = sum / kept.length;
  return { value, isDNF: false, best: bestOut, worst: worstOut, droppedIndices, counted: kept.length };
}

/**
 * Mean (no trimming). Any DNF => DNF. Used for Mean of 3 and Mean of X.
 */
export function mean(solves: TimedSolve[]): AverageResult {
  const n = solves.length;
  if (n === 0) {
    return { value: null, isDNF: false, best: null, worst: null, droppedIndices: [], counted: 0 };
  }
  const values = solves.map(eff);
  const best = Math.min(...values);
  const worst = Math.max(...values);
  if (values.some((v) => v === Infinity)) {
    return {
      value: null,
      isDNF: true,
      best: isFinite(best) ? best : null,
      worst: null,
      droppedIndices: [],
      counted: n,
    };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    value: sum / n,
    isDNF: false,
    best: isFinite(best) ? best : null,
    worst: isFinite(worst) ? worst : null,
    droppedIndices: [],
    counted: n,
  };
}

/** Compute a rolling average over the most recent `size` solves. */
export function rollingAverage(solves: TimedSolve[], size: number): AverageResult | null {
  if (solves.length < size) return null;
  const window = solves.slice(0, size); // assume solves[0] is newest
  if (size === 3) {
    // Ao3 still uses trimmed? WCA Ao3 is actually a mean of 3 with trimming rules?
    // For session stats we treat Ao5+ as trimmed; here keep trimmedAverage which trims 1.
  }
  return trimmedAverage(window);
}
