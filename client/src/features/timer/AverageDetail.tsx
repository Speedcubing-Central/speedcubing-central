import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { formatTime, formatMoveCount } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { formatScrambleForCopy } from '../../lib/scramble';
import { copyText, formatAverageCopy } from './copy';
import type { SolveAverage } from './stats';

const DEFAULT_ROW_HEIGHT = 44;
const OVERSCAN = 15;

// Detailed view of one average: all member solves + scrambles, with a copy
// button. Virtualized (only rows near the viewport are mounted) since ao1000
// means this can be asked to render a thousand rows at once — the same
// unvirtualized-DOM-list problem SolvesList was fixed for, just triggered
// here by opening a single large average instead of a large session.
export function AverageDetail({ view, event, onClose }: { view: SolveAverage; event: string; onClose: () => void }) {
  const { solvePrecision } = useSettings();
  const isFmc = event === '333fm';
  const value =
    view.value === null
      ? '—'
      : !isFinite(view.value)
        ? 'DNF'
        : isFmc
          ? formatMoveCount(view.value, 'NONE', 2)
          : formatTime(Math.round(view.value), 'NONE', solvePrecision);
  const label = view.size === 3 ? 'mo3' : `ao${view.size}`;
  const droppedSet = useMemo(() => new Set(view.droppedIndices), [view.droppedIndices]);

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

  // Average height per rendered row (incl. the space-y gap) — dividing the
  // wrapper's total occupied height by row count is more accurate than
  // measuring one child, since gap-driven spacing isn't part of any single
  // child's own box.
  useEffect(() => {
    const wrap = rowsWrapRef.current;
    const count = wrap?.children.length ?? 0;
    if (wrap && count > 0) {
      const h = wrap.getBoundingClientRect().height / count;
      if (h > 0 && Math.abs(h - rowHeight) > 0.5) setRowHeight(h);
    }
  });

  const total = view.window.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;
  const end = Math.min(total, start + Math.max(visibleCount, 1));
  const visible = view.window.slice(start, end);

  return (
    <Modal open onClose={onClose} title={`${label}: ${value}`} size="lg">
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => copyText(formatAverageCopy(view, event, solvePrecision), 'Average copied')}>
          <Icon name="copy" size={15} /> Copy average
        </button>
      </div>
      <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto">
        <div style={{ height: start * rowHeight }} />
        <div ref={rowsWrapRef} className="space-y-1.5">
          {visible.map((s, i) => {
            const index = start + i;
            const dropped = droppedSet.has(index);
            return (
              <div
                key={s.id}
                className={`grid grid-cols-[28px_72px_1fr] items-baseline gap-2 rounded-lg border border-gray-200 dark:border-border px-3 py-2 ${dropped ? 'opacity-50' : ''}`}
              >
                <span className="text-muted text-xs">{index + 1}.</span>
                <span className="font-mono">
                  {dropped ? '(' : ''}
                  {isFmc ? formatMoveCount(s.time, s.penalty) : formatTime(s.time, s.penalty, solvePrecision)}
                  {dropped ? ')' : ''}
                </span>
                <span className="font-mono text-xs text-muted break-words">{formatScrambleForCopy(s.scramble, event) || '—'}</span>
              </div>
            );
          })}
        </div>
        <div style={{ height: Math.max(0, (total - end) * rowHeight) }} />
      </div>
      {view.droppedIndices.length > 0 && (
        <p className="text-xs text-muted mt-3">Dropped solves (best &amp; worst) are dimmed and shown in parentheses.</p>
      )}
    </Modal>
  );
}
