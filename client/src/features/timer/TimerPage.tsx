import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { formatTime, getEvent, type Penalty, type SolveDTO } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { EventSelector } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useTimerEngine } from './useTimerEngine';
import { useTimerData } from './useTimerData';
import { useScrambler } from './useScrambler';
import { singleStats, makeAverageView, type AvgSize, type SolveAverage } from './stats';
import { StatsTable } from './StatsTable';
import { PenaltyButtons } from './PenaltyButtons';
import { TimerSettings } from './TimerSettings';
import { SessionManager } from './SessionManager';
import { SolveDetail } from './SolveDetail';
import { AverageDetail } from './AverageDetail';
import { copyText, formatSolveCopy } from './copy';

const SOLVE_GRID = 'grid grid-cols-[1.8rem_5rem_3.6rem_3.6rem_1fr] gap-2 items-center';

// Keep in sync with the timer card's `md:min-h-[...]` class below — this is
// the guaranteed minimum the scramble panel's budget calculation reserves
// for it.
const TIMER_MIN_HEIGHT = 160;
const COLUMN_GAP = 12; // gap-3

// Measures a ref'd element's own height, tracked via ResizeObserver. Used
// for the LEFT column (a stable, flex-stretched height, unaffected by the
// scramble panel's own content) and the last-solve card (present only
// sometimes, but its own height doesn't depend on the scramble panel
// either) — both safe to measure directly, unlike the scramble panel's own
// box.
function useElementHeight(ref: React.RefObject<HTMLDivElement>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => setHeight(el.clientHeight);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return height;
}

// Tracks the md: breakpoint so the scramble panel's height budget only
// applies on desktop, matching the fixed-height column layout there —
// mobile has no fixed-height column (the whole page scrolls instead), so
// there's no real budget to compute.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// Sizes the timer digits to whatever room is actually left in the card,
// instead of guessing at viewport-relative units. `reservedBelow` is the
// pixel height of whatever else shares the card (hint text or the manual-
// entry input row) — measuring the real container avoids ever having to
// re-guess a vh percentage against a screen we can't see.
function useFittedFontSize(containerRef: React.RefObject<HTMLDivElement>, reservedBelow: number): number {
  const [size, setSize] = useState(144); // 9rem, matches the old max
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const heightCap = el.clientHeight - reservedBelow;
      const widthCap = el.clientWidth * 0.34;
      setSize(Math.max(40, Math.min(heightCap, widthCap, 144)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, reservedBelow]);
  return size;
}


// Parse a time string. For pure-digit inputs (no . or :), use precision to
// interpret: the last `precision` digits are the fractional part.
// e.g. precision=2, "1258" → 12.58s; "12684" → 1:26.84
function parseTimeInput(raw: string, precision: number): { time: number; penalty: Penalty } | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^dnf$/i.test(t)) return { time: 0, penalty: 'DNF' };

  let penalty: Penalty = 'NONE';
  let s = t;
  if (s.endsWith('+')) {
    penalty = 'PLUS2';
    s = s.slice(0, -1);
  }

  let ms: number;

  if (/^\d+$/.test(s) && precision > 0) {
    const frac = parseInt(s.slice(-precision).padStart(precision, '0'), 10);
    const intStr = s.slice(0, -precision) || '0';
    const intSec = parseInt(intStr, 10);
    const minutes = Math.floor(intSec / 100);
    const seconds = intSec % 100;
    ms = (minutes * 60 + seconds) * 1000 + frac * Math.pow(10, 3 - precision);
  } else if (/^\d+$/.test(s) && precision === 0) {
    ms = parseInt(s, 10) * 1000;
  } else if (s.includes(':')) {
    const [m, sec] = s.split(':');
    ms = (parseInt(m, 10) * 60 + parseFloat(sec)) * 1000;
  } else {
    ms = parseFloat(s) * 1000;
  }

  if (isNaN(ms) || ms < 0) return null;
  return { time: Math.round(ms), penalty };
}

export default function TimerPage() {
  const settings = useSettings();
  const { inspection, inspectionDirection, inspectionVoice, holdToStart, holdDuration, entryMode, timerUpdate, solvePrecision, startSound } = settings;
  const { user } = useAuth();
  const { focusMode } = useUi();
  const event = settings.currentEvent;
  const data = useTimerData(event);
  const scr = useScrambler(event);

  const [typed, setTyped] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const anyModalOpen = showSessions || showSettings || detailIndex !== null || avgView !== null;

  // Keyboard mode only reserves room for the hint line below the digits;
  // manual mode also needs the input + button row, so it gets less headroom.
  const timerCardRef = useRef<HTMLDivElement>(null);
  const digitFontSize = useFittedFontSize(timerCardRef, entryMode === 'keyboard' ? 68 : 96);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const onComplete = useCallback(
    async (timeMs: number, penalty: Penalty) => {
      let sessionId = data.currentId;
      if (!sessionId) {
        const created = await data.createSession(`${getEvent(event)?.name ?? event} Session`);
        sessionId = created.id;
      }
      await data.addSolve(timeMs, penalty, scr.scramble, sessionId);
      scr.advance();
    },
    [data, scr, event],
  );

  const engine = useTimerEngine({
    inspection,
    inspectionDirection,
    inspectionVoice,
    holdToStart,
    holdDuration,
    startSound,
    enabled: entryMode === 'keyboard' && !anyModalOpen,
    onComplete,
  });

  const stats = useMemo(() => singleStats(data.solves), [data.solves]);
  const newest = data.solves[0];

  // Height budget for the scramble panel's diagram (see useDiagramFit):
  // column height minus the timer card's protected minimum, the last-solve
  // card (when present), and the gaps between them — all measured
  // independently of the scramble panel's own size, so this can never be
  // circular. Debounced so a continuous window resize doesn't thrash the
  // <twisty-player> widget on every intermediate frame; only applied at the
  // md: breakpoint, matching the fixed-height column layout there.
  const leftColRef = useRef<HTMLDivElement>(null);
  const lastSolveRef = useRef<HTMLDivElement>(null);
  const colHeight = useElementHeight(leftColRef);
  const isDesktop = useIsDesktop();
  const [scrambleMaxHeight, setScrambleMaxHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!isDesktop || colHeight <= 0) {
      setScrambleMaxHeight(undefined);
      return;
    }
    const lastSolveH = newest ? lastSolveRef.current?.offsetHeight ?? 0 : 0;
    const gaps = newest ? COLUMN_GAP * 2 : COLUMN_GAP;
    const budget = colHeight - TIMER_MIN_HEIGHT - lastSolveH - gaps;
    const timeout = setTimeout(() => setScrambleMaxHeight(budget), 150);
    return () => clearTimeout(timeout);
  }, [isDesktop, colHeight, newest]);

  const runningStr = (ms: number) => {
    if (timerUpdate === 'hidden') return 'solving…';
    if (timerUpdate === 'seconds')     return formatTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
    if (timerUpdate === 'deciseconds') return formatTime(Math.floor(ms / 100)  * 100,  'NONE', 1);
    return formatTime(Math.floor(ms / 10) * 10, 'NONE', 2);
  };

  const display = useMemo(() => {
    const p = engine.phase;
    if (inspection && (p === 'inspecting' || p === 'holding' || p === 'ready')) {
      if (inspectionDirection === 'up') return String(Math.floor(engine.inspectionElapsed / 1000));
      const rem = engine.inspectionRemaining;
      if (rem > 0) return String(Math.ceil(rem / 1000));
      return rem > -2000 ? '+2' : 'DNF';
    }
    if (p === 'running') return runningStr(engine.elapsed);
    if (p === 'stopped') return formatTime(Math.round(engine.elapsed), 'NONE', solvePrecision);
    if ((p === 'holding' || p === 'ready') && !inspection) return formatTime(0, 'NONE', solvePrecision);
    if (newest) return formatTime(newest.time, newest.penalty, solvePrecision);
    return formatTime(0, 'NONE', solvePrecision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, engine.elapsed, engine.inspectionElapsed, engine.inspectionRemaining, newest, inspection, inspectionDirection, timerUpdate, solvePrecision]);

  const colorClass = (() => {
    const p = engine.phase;
    if (p === 'ready') return 'text-green-500';
    if (p === 'holding') return inspection ? 'text-yellow-400' : 'text-red-500';
    if (p === 'inspecting') return 'text-gray-800 dark:text-white';
    return 'text-gray-900 dark:text-gray-100';
  })();

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => undefined);
  }

  function addTyped() {
    if (!typed.trim()) {
      scr.advance();
      return;
    }
    const parsed = parseTimeInput(typed, solvePrecision);
    if (!parsed) return;
    onComplete(parsed.time, parsed.penalty);
    setTyped('');
  }

  // In keyboard mode, Enter advances to the next scramble when the timer is
  // idle or stopped and no modal is open.
  useEffect(() => {
    if (entryMode !== 'keyboard') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (anyModalOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (engine.phase === 'idle' || engine.phase === 'stopped') {
        e.preventDefault();
        scr.advance();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [entryMode, anyModalOpen, engine.phase, scr.advance]);

  const openAverage = useCallback(
    (size: AvgSize, startIndex: number) => {
      const view = makeAverageView(data.solves, startIndex, size);
      if (view) setAvgView(view);
    },
    [data.solves],
  );

  const hintText = (() => {
    const p = engine.phase;
    if (p === 'idle') return 'Hold Space (or touch & hold), release to start';
    if (p === 'inspecting') return 'Inspecting — hold Space to get ready';
    if (p === 'holding') return 'Keep holding…';
    if (p === 'ready') return 'Release to start!';
    if (p === 'running') return 'Press Space / tap to stop';
    if (p === 'stopped') return 'Solve saved · Esc cancels an accidental start';
    return '';
  })();

  const tool =
    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-card-hover dark:hover:bg-border dark:text-gray-200';

  const typedParsed = useMemo(() => parseTimeInput(typed, solvePrecision), [typed, solvePrecision]);
  const entryDisplay = typed
    ? typedParsed
      ? formatTime(typedParsed.time, typedParsed.penalty, solvePrecision)
      : typed
    : formatTime(0, 'NONE', solvePrecision);
  const entryColorClass = typed
    ? typedParsed
      ? 'text-gray-900 dark:text-gray-100'
      : 'text-red-400'
    : 'text-muted';

  return (
    // On desktop the outer div fills exactly the content area height (100dvh minus the p-8 wrapper = 4rem).
    // On mobile, height is auto and the page scrolls normally.
    <div className="flex flex-col gap-3 md:h-[calc(100dvh-2rem)]">

      {/* Controls bar — shift right when focus mode hides the sidebar so the restore button doesn't overlap */}
      <div className={clsx('flex flex-wrap items-center gap-2 shrink-0', focusMode && 'md:pl-10')}>
        <EventSelector value={event} onChange={settings.setCurrentEvent} />
        <select className="input max-w-[180px]" value={data.currentId ?? ''} onChange={(e) => data.setCurrentId(e.target.value)}>
          {data.sessions.length === 0 && <option value="">No sessions</option>}
          {data.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.solveCount ?? 0})
            </option>
          ))}
        </select>
        <button className={tool} onClick={() => setShowSessions(true)}>
          <Icon name="book" size={16} /> Sessions
        </button>
        <button className={clsx(tool, 'px-2.5')} onClick={() => setShowSettings(true)} title="Timer Settings">
          <Icon name="gear" size={16} />
        </button>
        <button className={clsx(tool, 'ml-auto')} onClick={toggleFullscreen} title="Fullscreen">
          <Icon name={isFullscreen ? 'x' : 'plus'} size={16} />
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {!user && (
        <div className="shrink-0 text-xs text-muted bg-gray-100 dark:bg-card border border-gray-200 dark:border-border rounded-lg px-3 py-2">
          You're not logged in — solves are saved locally in this browser only.
        </div>
      )}

      {/* 2-column layout: left (scramble + timer + last-solve) | right (stats + solves) */}
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">

        {/* LEFT column */}
        <div ref={leftColRef} className="flex flex-col gap-3 md:flex-[3] min-h-0">

          {/* Scramble panel — sized to its own content per event (a short
              3x3 scramble and a 7-line megaminx one legitimately need
              different amounts of room). Its diagram shrinks (never crops —
              see useDiagramFit) to fit scrambleMaxHeight, a budget computed
              above from the column height minus the timer card's protected
              minimum, so the panel can never squeeze the timer away. On
              mobile scrambleMaxHeight is undefined (the whole page scrolls
              instead), so the diagram just renders at its preferred size. */}
          <ScramblePanel
            eventId={event}
            scramble={scr.scramble}
            loading={scr.loading}
            onRefresh={() => scr.refresh()}
            maxHeight={scrambleMaxHeight}
            className="overflow-hidden"
          />

          {/* Timer card — has a protected minimum height (md:min-h-[...])
              so the scramble panel above can never squeeze it away; beyond
              that minimum it grows to fill whatever's left (flex-1). The
              digit display and whatever sits below it (hint text, or the
              manual-entry input row) are both shrink-0 so neither ever gets
              visually compressed to make room for the other; digitFontSize
              is measured against the card's actual rendered height (see
              useFittedFontSize) rather than guessed viewport-relative
              units, so it can't overflow regardless of screen size.
              overflow-y-auto stays as a last-resort fallback. */}
          {entryMode === 'keyboard' ? (
            <div
              ref={timerCardRef}
              className="card flex-1 min-h-0 overflow-y-auto select-none touch-none flex flex-col items-center justify-center cursor-pointer"
              style={{ minHeight: isDesktop ? TIMER_MIN_HEIGHT : undefined }}
              onTouchStart={(e) => { e.preventDefault(); if (!anyModalOpen) engine.press(); }}
              onTouchEnd={(e) => { e.preventDefault(); if (!anyModalOpen) engine.release(); }}
            >
              <div
                className={clsx('font-mono font-bold tabular-nums transition-colors leading-none w-full text-center px-8 shrink-0', colorClass)}
                style={{ fontSize: digitFontSize }}
              >
                {display}
              </div>
              <p className="text-muted text-sm mt-6 text-center px-4 shrink-0">{hintText}</p>
            </div>
          ) : (
            <div
              ref={timerCardRef}
              className="card flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-6"
              style={{ minHeight: isDesktop ? TIMER_MIN_HEIGHT : undefined }}
            >
              <div
                className={clsx('font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0', entryColorClass)}
                style={{ fontSize: digitFontSize }}
              >
                {entryDisplay}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  className="input font-mono text-center text-xl w-40"
                  placeholder="10.00"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTyped()}
                  autoFocus
                />
                <button className="btn-primary" onClick={addTyped}>Add solve</button>
              </div>
            </div>
          )}

          {/* Last solve + penalty */}
          {newest && (
            <div ref={lastSolveRef} className="card p-4 shrink-0 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-muted">
                Last solve: <span className="font-mono text-gray-900 dark:text-gray-100">{formatTime(newest.time, newest.penalty, solvePrecision)}</span>
              </span>
              <PenaltyButtons penalty={newest.penalty} onChange={(p) => data.updatePenalty(newest.id, p)} size="sm" />
            </div>
          )}
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-3 md:flex-[2] min-h-0">

          {/* Statistics */}
          <div className="card p-5 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Statistics</h3>
              <div className="text-sm text-muted">
                <span className="font-mono text-gray-900 dark:text-gray-100">{stats.count}</span> solves
              </div>
            </div>
            <StatsTable solves={data.solves} onOpenSolve={(i) => setDetailIndex(i)} onOpenAverage={openAverage} />
          </div>

          {/* Solves list — fills remaining vertical space, scrolls internally */}
          <div className="card p-5 flex flex-col flex-1 min-h-0">
            <h3 className="font-bold text-lg mb-3 shrink-0">Solves ({data.solves.length})</h3>
            {data.solves.length === 0 ? (
              <p className="text-muted text-sm">No solves yet. Start the timer.</p>
            ) : (
              <>
                <div className={`${SOLVE_GRID} text-xs font-semibold text-muted px-1 pb-1.5 border-b border-border shrink-0`}>
                  <span className="text-right">#</span>
                  <span>single</span>
                  <span className="text-right">ao5</span>
                  <span className="text-right">ao12</span>
                  <span />
                </div>
                <div className="divide-y divide-border/60 overflow-y-auto flex-1 min-h-0">
                  {data.solves.map((s, i) => (
                    <SolveRow
                      key={s.id}
                      index={i}
                      solve={s}
                      solves={data.solves}
                      event={event}
                      precision={solvePrecision}
                      onOpenSolve={() => setDetailIndex(i)}
                      onOpenAverage={openAverage}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <SessionManager open={showSessions} onClose={() => setShowSessions(false)} data={data} event={event} />
      <TimerSettings open={showSettings} onClose={() => setShowSettings(false)} />
      {detailIndex !== null && (
        <SolveDetail
          open
          onClose={() => setDetailIndex(null)}
          solves={data.solves}
          index={detailIndex}
          event={event}
          onUpdatePenalty={data.updatePenalty}
          onUpdateTime={data.updateTime}
          onDelete={data.deleteSolve}
          onOpenAverage={(v) => setAvgView(v)}
        />
      )}
      {avgView && <AverageDetail view={avgView} event={event} onClose={() => setAvgView(null)} />}
    </div>
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
}: {
  index: number;
  solve: SolveDTO;
  solves: SolveDTO[];
  event: string;
  precision: number;
  onOpenSolve: () => void;
  onOpenAverage: (size: AvgSize, startIndex: number) => void;
}) {
  const fmtAvg = (v: number | null) => (v === null ? '—' : !isFinite(v) ? 'DNF' : formatTime(Math.round(v), 'NONE', precision));
  const ao5 = makeAverageView(solves, index, 5);
  const ao12 = makeAverageView(solves, index, 12);

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
