// Clipboard text for a solve and for an average.
//
// In shared/ rather than in either client because this is output a user carries
// somewhere else: pasted into a Discord message, a spreadsheet, a reconstruction
// thread. Two implementations would mean the same solve copied from a phone and
// from a laptop pasting differently, which is exactly the kind of split this
// package exists to prevent.
import { formatTime, formatMoveCount, getEvent, normalizeScramble, type SolveDTO } from './index.js';
import type { SolveAverage } from './timerStats.js';

/**
 * A scramble as it should appear in copied text.
 *
 * Megaminx is written one row per line on screen, but a copied scramble is
 * usually pasted somewhere that will reflow it, so the rows are comma-separated
 * instead: the boundaries survive as punctuation rather than as line breaks that
 * something else is free to discard.
 */
export function formatScrambleForCopy(scramble: string, eventId: string): string {
  const normalized = normalizeScramble(scramble);
  if (!normalized) return normalized;
  if (eventId === 'minx') {
    return normalized.replace(/(U'?) (?=[RD])/g, '$1, ');
  }
  return normalized;
}

/**
 * One solve: `12.34   R U R' U' ...`
 *
 * FMC copies as a bare move count, matching how it's shown everywhere else.
 */
export function formatSolveCopy(solve: SolveDTO, eventId: string, precision: number): string {
  const t =
    eventId === '333fm'
      ? formatMoveCount(solve.time, solve.penalty)
      : formatTime(solve.time, solve.penalty, precision, solve.plusTwoCount);
  return `${t}   ${formatScrambleForCopy(solve.scramble, eventId)}`;
}

/**
 * An average, as a numbered list of the solves that made it.
 *
 * The dropped best and worst are parenthesised, which is the convention every
 * cubing forum already reads without explanation.
 */
export function formatAverageCopy(view: SolveAverage, eventId: string, precision: number): string {
  const isFmc = eventId === '333fm';
  const evName = getEvent(eventId)?.name ?? eventId;
  const fmtVal = (v: number) =>
    isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', precision);
  const value = view.value === null ? '—' : !isFinite(view.value) ? 'DNF' : fmtVal(view.value);
  const label = view.size === 3 ? 'mo3' : `ao${view.size}`;
  const lines = [`${label}: ${value} (${evName})`, ''];
  view.window.forEach((s, i) => {
    const dropped = view.droppedIndices.includes(i);
    const t = isFmc
      ? formatMoveCount(s.time, s.penalty)
      : formatTime(s.time, s.penalty, precision, s.plusTwoCount);
    const shown = dropped ? `(${t})` : t;
    lines.push(`${i + 1}. ${shown}\t${formatScrambleForCopy(s.scramble, eventId)}`);
  });
  return lines.join('\n');
}
