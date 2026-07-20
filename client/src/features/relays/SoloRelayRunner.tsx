import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import '@cubing/icons';
import { formatTime, getEvent, type RelayAttemptDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { useRelayScrambles } from './useRelayScrambles';
import { useRelayTimerEngine } from './useRelayTimerEngine';
import { guestRelayStore } from './relayLocalStore';

interface RunState {
  relayName: string;
  legEventIds: string[];
}

// Keep in sync with the clock card's `md:min-h-[...]` class below — the
// guaranteed minimum the scramble panel's budget calculation reserves for it.
const CLOCK_MIN_HEIGHT = 180;
const COLUMN_GAP = 12; // gap-3

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

  async function handleStop(timeMs: number) {
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
    enabled: !loading && !completed,
    onStop: handleStop,
  });

  const activeLeg = legs?.[selected];
  const canControl = !completed;

  function logSplit() {
    if (!activeLeg || engine.phase !== 'running') return;
    setSplits((prev) => ({ ...prev, [activeLeg.order]: Math.round(engine.elapsed) }));
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

  // Height budget for the scramble panel (see useDiagramFit): column height
  // minus the clock card's protected minimum, the tile strip's actual
  // height, and the gaps between the three — mirrors TimerPage's identical
  // scramble/timer budget split.
  const leftColRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const colHeight = useElementHeight(leftColRef);
  const isDesktop = useIsDesktop();
  const [scrambleMaxHeight, setScrambleMaxHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!isDesktop || colHeight <= 0) {
      setScrambleMaxHeight(undefined);
      return;
    }
    const tilesH = tilesRef.current?.offsetHeight ?? 0;
    const budget = colHeight - CLOCK_MIN_HEIGHT - tilesH - COLUMN_GAP * 2;
    const timeout = setTimeout(() => setScrambleMaxHeight(budget), 150);
    return () => clearTimeout(timeout);
  }, [isDesktop, colHeight]);

  const tiles = legs ?? state.legEventIds.map((eventId, order) => ({ eventId, order, scramble: '' }));

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
          <button className="btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border" onClick={() => navigate('/relays')}>
            <Icon name="x" size={16} /> Exit
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* LEFT column */}
        <div ref={leftColRef} className="flex flex-col gap-3 md:flex-[3] min-h-0">
          {/* Master clock — protected minimum height so the tile strip and
              scramble panel below can never squeeze it away. */}
          <div
            className="card relative shrink-0 flex flex-col items-center justify-center gap-2 p-6 select-none touch-none cursor-pointer"
            style={{ minHeight: isDesktop ? CLOCK_MIN_HEIGHT : undefined }}
            onPointerDown={(e) => {
              if (canControl && !loading) {
                e.preventDefault();
                engine.press();
              }
            }}
            onPointerUp={(e) => {
              if (canControl && !loading) {
                e.preventDefault();
                engine.release();
              }
            }}
          >
            <div
              className={clsx(
                'text-5xl md:text-6xl font-mono font-bold tabular-nums transition-colors',
                engine.phase === 'ready' && 'text-green-400',
                engine.phase === 'holding' && 'text-red-400',
              )}
            >
              {loading ? '—' : formatTime(engine.elapsed, 'NONE', 2)}
            </div>
            <p className="text-sm text-muted text-center px-4">{hint}</p>
          </div>

          {/* Event tiles */}
          <div ref={tilesRef} className="shrink-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="label mb-0">Events — click one to view its scramble</div>
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

          {/* Selected scramble — fills whatever's left */}
          <div className="flex-1 min-h-0">
            {activeLeg && (
              <ScramblePanel eventId={activeLeg.eventId} scramble={activeLeg.scramble} loading={loading} maxHeight={scrambleMaxHeight} className="h-full overflow-hidden" />
            )}
          </div>
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
              <p className="text-muted text-sm">No attempts yet — this is your first.</p>
            ) : (
              <div className="overflow-y-auto flex-1 min-h-0 space-y-1.5 pr-1">
                {relayAttempts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-card-hover/50 px-3 py-2 text-sm">
                    <span className="text-muted text-xs">{new Date(a.createdAt).toLocaleDateString()}</span>
                    <span className={clsx('font-mono', best !== null && a.totalTimeMs === best && 'text-accent font-bold')}>
                      {formatTime(a.totalTimeMs, 'NONE', 2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
