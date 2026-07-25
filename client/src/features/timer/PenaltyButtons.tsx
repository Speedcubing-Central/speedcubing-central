import clsx from 'clsx';
import { MAX_PLUS_TWO_COUNT, type Penalty } from '@scc/shared';

// OK / +2 / DNF selector. OK clears any penalty (NONE, 0 stacked +2s). +2
// stacks another +2 each time it's tapped (up to MAX_PLUS_TWO_COUNT) — a
// small "−" affordance appears alongside it once at least one is stacked, to
// remove one without having to go all the way back to OK.
export function PenaltyButtons({
  penalty,
  plusTwoCount,
  onChange,
  size = 'md',
  hidePlus2,
}: {
  penalty: Penalty;
  plusTwoCount: number;
  onChange: (p: Penalty, plusTwoCount: number) => void;
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
  const inactiveCls = 'border-gray-200 dark:border-border text-muted hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500';
  const opt = (active: boolean, activeCls: string) => clsx(base, active ? activeCls : inactiveCls);

  const isOk = penalty === 'NONE' && plusTwoCount === 0;
  const isPlus2 = penalty === 'NONE' && plusTwoCount > 0;
  const isDnf = penalty === 'DNF';
  const plus2ActiveCls = 'border-yellow-500 bg-yellow-500/15 text-yellow-400';

  return (
    <div className="inline-flex items-center gap-2">
      <button className={opt(isOk, 'border-green-500 bg-green-500/15 text-green-400')} onClick={() => onChange('NONE', 0)}>
        OK
      </button>
      {!hidePlus2 && (
        <div className={clsx('inline-flex items-stretch rounded-lg border overflow-hidden', isPlus2 ? plus2ActiveCls : inactiveCls)}>
          {isPlus2 && (
            <button
              className={clsx(size === 'sm' ? 'px-2 text-xs' : 'px-2.5 text-sm', 'font-semibold border-r border-current/30 hover:bg-yellow-500/10')}
              onClick={() => onChange('NONE', plusTwoCount - 1)}
              title="Remove one +2"
              aria-label="Remove one +2"
            >
              −
            </button>
          )}
          <button
            className={clsx(size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm', 'font-semibold hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-not-allowed')}
            onClick={() => onChange('NONE', Math.min(MAX_PLUS_TWO_COUNT, plusTwoCount + 1))}
            disabled={plusTwoCount >= MAX_PLUS_TWO_COUNT}
            title={isPlus2 ? `Add another +2 (currently +${plusTwoCount * 2})` : 'Add +2'}
          >
            {isPlus2 ? (plusTwoCount === 1 ? '+2' : `+${plusTwoCount * 2}`) : '+2'}
          </button>
        </div>
      )}
      <button className={opt(isDnf, 'border-red-500 bg-red-500/15 text-red-400')} onClick={() => onChange('DNF', 0)}>
        DNF
      </button>
    </div>
  );
}
