import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { formatTime, type SolveDTO } from '@scc/shared';
import { Icon } from '../../components/Icon';
import { makeAverageView, sortedSolveIndices, type AvgSize, type SolveSortBy } from './stats';
import { copyText, formatSolveCopy } from './copy';

export const SOLVE_GRID = 'grid grid-cols-[1.8rem_5rem_3.6rem_3.6rem_1fr] gap-2 items-center';
export const SOLVE_GRID_SELECT = 'grid grid-cols-[1.2rem_1.8rem_5rem_3.6rem_3.6rem_1fr] gap-2 items-center';

const DEFAULT_ROW_HEIGHT = 36;
const OVERSCAN = 10;

// Renders the column header plus a virtualized, scrollable row list — only
// the rows actually in (or near) the viewport are mounted. A session with
// thousands of solves (e.g. after a bulk cstimer import) used to mount one
// DOM row per solve, which is what actually made scrolling/clicking feel
// slow, not just the initial fetch; this keeps the mounted row count
// roughly constant regardless of session size. Row height is measured off
// the first rendered row (all rows share the same single-line markup) so
// the scroll range stays accurate rather than guessed.
export function SolvesList({
  solves,
  sortBy,
  event,
  precision,
  onOpenSolve,
  onOpenAverage,
  selectMode,
  selectedIds,
  onToggleSelect,
}: {
  solves: SolveDTO[];
  sortBy: SolveSortBy;
  event: string;
  precision: number;
  onOpenSolve: (index: number) => void;
  onOpenAverage: (size: AvgSize, startIndex: number) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsWrapRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    setViewportHeight(el.clientHeight);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  // Runs every render (cheap: one getBoundingClientRect) so a real height
  // change (font size, theme, select-mode toggling) is caught; the equality
  // guard keeps it from looping.
  useEffect(() => {
    const first = rowsWrapRef.current?.firstElementChild as HTMLElement | null;
    if (first) {
      const h = first.getBoundingClientRect().height;
      if (h > 0 && Math.abs(h - rowHeight) > 0.5) setRowHeight(h);
    }
  });

  // `order` holds indices *into* `solves` — the array itself is never
  // reordered (ao5/ao12 windows are computed from chronological adjacency
  // in the original newest-first list, so that order is load-bearing) —
  // just the order rows are displayed/virtualized in.
  const order = useMemo(() => sortedSolveIndices(solves, sortBy), [solves, sortBy]);

  const total = order.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;
  const end = Math.min(total, start + Math.max(visibleCount, 1));
  const visibleIndices = order.slice(start, end);

  return (
    <>
      <div className={`${selectMode ? SOLVE_GRID_SELECT : SOLVE_GRID} text-xs font-semibold text-muted px-1 pb-1.5 border-b border-border shrink-0`}>
        {selectMode && <span />}
        <span className="text-right">#</span>
        <span>single</span>
        <span className="text-right">ao5</span>
        <span className="text-right">ao12</span>
        <span />
      </div>
      <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
        <div style={{ height: start * rowHeight }} />
        <div ref={rowsWrapRef} className="divide-y divide-border/60">
          {visibleIndices.map((index) => {
            const s = solves[index];
            return (
              <SolveRow
                key={s.id}
                index={index}
                solve={s}
                solves={solves}
                event={event}
                precision={precision}
                onOpenSolve={() => onOpenSolve(index)}
                onOpenAverage={onOpenAverage}
                selectMode={selectMode}
                selected={selectedIds.has(s.id)}
                onToggleSelect={() => onToggleSelect(s.id)}
              />
            );
          })}
        </div>
        <div style={{ height: Math.max(0, (total - end) * rowHeight) }} />
      </div>
    </>
  );
}

function SolveRow({
  index,
  solve,
  solves,
  event,
  precision,
  onOpenSolve,
  onOpenAverage,
  selectMode,
  selected,
  onToggleSelect,
}: {
  index: number;
  solve: SolveDTO;
  solves: SolveDTO[];
  event: string;
  precision: number;
  onOpenSolve: () => void;
  onOpenAverage: (size: AvgSize, startIndex: number) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const fmtAvg = (v: number | null) => (v === null ? '—' : !isFinite(v) ? 'DNF' : formatTime(Math.round(v), 'NONE', precision));
  const ao5 = makeAverageView(solves, index, 5);
  const ao12 = makeAverageView(solves, index, 12);

  if (selectMode) {
    return (
      <div
        onClick={onToggleSelect}
        className={clsx(`${SOLVE_GRID_SELECT} px-1 py-2 text-sm rounded-lg cursor-pointer`, selected && 'bg-accent/10')}
      >
        <input type="checkbox" className="accent-accent" checked={selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
        <span className="text-muted text-xs text-right">{solves.length - index}.</span>
        <span className={clsx('font-mono font-semibold', solve.penalty === 'DNF' && 'text-red-400')}>
          {formatTime(solve.time, solve.penalty, precision)}
        </span>
        <span className="font-mono text-xs text-muted text-right">{ao5 ? fmtAvg(ao5.value) : '·'}</span>
        <span className="font-mono text-xs text-muted text-right">{ao12 ? fmtAvg(ao12.value) : '·'}</span>
        <span />
      </div>
    );
  }

  return (
    <div className={`${SOLVE_GRID} px-1 py-2 text-sm`}>
      <span className="text-muted text-xs text-right">{solves.length - index}.</span>
      <button
        onClick={onOpenSolve}
        className={clsx('text-left font-mono font-semibold hover:text-accent', solve.penalty === 'DNF' && 'text-red-400')}
      >
        {formatTime(solve.time, solve.penalty, precision)}
      </button>
      <button
        onClick={() => ao5 && onOpenAverage(5, index)}
        disabled={!ao5}
        className="font-mono text-xs text-muted hover:text-accent disabled:opacity-30 disabled:hover:text-muted text-right"
        title="ao5"
      >
        {ao5 ? fmtAvg(ao5.value) : '·'}
      </button>
      <button
        onClick={() => ao12 && onOpenAverage(12, index)}
        disabled={!ao12}
        className="font-mono text-xs text-muted hover:text-accent disabled:opacity-30 disabled:hover:text-muted text-right"
        title="ao12"
      >
        {ao12 ? fmtAvg(ao12.value) : '·'}
      </button>
      <button
        onClick={() => copyText(formatSolveCopy(solve, event, precision), 'Solve copied')}
        title="Copy solve"
        className="text-muted hover:text-accent justify-self-end"
      >
        <Icon name="copy" size={14} />
      </button>
    </div>
  );
}
