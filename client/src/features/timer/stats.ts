// This module's implementation moved to shared/src/timerStats.ts (exported
// from '@scc/shared') so the mobile app computes the Timer's statistics with
// literally the same code as the web client, rather than a copy that could
// drift. Nothing about the web behaviour changed. This re-export keeps every
// existing `from './stats'` import in this folder working exactly as before.
export {
  AVERAGE_SIZES,
  singleStats,
  currentAverage,
  bestAverageWithIndex,
  bestAverage,
  bestAverageIndex,
  bestSingleIndex,
  bpa,
  wpa,
  targetForBest,
  buildStatsTable,
  windowEndingAt,
  makeAverageView,
  sortedSolveIndices,
  detectNewPBs,
  averagesForSolve,
} from '@scc/shared';

export type {
  AvgSize,
  SingleStats,
  AvgRow,
  SolveAverage,
  SolveSortBy,
  PbHit,
} from '@scc/shared';
