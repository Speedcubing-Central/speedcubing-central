import clsx from 'clsx';
import type { Penalty } from '@scc/shared';

// OK / +2 / DNF selector. OK clears any penalty (NONE).
export function PenaltyButtons({
  penalty,
  onChange,
  size = 'md',
  hidePlus2,
}: {
  penalty: Penalty;
  onChange: (p: Penalty) => void;
  size?: 'sm' | 'md';
  // FMC has no time-based penalty concept — a result is either a move
  // count (NONE) or a DNF, never "+2 moves". Used for FMC solves that were
  // entered as a plain move count rather than a verified solution (see
  // TimerPage's "Last solve" card) — a manual OK/DNF correction still makes
  // sense there since nothing verified the result, it just can never be +2.
  hidePlus2?: boolean;
}) {
  const base = clsx(
    'font-semibold rounded-lg border transition-colors',
    size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
  );
  const opt = (value: Penalty, label: string, active: string) =>
    clsx(base, penalty === value ? active : 'border-gray-200 dark:border-border text-muted hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500');

  return (
    <div className="inline-flex gap-2">
      <button className={opt('NONE', 'OK', 'border-green-500 bg-green-500/15 text-green-400')} onClick={() => onChange('NONE')}>
        OK
      </button>
      {!hidePlus2 && (
        <button className={opt('PLUS2', '+2', 'border-yellow-500 bg-yellow-500/15 text-yellow-400')} onClick={() => onChange('PLUS2')}>
          +2
        </button>
      )}
      <button className={opt('DNF', 'DNF', 'border-red-500 bg-red-500/15 text-red-400')} onClick={() => onChange('DNF')}>
        DNF
      </button>
    </div>
  );
}
