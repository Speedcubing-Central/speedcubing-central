import { formatTime, getEvent, type SolveDTO } from '@scc/shared';
import { formatScrambleForCopy } from '../../lib/scramble';
import type { SolveAverage } from './stats';

export { copyText } from '../../lib/clipboard';

// Single solve: "12.34   R U R' U' ..." (scramble spacing normalized; comma-
// separated per row for megaminx — see formatScrambleForCopy).
export function formatSolveCopy(solve: SolveDTO, eventId: string, precision: number): string {
  return `${formatTime(solve.time, solve.penalty, precision)}   ${formatScrambleForCopy(solve.scramble, eventId)}`;
}

// Average block with a numbered, scramble-aligned time list. Dropped solves
// (best & worst) are shown in parentheses, every move single-spaced.
export function formatAverageCopy(view: SolveAverage, eventId: string, precision: number): string {
  const evName = getEvent(eventId)?.name ?? eventId;
  const value = view.value === null ? '—' : !isFinite(view.value) ? 'DNF' : formatTime(Math.round(view.value), 'NONE', precision);
  const lines = [`ao${view.size}: ${value} (${evName})`, ''];
  view.window.forEach((s, i) => {
    const dropped = view.droppedIndices.includes(i);
    const t = formatTime(s.time, s.penalty, precision);
    const shown = dropped ? `(${t})` : t;
    lines.push(`${i + 1}. ${shown}\t${formatScrambleForCopy(s.scramble, eventId)}`);
  });
  return lines.join('\n');
}
