import { formatTime, formatMoveCount, getEvent, type SolveDTO } from '@scc/shared';
import { formatScrambleForCopy } from '../../lib/scramble';
import type { SolveAverage } from './stats';

export { copyText } from '../../lib/clipboard';

// Single solve: "12.34   R U R' U' ..." (scramble spacing normalized; comma-
// separated per row for megaminx — see formatScrambleForCopy). FMC copies
// as a bare move count ("38") instead, matching how it's displayed everywhere else.
export function formatSolveCopy(solve: SolveDTO, eventId: string, precision: number): string {
  const t = eventId === '333fm' ? formatMoveCount(solve.time, solve.penalty) : formatTime(solve.time, solve.penalty, precision);
  return `${t}   ${formatScrambleForCopy(solve.scramble, eventId)}`;
}

// Average block with a numbered, scramble-aligned time list. Dropped solves
// (best & worst) are shown in parentheses, every move single-spaced.
export function formatAverageCopy(view: SolveAverage, eventId: string, precision: number): string {
  const isFmc = eventId === '333fm';
  const evName = getEvent(eventId)?.name ?? eventId;
  const fmtVal = (v: number) => (isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', precision));
  const value = view.value === null ? '—' : !isFinite(view.value) ? 'DNF' : fmtVal(view.value);
  const label = view.size === 3 ? 'mo3' : `ao${view.size}`;
  const lines = [`${label}: ${value} (${evName})`, ''];
  view.window.forEach((s, i) => {
    const dropped = view.droppedIndices.includes(i);
    const t = isFmc ? formatMoveCount(s.time, s.penalty) : formatTime(s.time, s.penalty, precision);
    const shown = dropped ? `(${t})` : t;
    lines.push(`${i + 1}. ${shown}\t${formatScrambleForCopy(s.scramble, eventId)}`);
  });
  return lines.join('\n');
}
