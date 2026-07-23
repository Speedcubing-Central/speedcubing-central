import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import '@cubing/icons';
import { formatTime, getEvent, type RelayAttemptDTO } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { useRelayScrambles } from './useRelayScrambles';
import { useRelayTimerEngine } from './useRelayTimerEngine';
import { RelayAttemptRow } from './RelayAttemptRow';
import { guestRelayStore } from './relayLocalStore';

interface RunState {
  relayName: string;
  legEventIds: string[];
}

const CLOCK_MIN_HEIGHT = 200;
const CLOCK_MAX_HEIGHT = 360;
// Fraction of the column's leftover (non-tile-strip) height given to the
// clock — a fixed ratio, not something derived from which scramble is on
// screen. See the layout effect below for why.
const CLOCK_SHARE = 0.4;
const COLUMN_GAP = 12; // gap-3

function RelaySettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  return (
    <Modal open={open} onClose={onClose} title="Relay Settings" size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Time entry</div>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-card-hover p-1">
            {(['keyboard', 'typing'] as const).map((v) => (
              <button
                key={v}
                onClick={() => settings.set({ entryMode: v })}
                className={clsx(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  settings.entryMode === v ? 'bg-accent text-white' : 'text-muted hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                {v === 'keyboard' ? 'Timer' : 'Type in'}
              </button>
            ))}
          </div>
        </div>
        {settings.entryMode === 'keyboard' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Hold to start</div>
                <div className="text-xs text-muted">Hold spacebar before releasing to start</div>
              </div>
              <button
                role="switch"
                aria-checked={settings.holdToStart}
                onClick={() => settings.set({ holdToStart: !settings.holdToStart })}
                className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0', settings.holdToStart ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover')}
              >
                <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', settings.holdToStart && 'translate-x-4')} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Start sound</div>
              <button
                role="switch"
                aria-checked={settings.startSound}
                onClick={() => settings.set({ startSound: !settings.startSound })}
                className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0', settings.startSound ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover')}
              >
                <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', settings.startSound && 'translate-x-4')} />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function SoloRelayRunner() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as RunState | null;

  useEffect(() => {
    if (!state) navigate('/relays', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  // Keyed by location.key (unique per navigation, even to this same path) so
  // "Run again" — which re-navigates here with a fresh history entry — gets
  // a fully-remounted instance instead of stale completed/splits/engine state.
  return <SoloRelayRunnerInner key={location.key} state={state} />;
}

function SoloRelayRunnerInner({ state }: { state: RunState }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useSettings();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState(0);
  const [splits, setSplits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [typed, setTyped] = useState('');
  // Once the relay is stopped, keyboard control is deliberately disabled —
  // a relay attempt is one-shot, not restartable in place (unlike the plain
  // Timer). Tracked separately from the engine's own `phase` since it must
  // gate the `enabled` option passed *into* useRelayTimerEngine below.
  const [completed, setCompleted] = useState(false);

  const { legs, loading } = useRelayScrambles(state.legEventIds);

  const { data: allAttempts = [] } = useQuery<RelayAttemptDTO[]>({
    queryKey: ['relays-attempts'],
    queryFn: () => (user ? api.get('/relays/attempts').then((r) => r.data) : Promise.resolve(guestRelayStore.listAttempts())),
  });
  const relayAttempts = useMemo(() => allAttempts.filter((a) => a.relayName === state.relayName), [allAttempts, state.relayName]);
  const best = relayAttempts.length > 0 ? Math.min(...relayAttempts.map((a) => a.totalTimeMs)) : null;

  async function finish(timeMs: number) {
    setCompleted(true);
    setSaving(true);
    const legRecords = (legs ?? []).map((l) => ({
      eventId: l.eventId,
      order: l.order,
      scramble: l.scramble,
      splitMs: splits[l.order] ?? null,
    }));
    try {
      if (user) {
        await api.post('/relays/attempts', { relayName: state.relayName, totalTimeMs: timeMs, legs: legRecords });
      } else {
        guestRelayStore.addAttempt(state.relayName, timeMs, legRecords.map((l, i) => ({ id: `leg_${i}`, ...l })));
      }
      queryClient.invalidateQueries({ queryKey: ['relays-attempts'] });
    } catch (e) {
      toast.error(apiError(e, 'Failed to save attempt'));
    } finally {
      setSaving(false);
    }
  }

  const engine = useRelayTimerEngine({
    holdToStart: settings.holdToStart,
    holdDuration: settings.holdDuration,
    startSound: settings.startSound,
    enabled: settings.entryMode === 'keyboard' && !loading && !completed,
    onStop: finish,
  });

  async function updateAttempt(attempt: RelayAttemptDTO, totalTimeMs: number) {
    if (user) {
      try {
        await api.patch(`/relays/attempts/${attempt.id}`, { totalTimeMs });
      } catch (e) {
        toast.error(apiError(e, 'Failed to update attempt'));
        return;
      }
    } else {
      guestRelayStore.updateAttempt(attempt.id, totalTimeMs);
    }
    queryClient.invalidateQueries({ queryKey: ['relays-attempts'] });
  }

  async function deleteAttempt(attempt: RelayAttemptDTO) {
    if (user) {
      try {
        await api.delete(`/relays/attempts/${attempt.id}`);
      } catch (e) {
        toast.error(apiError(e, 'Failed to delete attempt'));
        return;
      }
    } else {
      guestRelayStore.deleteAttempt(attempt.id);
    }
    queryClient.invalidateQueries({ queryKey: ['relays-attempts'] });
  }

  // Falls back to state.legEventIds (each with an empty scramble) while
  // legs is still null so there's always a leg to show — without this,
  // activeLeg was undefined during loading and the ScramblePanel below
  // simply didn't render at all (a blank gap in the layout) instead of
  // showing its own "Scrambling…" loading state.
  const tiles = legs ?? state.legEventIds.map((eventId, order) => ({ eventId, order, scramble: '' }));
  const activeLeg = tiles[selected];
  const canControl = !completed;

  function logSplit() {
    if (!activeLeg || engine.phase !== 'running') return;
    setSplits((prev) => ({ ...prev, [activeLeg.order]: Math.round(engine.elapsed) }));
  }

  function submitTyped() {
    // No penalty concept for a relay total (RelayAttempt has no penalty
    // field) — plain time only, so a stray "+"/"DNF" is rejected rather
    // than silently mis-recorded.
    const parsed = parseTimeInput(typed, 2);
    if (!parsed || parsed.penalty !== 'NONE') {
      toast.error('Enter a plain time, e.g. 1:23.45');
      return;
    }
    finish(parsed.time);
  }

  function runAgain() {
    navigate('/relays/run', { state, replace: true });
  }

  const hint = loading
    ? 'Generating scrambles…'
    : engine.phase === 'idle'
      ? 'Hold spacebar to start the relay'
      : engine.phase === 'holding'
        ? 'Keep holding…'
        : engine.phase === 'ready'
          ? 'Release to start!'
          : engine.phase === 'running'
            ? 'Press spacebar when you finish the last event'
            : saving
              ? 'Saving…'
              : 'Relay complete!';

  // The clock/scramble split is a pure function of the column's total
  // height alone — deliberately NOT of which event is currently selected.
  // An earlier version derived the clock's size by measuring the scramble
  // panel's own per-event rendered height, which had two problems: the
  // clock's size (and its font, sized off of it) could come out slightly
  // different between two visits to the very same event, since text-layout/
  // font-metric timing isn't perfectly deterministic render to render; and
  // switching between events never touched colHeight, so nothing in that
  // chain necessarily recomputed on its own — only an actual window resize
  // reliably forced a fresh measurement. Deriving the split from colHeight/
  // tilesH only fixes both: the clock is now identical across every visit
  // to a given event, and it's still properly reactive to real resizes
  // (colHeight itself is ResizeObserver-driven). The *visible* per-event
  // size differences you do want (a small 2x2 diagram vs. a big megaminx
  // one) still come through completely normally — that's ScramblePanel's
  // own useDiagramFit picking a different diagram size per event within
  // this same stable cap (see its own [eventId, scramble, ...] deps) — it
  // just no longer feeds anything back into the clock.
  const leftColRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const colHeight = useElementHeight(leftColRef);
  const isDesktop = useIsDesktop();
  const [layout, setLayout] = useState<{ clockHeight: number; scrambleMaxHeight: number | undefined; clockWidth: number }>({
    clockHeight: CLOCK_MIN_HEIGHT,
    scrambleMaxHeight: undefined,
    clockWidth: 0,
  });
  useEffect(() => {
    const clockWidth = clockRef.current?.clientWidth ?? 0;
    if (!isDesktop || colHeight <= 0) {
      setLayout({ clockHeight: CLOCK_MIN_HEIGHT, scrambleMaxHeight: undefined, clockWidth });
      return;
    }
    const tilesH = tilesRef.current?.offsetHeight ?? 0;
    const leftover = colHeight - tilesH - COLUMN_GAP * 2;
    const clockHeight = Math.max(CLOCK_MIN_HEIGHT, Math.min(CLOCK_MAX_HEIGHT, leftover * CLOCK_SHARE));
    const scrambleMaxHeight = Math.max(200, leftover - clockHeight);
    const timeout = setTimeout(() => setLayout({ clockHeight, scrambleMaxHeight, clockWidth }), 150);
    return () => clearTimeout(timeout);
  }, [isDesktop, colHeight]);

  // A font rendered at exactly its computed "available" size can still
  // overflow by a few px — glyph ascent/descent for a monospace digit
  // legitimately exceeds the nominal font-size's em-box at `leading-none`.
  // FONT_SAFETY_MARGIN and the lowered absolute ceiling (vs.
  // useFittedFontSize's 144) both build in slack for that instead of sizing
  // to the exact pixel. Derived directly from `layout` (no separate effect
  // needed — it's a pure function of already-reactive state).
  const FONT_SAFETY_MARGIN = 16;
  const MAX_DIGIT_SIZE = 128;
  const reservedBelow = settings.entryMode === 'keyboard' ? 68 : 96;
  const widthCap = layout.clockWidth * 0.34;
  const digitFontSize = Math.max(
    40,
    Math.min(layout.clockHeight - reservedBelow - FONT_SAFETY_MARGIN, widthCap || MAX_DIGIT_SIZE, MAX_DIGIT_SIZE),
  );

  const typedParsed = useMemo(() => parseTimeInput(typed, 2), [typed]);
  const entryDisplay = typed ? (typedParsed ? formatTime(typedParsed.time, typedParsed.penalty, 2) : typed) : formatTime(0, 'NONE', 2);

  return (
    <div className="flex flex-col gap-3 md:h-[calc(100dvh-2rem)]">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">{state.relayName}</h1>
          <p className="text-muted text-sm">{state.legEventIds.length} events</p>
        </div>
        <div className="flex gap-2">
          {completed && (
            <button className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm" onClick={runAgain}>
              <Icon name="refresh" size={16} /> Run again
            </button>
          )}
          <button className="btn flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm border border-border" title="Relay Settings" onClick={() => setShowSettings(true)}>
            <Icon name="gear" size={16} />
          </button>
          <button className="btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border" onClick={() => navigate('/relays')}>
            <Icon name="x" size={16} /> Exit
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* LEFT column */}
        <div ref={leftColRef} className="flex flex-col gap-3 md:flex-[3] min-h-0">
          {/* Master clock — a fixed height (see the layout effect above:
              CLOCK_SHARE of the column's leftover space, clamped), not a
              flex-1 that grows/shrinks with whatever else is on screen. No
              padding on this container itself — spacing between the digits
              and whatever's below them comes from mt-6/gap-6 instead,
              matching TimerPage's card exactly, so reservedBelow (measured
              against those same margins) stays accurate. */}
          <div
            ref={clockRef}
            className={clsx(
              'card relative shrink-0 flex flex-col items-center justify-center overflow-y-auto select-none touch-none',
              settings.entryMode === 'typing' && 'gap-6',
            )}
            style={{ height: isDesktop ? layout.clockHeight : undefined, cursor: settings.entryMode === 'keyboard' ? 'pointer' : undefined }}
            onPointerDown={(e) => {
              if (settings.entryMode === 'keyboard' && canControl && !loading) {
                e.preventDefault();
                engine.press();
              }
            }}
            onPointerUp={(e) => {
              if (settings.entryMode === 'keyboard' && canControl && !loading) {
                e.preventDefault();
                engine.release();
              }
            }}
          >
            {settings.entryMode === 'keyboard' ? (
              <>
                <div
                  className={clsx(
                    'font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0 transition-colors',
                    engine.phase === 'ready' && 'text-green-400',
                    engine.phase === 'holding' && 'text-red-400',
                  )}
                  style={{ fontSize: digitFontSize }}
                >
                  {loading ? '—' : formatTime(engine.elapsed, 'NONE', 2)}
                </div>
                <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">{hint}</p>
              </>
            ) : (
              <>
                <div
                  className={clsx('font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0', typed && !typedParsed ? 'text-red-400' : '')}
                  style={{ fontSize: digitFontSize }}
                >
                  {entryDisplay}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    className="input font-mono text-center text-xl w-40"
                    placeholder="1:12.04"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
                    disabled={completed || loading}
                    autoFocus
                  />
                  <button className="btn-primary" onClick={submitTyped} disabled={completed || loading}>
                    Save time
                  </button>
                </div>
                {completed && <p className="text-sm text-muted text-center px-4 shrink-0">{saving ? 'Saving…' : 'Relay complete!'}</p>}
              </>
            )}
          </div>

          {/* Event tiles */}
          <div ref={tilesRef} className="shrink-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="label mb-0">Events (click one to view its scramble)</div>
              {engine.phase === 'running' && (
                <button className="btn-ghost text-xs px-2 py-1 shrink-0" onClick={logSplit}>
                  Log split
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tiles.map((leg, i) => {
                const dupCount = state.legEventIds.slice(0, i).filter((e) => e === leg.eventId).length;
                const totalOfEvent = state.legEventIds.filter((e) => e === leg.eventId).length;
                const eventName = getEvent(leg.eventId)?.name ?? leg.eventId;
                const label = totalOfEvent > 1 ? `${eventName} #${dupCount + 1}` : eventName;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(i)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors',
                      selected === i
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-card hover:bg-card-hover text-gray-700 dark:text-gray-200',
                    )}
                  >
                    <span className={`cubing-icon ${eventIconClass(leg.eventId)}`} style={{ fontSize: 18, lineHeight: 1 }} />
                    {label}
                    {splits[leg.order] !== undefined && (
                      <span className="text-accent font-mono">{formatTime(splits[leg.order], 'NONE', 2)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected scramble — fills whatever's left below the clock and
              tiles (flex-1 + h-full on the panel itself), with its diagram
              shrinking (never cropping, never scrolling; see useDiagramFit)
              to fit layout.scrambleMaxHeight — the same stable budget
              regardless of which event is selected, so a small diagram
              (2x2) and a big one (megaminx) both render at their own
              correct size within it. */}
          {activeLeg && (
            <div className="flex-1 min-h-0">
              <ScramblePanel
                eventId={activeLeg.eventId}
                scramble={activeLeg.scramble}
                loading={loading}
                maxHeight={layout.scrambleMaxHeight}
                className="h-full overflow-hidden"
              />
            </div>
          )}
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-3 md:flex-[2] min-h-0">
          <div className="card p-5 shrink-0">
            <h3 className="font-bold text-lg mb-4">Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-card-hover/60 px-3 py-2.5">
                <div className="text-xs text-muted mb-0.5">Best</div>
                <div className="font-mono text-lg font-bold">{best !== null ? formatTime(best, 'NONE', 2) : '—'}</div>
              </div>
              <div className="rounded-lg bg-card-hover/60 px-3 py-2.5">
                <div className="text-xs text-muted mb-0.5">Attempts</div>
                <div className="font-mono text-lg font-bold">{relayAttempts.length}</div>
              </div>
            </div>
          </div>

          <div className="card p-5 flex flex-col flex-1 min-h-0">
            <h3 className="font-bold text-lg mb-3 shrink-0">History</h3>
            {relayAttempts.length === 0 ? (
              <p className="text-muted text-sm">No attempts yet. This is your first.</p>
            ) : (
              <div className="overflow-y-auto flex-1 min-h-0 space-y-1.5 pr-1">
                {relayAttempts.map((a) => (
                  <RelayAttemptRow
                    key={a.id}
                    totalTimeMs={a.totalTimeMs}
                    isBest={best !== null && a.totalTimeMs === best}
                    leading={<span className="text-muted text-xs">{new Date(a.createdAt).toLocaleDateString()}</span>}
                    onSave={(newTimeMs) => updateAttempt(a, newTimeMs)}
                    onDelete={() => deleteAttempt(a)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <RelaySettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
