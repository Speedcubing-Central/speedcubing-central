import { useMemo } from 'react';
import type { SolveDTO } from '@scc/shared';
import { formatTime, effectiveTime } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { buildStatsTable, bestSingleIndex, singleStats, type AvgSize } from './stats';

function fmt(v: number | null, decimals: number) {
  if (v === null) return '—';
  if (!isFinite(v)) return 'DNF';
  return formatTime(Math.round(v), 'NONE', decimals);
}

// A stat cell that is a button when an associated detail view exists.
function Cell({ value, onClick, accent }: { value: string; onClick?: () => void; accent?: boolean }) {
  if (onClick && value !== '—') {
    return (
      <td className="px-2">
        <button onClick={onClick} className={`hover:underline ${accent ? 'text-accent' : ''}`}>
          {value}
        </button>
      </td>
    );
  }
  return <td className={`px-2 ${accent ? 'text-accent' : 'text-muted'}`}>{value}</td>;
}

export function StatsTable({
  solves,
  onOpenSolve,
  onOpenAverage,
}: {
  solves: SolveDTO[];
  onOpenSolve: (index: number) => void;
  onOpenAverage: (size: AvgSize, startIndex: number) => void;
}) {
  const { showBPA, showWPA, showTarget, solvePrecision } = useSettings();
  // These scan every rolling window of the session (O(n·size) per average
  // size) — memoized so a large session's stats aren't recomputed from
  // scratch on every unrelated re-render (e.g. the timer digit ticking).
  const rows = useMemo(() => buildStatsTable(solves), [solves]);
  const single = useMemo(() => singleStats(solves), [solves]);
  const bestSingleIdx = useMemo(() => bestSingleIndex(solves), [solves]);
  const colSpanExtra = (showBPA ? 1 : 0) + (showWPA ? 1 : 0) + (showTarget ? 1 : 0);

  const currentSingle = solves.length ? effectiveTime(solves[0].time, solves[0].penalty) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted text-right">
            <th className="text-left font-semibold py-2">Stat</th>
            <th className="font-semibold py-2 px-2">Current</th>
            <th className="font-semibold py-2 px-2">Best</th>
            {showBPA && <th className="font-semibold py-2 px-2">BPA</th>}
            {showWPA && <th className="font-semibold py-2 px-2">WPA</th>}
            {showTarget && <th className="font-semibold py-2 px-2">Target</th>}
          </tr>
        </thead>
        <tbody className="font-mono">
          {/* Single row */}
          <tr className="border-t border-gray-200 dark:border-border/60 text-right">
            <td className="text-left font-sans font-semibold py-2">single</td>
            <Cell value={fmt(currentSingle, solvePrecision)} onClick={solves.length ? () => onOpenSolve(0) : undefined} accent />
            <Cell value={fmt(single.best, solvePrecision)} onClick={bestSingleIdx != null ? () => onOpenSolve(bestSingleIdx) : undefined} />
            {colSpanExtra > 0 && <td className="px-2 text-muted" colSpan={colSpanExtra} />}
          </tr>

          {/* Average rows */}
          {rows.map((r) => {
            const isMo3 = r.size === 3;
            const label = isMo3 ? 'mo3' : `ao${r.size}`;
            const bestIndex = r.bestIndex;
            return (
              <tr key={r.size} className="border-t border-gray-200 dark:border-border/60 text-right">
                <td className="text-left font-sans font-semibold py-2">{label}</td>
                <Cell
                  value={fmt(r.current, solvePrecision)}
                  onClick={solves.length >= r.size ? () => onOpenAverage(r.size, 0) : undefined}
                  accent
                />
                <Cell value={fmt(r.best, solvePrecision)} onClick={bestIndex !== null ? () => onOpenAverage(r.size, bestIndex) : undefined} />
                {showBPA && <td className="px-2 text-muted">{fmt(r.bpa, solvePrecision)}</td>}
                {showWPA && <td className="px-2 text-muted">{isMo3 ? '' : fmt(r.wpa, solvePrecision)}</td>}
                {showTarget && <td className="px-2 text-muted">{fmt(r.target, solvePrecision)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
