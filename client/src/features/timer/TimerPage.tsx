import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { formatTime, formatMoveCount, getEvent, type Penalty } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { EventSelector } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { useFittedFontSize } from '../../components/useFittedFontSize';
import { useTimerEngine, formatInspectionDisplay } from './useTimerEngine';
import { useFmcEngine } from './useFmcEngine';
import { FmcStartPanel } from './FmcStartPanel';
import { FmcAttemptView } from './FmcAttemptView';
import { useTimerData } from './useTimerData';
import { useScrambler } from './useScrambler';
import { singleStats, makeAverageView, detectNewPBs, type AvgSize, type PbHit, type SolveAverage, type SolveSortBy } from './stats';
import { PbCelebration } from './PbCelebration';
import { Segmented } from '../../components/settingsUi';
import { StatsTable } from './StatsTable';
import { PenaltyButtons } from './PenaltyButtons';
import { TimerSettings } from './TimerSettings';
import { SessionManager } from './SessionManager';
import { ImportCstimerModal } from './ImportCstimerModal';
import { SolveDetail } from './SolveDetail';
import { AverageDetail } from './AverageDetail';
import { SolvesList } from './SolvesList';

// Keep in sync with the timer card's `md:min-h-[...]` class below — this is
// the guaranteed minimum the scramble panel's budget calculation reserves
// for it.
const TIMER_MIN_HEIGHT = 160;
const COLUMN_GAP = 12; // gap-3

export default function TimerPage() {
  const settings = useSettings();
  const { inspection, inspectionDirection, inspectionVoice, holdToStart, holdDuration, entryMode, timerUpdate, solvePrecision, startSound, celebratePBs } = settings;
  const { user } = useAuth();
  const { focusMode } = useUi();
  const event = settings.currentEvent;
  const data = useTimerData(event);
  const scr = useScrambler(event, data.currentId);

  const [typed, setTyped] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [solveSortBy, setSolveSortBy] = useState<SolveSortBy>('date');
  const [pbHits, setPbHits] = useState<PbHit[] | null>(null);
  // True for the entire span of recording a solve — from the moment
  // submission starts, not just once scr.advance() gets around to setting
  // its own loading flag partway through. Without this, the button/input
  // stayed clickable for the whole addSolve() network round-trip, which
  // under real latency was long enough to double-submit the same typed
  // time (or double-fire the timer stop) before anything visibly changed,
  // recording two solves against the same not-yet-advanced scramble.
  const [submitting, setSubmitting] = useState(false);

  // Leaving the select set stale across a session switch would let you
  // "delete" solves that are no longer even visible.
  useEffect(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [data.currentId]);

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === data.solves.length ? new Set() : new Set(data.solves.map((s) => s.id))));
  }

  async function confirmBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`Delete ${count} solve${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    await data.deleteSolves(Array.from(selectedIds));
    toast.success(`Deleted ${count} solve${count !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  const anyModalOpen = showSessions || showSettings || showImport || detailIndex !== null || avgView !== null;

  // Keyboard mode only reserves room for the hint line below the digits;
  // manual mode also needs the input + button row, so it gets less headroom.
  const timerCardRef = useRef<HTMLDivElement>(null);
  const digitFontSize = useFittedFontSize(timerCardRef, entryMode === 'keyboard' ? 68 : 96);
  const typedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const onComplete = useCallback(
    async (timeMs: number, penalty: Penalty, solution?: string) => {
      setSubmitting(true);
      try {
        let sessionId = data.currentId;
        if (!sessionId) {
          const created = await data.createSession(`${getEvent(event)?.name ?? event} Session`);
          sessionId = created.id;
        }
        const prevSolves = data.solves;
        const solve = await data.addSolve(timeMs, penalty, scr.scramble, sessionId, solution);
        scr.advance();
        if (solve && celebratePBs) {
          const hits = detectNewPBs(prevSolves, solve);
          if (hits.length > 0) setPbHits(hits);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [data, scr, event, celebratePBs],
  );

  // While a scramble fetch is in flight, `scr.scramble` still holds the
  // scramble that was just solved — nothing re-renders it until the fetch
  // resolves. Blocking input here (same pattern as `data.solvesLoading`)
  // closes that window entirely: a new attempt literally cannot start
  // until the replacement scramble has actually landed, so it's no longer
  // possible to record two consecutive solves against the same scramble.
  // This matters most for slower-to-generate events (e.g. square-1, whose
  // random-state search can take up to ~2s) where the window would
  // otherwise be wide enough to hit during ordinary, non-rushed solving.
  const inputBlocked = data.solvesLoading || scr.loading || submitting;

  // FMC is the only Timer mode that doesn't use useTimerEngine's
  // hold-to-start stopwatch at all — it's driven by its own countdown
  // instead (see useFmcEngine). While an attempt is running, TimerPage
  // replaces its entire body with FmcAttemptView (see the return below)
  // rather than swapping out just the timer card, so the scramble can stay
  // hidden until Start is clicked and Stats/Solves/the controls bar are
  // genuinely unmounted for the duration of the attempt, not just hidden.
  const isFmc = event === '333fm';
  const fmcEngine = useFmcEngine(scr.scramble, () => onComplete(0, 'DNF'));

  // Keeps the manual-entry input focused across everything that would
  // otherwise silently steal it: clicking "new scramble"/"previous
  // scramble" (scr.scramble changes) and submitting a time (inputBlocked
  // flips true then back false while the solve/next-scramble round-trip is
  // in flight, and a *disabled* input can't hold focus, so it's lost the
  // moment that starts) — so typing the next time never needs a re-click.
  useEffect(() => {
    if (!isFmc && entryMode === 'typing' && !inputBlocked && !anyModalOpen) {
      typedInputRef.current?.focus();
    }
  }, [isFmc, entryMode, inputBlocked, anyModalOpen, scr.scramble]);

  const engine = useTimerEngine({
    inspection,
    inspectionDirection,
    inspectionVoice,
    holdToStart,
    holdDuration,
    startSound,
    enabled: !isFmc && entryMode === 'keyboard' && !anyModalOpen && !inputBlocked,
    onComplete,
  });

  // Same idle/stopped-only gating the Enter-hotkey already uses for
  // scr.advance() (see the keydown handler below) — going back to a
  // previous scramble while a solve is armed/running would swap out the
  // scramble out from under it. Only relevant to the non-FMC ScramblePanel
  // below — FMC never renders it at all while an attempt is running (see
  // the FmcAttemptView branch in the return below), so there's no
  // "swap mid-attempt" scenario left to guard against here.
  const canGoBack = scr.previous !== null && !scr.loading && (engine.phase === 'idle' || engine.phase === 'stopped');

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
      return formatInspectionDisplay(inspectionDirection, engine.inspectionElapsed, engine.inspectionRemaining);
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

  const addTyped = useCallback(() => {
    if (!typed.trim()) {
      scr.advance();
      return;
    }
    const parsed = parseTimeInput(typed, solvePrecision);
    if (!parsed) return;
    onComplete(parsed.time, parsed.penalty);
    setTyped('');
  }, [typed, solvePrecision, onComplete, scr.advance]);

  // Enter advances/submits without needing focus anywhere in particular —
  // in keyboard mode that means advancing to the next scramble (when idle
  // or stopped); in typing mode it means submitting the typed time (or,
  // same as the input's own Enter handler, advancing if nothing's been
  // typed). Excluding INPUT/TEXTAREA/SELECT/BUTTON targets here isn't about
  // *not* handling Enter while the manual-entry input is focused — it's to
  // avoid double-firing addTyped(), since the input has its own onKeyDown
  // for that case.
  useEffect(() => {
    if (entryMode !== 'keyboard' && entryMode !== 'typing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (anyModalOpen || inputBlocked) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (entryMode === 'keyboard') {
        if (engine.phase === 'idle' || engine.phase === 'stopped') {
          e.preventDefault();
          scr.advance();
        }
      } else {
        e.preventDefault();
        addTyped();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [entryMode, anyModalOpen, inputBlocked, engine.phase, scr.loading, scr.advance, addTyped]);

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
    if (p === 'inspecting') return 'Inspecting. Hold Space to get ready';
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

  // While an FMC attempt is actually running, the entire page body swaps to
  // FmcAttemptView instead of the normal controls-bar + two-column layout —
  // a real unmount, not CSS-hiding, so Stats/Solves/session controls are
  // genuinely gone for the duration (per the "only see the timer, scramble,
  // and move boxes" requirement), not just visually tucked away. Every hook
  // above (including useFmcEngine, the Enter-hotkey effect, useTimerEngine)
  // still runs unconditionally regardless of which branch renders —
  // precedent: RelayRoom.tsx's MyRelayPanel swap works the same way.
  if (isFmc && fmcEngine.status === 'running') {
    return (
      <FmcAttemptView
        scramble={scr.scramble}
        remainingMs={fmcEngine.remainingMs}
        finish={fmcEngine.finish}
        onSubmit={onComplete}
      />
    );
  }

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
        <button className={clsx(tool, 'px-2.5')} onClick={() => setShowImport(true)} title="Import from CSTimer">
          <Icon name="upload" size={16} />
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

          {isFmc ? (
            // No scramble shown at all before Start — it should stay hidden
            // until the attempt genuinely begins, same as a real WCA FMC
            // round (see FmcStartPanel). Clicking Start flips fmcEngine's
            // status to 'running', which is caught by the early return
            // above and swaps to FmcAttemptView entirely.
            <FmcStartPanel inputBlocked={inputBlocked} start={fmcEngine.start} />
          ) : (
            <>
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
                onGoBack={scr.goBack}
                canGoBack={canGoBack}
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
                  className="card relative flex-1 min-h-0 overflow-y-auto select-none touch-none flex flex-col items-center justify-center cursor-pointer"
                  style={{ minHeight: isDesktop ? TIMER_MIN_HEIGHT : undefined }}
                  onTouchStart={(e) => { e.preventDefault(); if (!anyModalOpen && !inputBlocked) engine.press(); }}
                  onTouchEnd={(e) => { e.preventDefault(); if (!anyModalOpen && !inputBlocked) engine.release(); }}
                >
                  <div
                    className={clsx('font-mono font-bold tabular-nums transition-colors leading-none w-full text-center px-8 shrink-0', colorClass)}
                    style={{ fontSize: digitFontSize }}
                  >
                    {display}
                  </div>
                  <p className="text-muted text-sm mt-6 text-center px-4 shrink-0">{hintText}</p>
                  {inputBlocked && <TimerLoadingOverlay message={data.solvesLoading ? 'Loading solves…' : 'Scrambling…'} />}
                </div>
              ) : (
                <div
                  ref={timerCardRef}
                  className="card relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-6"
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
                      ref={typedInputRef}
                      className="input font-mono text-center text-xl w-40"
                      placeholder="10.00"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTyped()}
                      disabled={inputBlocked}
                      autoFocus
                    />
                    <button className="btn-primary" onClick={addTyped} disabled={inputBlocked}>Add solve</button>
                  </div>
                  {inputBlocked && <TimerLoadingOverlay message={data.solvesLoading ? 'Loading solves…' : 'Scrambling…'} />}
                </div>
              )}
            </>
          )}

          {/* Last solve + penalty — FMC never carries a +2 (no time-based
              penalty concept), but the OK/DNF toggle itself is always
              available same as every other event: every FMC result now
              comes from the same solution checker or an explicit give-up/
              expiry, so there's no longer a "was this actually verified"
              distinction to gate the toggle on. */}
          {newest && (
            <div ref={lastSolveRef} className="card p-4 shrink-0 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-muted">
                Last solve:{' '}
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {isFmc
                    ? `${formatMoveCount(newest.time, newest.penalty)}${newest.penalty !== 'DNF' ? ' moves' : ''}`
                    : formatTime(newest.time, newest.penalty, solvePrecision)}
                </span>
              </span>
              <PenaltyButtons
                penalty={newest.penalty}
                onChange={(p) => data.updatePenalty(newest.id, p)}
                size="sm"
                hidePlus2={isFmc}
              />
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
            <StatsTable solves={data.solves} event={event} onOpenSolve={(i) => setDetailIndex(i)} onOpenAverage={openAverage} />
          </div>

          {/* Solves list — fills remaining vertical space, scrolls internally */}
          <div className="card p-5 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0 gap-2 flex-wrap">
              <h3 className="font-bold text-lg">Solves ({data.solves.length})</h3>
              {data.solves.length > 0 && (
                selectMode ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted text-xs">{selectedIds.size} selected</span>
                    <button className="btn-ghost text-xs px-2 py-1" onClick={toggleSelectAll}>
                      {selectedIds.size === data.solves.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <button
                      className="btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={confirmBulkDelete}
                      disabled={selectedIds.size === 0}
                    >
                      <Icon name="trash" size={13} /> Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                    </button>
                    <button
                      className="btn-ghost text-xs px-2 py-1"
                      onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Segmented
                      value={solveSortBy}
                      onChange={setSolveSortBy}
                      options={[
                        { value: 'date', label: 'Date' },
                        { value: 'single', label: 'Single' },
                        { value: 'ao5', label: 'Ao5' },
                        { value: 'ao12', label: 'Ao12' },
                      ]}
                    />
                    <button className="btn-ghost text-xs px-2 py-1" onClick={() => setSelectMode(true)}>
                      Select
                    </button>
                  </div>
                )
              )}
            </div>
            {data.solves.length === 0 ? (
              <p className="text-muted text-sm">No solves yet. Start the timer.</p>
            ) : (
              <SolvesList
                solves={data.solves}
                sortBy={solveSortBy}
                event={event}
                precision={solvePrecision}
                onOpenSolve={(i) => setDetailIndex(i)}
                onOpenAverage={openAverage}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
              />
            )}
          </div>
        </div>
      </div>

      <SessionManager open={showSessions} onClose={() => setShowSessions(false)} data={data} event={event} />
      <ImportCstimerModal open={showImport} onClose={() => setShowImport(false)} data={data} event={event} />
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
      {pbHits && <PbCelebration hits={pbHits} precision={solvePrecision} isFmc={isFmc} onDone={() => setPbHits(null)} />}
    </div>
  );
}

// Blocks the timer card while either the current session's solve history
// (see `solvesLoading` in useTimerData.ts) or the next scramble (see
// `inputBlocked` above) is still loading, so a solve can't be started
// before the data it depends on has actually landed.
function TimerLoadingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-card/80 backdrop-blur-sm">
      <Icon name="refresh" size={28} className="animate-spin text-accent" />
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
