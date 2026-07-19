import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import '@cubing/icons';
import { formatTime, getEvent } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { eventIconClass } from '../../lib/eventIcons';
import { Icon } from '../../components/Icon';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useRelayScrambles } from './useRelayScrambles';
import { useRelayTimerEngine } from './useRelayTimerEngine';
import { guestRelayStore } from './relayLocalStore';

interface RunState {
  relayName: string;
  legEventIds: string[];
}

export default function SoloRelayRunner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useSettings();

  const state = location.state as RunState | null;

  const [selected, setSelected] = useState(0);
  const [splits, setSplits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  // Once the relay is stopped, keyboard control is deliberately disabled —
  // a relay attempt is one-shot, not restartable in place (unlike the plain
  // Timer). Tracked separately from the engine's own `phase` since it must
  // gate the `enabled` option passed *into* useRelayTimerEngine below.
  const [completed, setCompleted] = useState(false);

  const { legs, loading } = useRelayScrambles(state?.legEventIds ?? []);

  const engine = useRelayTimerEngine({
    holdToStart: settings.holdToStart,
    holdDuration: settings.holdDuration,
    startSound: settings.startSound,
    enabled: !loading && !completed,
    onStop: handleStop,
  });

  async function handleStop(timeMs: number) {
    setCompleted(true);
    if (!state) return;
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
    } catch (e) {
      toast.error(apiError(e, 'Failed to save attempt'));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!state) navigate('/relays', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  const activeLeg = legs?.[selected];
  const canControl = !completed;

  function logSplit() {
    if (!activeLeg || engine.phase !== 'running') return;
    setSplits((prev) => ({ ...prev, [activeLeg.order]: Math.round(engine.elapsed) }));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{state.relayName}</h1>
          <p className="text-muted text-sm">{state.legEventIds.length} events</p>
        </div>
        <button className="btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border" onClick={() => navigate('/relays')}>
          <Icon name="x" size={16} /> Exit
        </button>
      </div>

      {/* Master clock */}
      <div
        className="card p-8 flex flex-col items-center gap-3 select-none cursor-default"
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
            'text-6xl font-mono tabular-nums',
            engine.phase === 'ready' && 'text-green-400',
            engine.phase === 'holding' && 'text-red-400',
          )}
        >
          {loading ? '—' : formatTime(engine.elapsed, 'NONE', 2)}
        </div>
        <div className="text-sm text-muted text-center">
          {loading
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
                      : 'Relay complete!'}
        </div>
      </div>

      {/* Event tiles */}
      <div>
        <div className="label mb-2">Events — click one to view its scramble</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
          {(legs ?? state.legEventIds.map((eventId, order) => ({ eventId, order, scramble: '' }))).map((leg, i) => {
            const dupCount = state.legEventIds.slice(0, i).filter((e) => e === leg.eventId).length;
            const totalOfEvent = state.legEventIds.filter((e) => e === leg.eventId).length;
            const label = totalOfEvent > 1 ? `${getEvent(leg.eventId)?.name ?? leg.eventId} #${dupCount + 1}` : getEvent(leg.eventId)?.name ?? leg.eventId;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={clsx(
                  'card p-3 flex flex-col items-center gap-1.5 transition-colors',
                  selected === i ? 'border-accent border-2' : 'hover:bg-card-hover',
                )}
              >
                <span className={`cubing-icon ${eventIconClass(leg.eventId)}`} style={{ fontSize: 28, lineHeight: 1 }} />
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
                {splits[leg.order] !== undefined && (
                  <span className="text-[10px] text-accent font-mono">{formatTime(splits[leg.order], 'NONE', 2)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected scramble */}
      {activeLeg && (
        <div className="space-y-2">
          <ScramblePanel eventId={activeLeg.eventId} scramble={activeLeg.scramble} loading={loading} />
          {engine.phase === 'running' && (
            <button className="btn w-full py-2 rounded-lg text-sm border border-border" onClick={logSplit}>
              Log split for this event
            </button>
          )}
        </div>
      )}
    </div>
  );
}
