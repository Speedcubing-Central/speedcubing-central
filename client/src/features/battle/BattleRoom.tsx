import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { formatTime, getEvent, type Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ScrambleImage } from '../../components/ScrambleImage';
import { useTimerEngine } from '../timer/useTimerEngine';
import { useBattleSocket, type RoundResult } from './useBattleSocket';

function parseTimeInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  const colonMatch = s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10);
    const secs = parseInt(colonMatch[2], 10);
    const dec = colonMatch[3] ? parseInt(colonMatch[3].padEnd(3, '0'), 10) : 0;
    return mins * 60000 + secs * 1000 + dec;
  }
  const dotMatch = s.match(/^(\d+)\.(\d{1,3})$/);
  if (dotMatch) {
    const secs = parseInt(dotMatch[1], 10);
    const dec = parseInt(dotMatch[2].padEnd(3, '0'), 10);
    return secs * 1000 + dec;
  }
  const digitsMatch = s.match(/^\d{1,8}$/);
  if (digitsMatch) {
    const n = parseInt(s, 10);
    const cs = n % 100;
    const totalSecs = Math.floor(n / 100);
    return totalSecs * 1000 + cs * 10;
  }
  return null;
}

function BattleSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  return (
    <Modal open={open} onClose={onClose} title="Battle Settings" size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Inspection time</div>
            <div className="text-xs text-muted">15-second WCA inspection before each solve</div>
          </div>
          <button
            role="switch"
            aria-checked={settings.inspection}
            onClick={() => settings.set({ inspection: !settings.inspection })}
            className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0', settings.inspection ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover')}
          >
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', settings.inspection && 'translate-x-4')} />
          </button>
        </div>
        {settings.inspection && (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Count direction</div>
              <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-card-hover p-1">
                {(['down', 'up'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => settings.set({ inspectionDirection: v })}
                    className={clsx('px-3 py-1 rounded text-xs font-medium transition-colors', settings.inspectionDirection === v ? 'bg-accent text-white' : 'text-muted hover:text-gray-700 dark:hover:text-gray-200')}
                  >
                    {v === 'down' ? 'Count down' : 'Count up'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Voice announcements</div>
              <button
                role="switch"
                aria-checked={settings.inspectionVoice}
                onClick={() => settings.set({ inspectionVoice: !settings.inspectionVoice })}
                className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0', settings.inspectionVoice ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover')}
              >
                <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', settings.inspectionVoice && 'translate-x-4')} />
              </button>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Time entry</div>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-card-hover p-1">
            {(['keyboard', 'typing'] as const).map((v) => (
              <button
                key={v}
                onClick={() => settings.set({ entryMode: v })}
                className={clsx('px-3 py-1 rounded text-xs font-medium transition-colors', settings.entryMode === v ? 'bg-accent text-white' : 'text-muted hover:text-gray-700 dark:hover:text-gray-200')}
              >
                {v === 'keyboard' ? 'Timer' : 'Type in'}
              </button>
            ))}
          </div>
        </div>
        {settings.entryMode === 'keyboard' && (
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
        )}
      </div>
    </Modal>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function dot(color: 'grey' | 'yellow' | 'green' | 'red') {
  const cls = {
    grey: 'bg-gray-500',
    yellow: 'bg-yellow-400',
    green: 'bg-green-400',
    red: 'bg-red-400',
  }[color];
  return <span className={clsx('inline-block w-2 h-2 rounded-full shrink-0', cls)} />;
}

function RoundResultOverlay({ result, onDismiss }: { result: RoundResult; onDismiss: () => void }) {
  const MEDALS = ['🥇', '🥈', '🥉'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="text-center">
          <div className="text-xs text-muted uppercase tracking-widest mb-1">Round {result.roundNumber} Results</div>
          <div className="text-lg font-bold">
            {result.results[0]?.pointsEarned === 0 ? 'All DNF' : `${result.results[0]?.name} wins!`}
          </div>
        </div>
        <div className="space-y-2">
          {result.results.map((r, i) => (
            <div key={r.participantId} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className="flex-1 font-medium truncate">{r.name}</span>
              <span className="text-muted font-mono">{formatTime(r.time, r.penalty ?? 'NONE')}</span>
              <span className={clsx('text-xs font-semibold', r.pointsEarned > 0 ? 'text-green-400' : 'text-muted')}>
                +{r.pointsEarned} pts
              </span>
            </div>
          ))}
        </div>
        <button className="btn-primary w-full" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BattleRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const settings = useSettings();

  const state = location.state as { displayName?: string; password?: string } | null;
  const displayName = user?.displayName ?? state?.displayName ?? '';
  const password = state?.password;

  // Redirect to lobby if no name (guest opened link directly)
  const [namePrompt, setNamePrompt] = useState(!displayName);
  const [tempName, setTempName] = useState('');

  const {
    connected,
    room,
    lastResult,
    setLastResult,
    error,
    setError,
    myHistory,
    myParticipantId: myParticipantIdRef,
    setMyParticipantId,
    joinRoom,
    solveComplete,
    leaveRoom,
  } = useBattleSocket();

  // Timer state
  const [submitted, setSubmitted] = useState(false);
  const [pendingPenalty, setPendingPenalty] = useState<Penalty>('NONE');
  const [pendingTime, setPendingTime] = useState<number>(0);
  const [awaitingSubmit, setAwaitingSubmit] = useState(false);
  const [typingInput, setTypingInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const timerActive = room?.status === 'ACTIVE' && !submitted;

  const onTimerComplete = useCallback(
    (timeMs: number, _penalty: Penalty) => {
      setPendingTime(timeMs);
      setPendingPenalty('NONE');
      setAwaitingSubmit(true);
    },
    [],
  );

  const engine = useTimerEngine({
    inspection: settings.inspection,
    inspectionDirection: settings.inspectionDirection,
    inspectionVoice: settings.inspectionVoice,
    holdToStart: settings.holdToStart,
    holdDuration: settings.holdDuration,
    startSound: settings.startSound,
    enabled: timerActive && !awaitingSubmit && settings.entryMode === 'keyboard',
    onComplete: onTimerComplete,
  });

  function submitSolve(penalty: Penalty) {
    if (!code || !room) return;
    solveComplete(code.toUpperCase(), pendingTime, penalty);
    setSubmitted(true);
    setAwaitingSubmit(false);
    engine.cancel();
  }

  function handleTypingSubmit() {
    const parsed = parseTimeInput(typingInput);
    if (!parsed) { toast.error('Invalid time format'); return; }
    setPendingTime(parsed);
    setPendingPenalty('NONE');
    setAwaitingSubmit(true);
    setTypingInput('');
  }

  // Join the room on mount
  const joined = useRef(false);
  useEffect(() => {
    if (!code || namePrompt || joined.current) return;
    joined.current = true;
    const name = displayName || tempName;
    joinRoom({ code: code.toUpperCase(), userId: user?.id, name, password });
  }, [code, namePrompt, connected]);

  // Watch for our participant id after room_state arrives
  useEffect(() => {
    if (!room || !displayName) return;
    const me = room.participants.find(
      (p) => (user?.id && p.userId === user.id) || p.name === displayName,
    );
    if (me) setMyParticipantId(me.id);
  }, [room, displayName, user?.id, setMyParticipantId]);

  // Reset submitted state when a new round starts
  useEffect(() => {
    if (room?.status === 'ACTIVE') {
      setSubmitted(false);
      setAwaitingSubmit(false);
      setTypingInput('');
      engine.cancel();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roundNumber]);

  // Show socket errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error);
      setError(null);
    }
  }, [error, setError]);

  function handleLeave() {
    if (code) leaveRoom(code.toUpperCase());
    navigate('/battle');
  }

  function handleNameSubmit() {
    if (!tempName.trim()) return;
    setNamePrompt(false);
    setTimeout(() => {
      joined.current = false; // re-trigger join effect
    }, 0);
  }

  // ── Personal stats derived from history ────────────────────────────────────
  const nonDnfTimes = myHistory.filter((s) => s.penalty !== 'DNF' && s.time !== null).map((s) => s.time!);
  const personalStats = {
    rounds: myHistory.length,
    wins: myHistory.filter((s) => s.rank === 1 && s.penalty !== 'DNF').length,
    best: nonDnfTimes.length ? Math.min(...nonDnfTimes) : null,
    avg: nonDnfTimes.length ? nonDnfTimes.reduce((a, b) => a + b, 0) / nonDnfTimes.length : null,
  };

  // ── Participant list helpers ───────────────────────────────────────────────
  const myId = myParticipantIdRef.current;

  function participantStatus(p: NonNullable<typeof room>['participants'][number]) {
    if (room?.status === 'WAITING') {
      return { label: 'Waiting', color: 'grey' as const };
    }
    // Show submitted time immediately for self before server room_state confirms.
    if (p.id === myId && submitted) {
      return { label: formatTime(pendingTime, pendingPenalty, settings.solvePrecision), color: 'green' as const };
    }
    if (p.finishedAt) return { label: formatTime(p.time, p.penalty ?? 'NONE'), color: 'green' as const };
    return { label: 'Solving…', color: 'yellow' as const };
  }

  // ── Timer display ─────────────────────────────────────────────────────────
  const isInspectionPhase = engine.phase === 'inspecting';

  function timerColor() {
    if (engine.phase === 'holding') return 'text-red-400';
    if (engine.phase === 'ready') return 'text-green-400';
    if (engine.phase === 'inspecting') return 'text-yellow-400';
    if (engine.phase === 'running') return 'text-gray-900 dark:text-white';
    if (submitted) return 'text-green-400';
    return 'text-gray-600 dark:text-gray-300';
  }

  function timerDisplay() {
    if (awaitingSubmit || engine.phase === 'stopped') {
      return formatTime(pendingTime, 'NONE', settings.solvePrecision);
    }
    if (isInspectionPhase) {
      if (settings.inspectionDirection === 'up') {
        return formatTime(engine.elapsed, 'NONE', 1);
      }
      return String(Math.max(0, Math.ceil((15000 - engine.elapsed) / 1000)));
    }
    if (engine.phase === 'running') {
      const ms = engine.elapsed;
      if (settings.timerUpdate === 'hidden') return '—';
      if (settings.timerUpdate === 'seconds') return formatTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
      if (settings.timerUpdate === 'deciseconds') return formatTime(Math.floor(ms / 100) * 100, 'NONE', 1);
      return formatTime(Math.floor(ms / 10) * 10, 'NONE', 2);
    }
    return '0.00';
  }

  const event = room?.eventId ?? '333';
  const eventName = getEvent(event)?.name ?? event;
  const leaderboard = room ? [...room.participants].sort((a, b) => b.points - a.points) : [];

  // ── Name prompt (guest opened link directly) ─────────────────────────────
  if (namePrompt) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-6 w-full max-w-sm space-y-4">
          <div className="font-semibold text-center">Enter your display name</div>
          <input
            autoFocus
            className="input w-full"
            placeholder="e.g. SpeedyCuber99"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
          />
          <button className="btn-primary w-full" onClick={handleNameSubmit}>Join</button>
          <button className="w-full text-sm text-muted hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => navigate('/battle')}>
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return <div className="p-8 text-muted text-center">Connecting…</div>;
  }

  if (!room) {
    return <div className="p-8 text-muted text-center">Joining room…</div>;
  }

  return (
    <div className="flex flex-col md:grid md:grid-cols-[3fr_2fr] gap-4 min-h-0">
      {/* ── LEFT: Timer area ── */}
      <div className="flex flex-col gap-4 min-w-0">
        {/* Room header */}
        <div className="card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{room.name}</div>
            <div className="text-xs text-muted">
              {eventName}
              {' · '}
              Round {room.roundNumber > 0 ? room.roundNumber : '—'}
              {' · '}
              <span className="font-mono tracking-wider">{room.code}</span>
            </div>
          </div>
          {!connected && <span className="text-xs text-red-400">Disconnected</span>}
          <button
            className="text-muted hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Icon name="gear" size={18} />
          </button>
          <button
            className="text-muted hover:text-red-400 transition-colors p-1"
            title="Leave room"
            onClick={handleLeave}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>

        {/* Scramble */}
        {room.status === 'ACTIVE' && room.scramble && (
          <div className="card p-4 flex flex-col items-center gap-3 shrink-0">
            <ScrambleImage eventId={event} scramble={room.scramble} />
            <div className="font-mono text-sm tracking-wide text-center break-words w-full">
              {room.scramble}
            </div>
          </div>
        )}

        {/* Timer */}
        <div
          className="card p-6 flex flex-col items-center gap-4 select-none cursor-default flex-1"
          onPointerDown={(e) => {
            if (timerActive && !awaitingSubmit && settings.entryMode === 'keyboard') {
              e.preventDefault();
              engine.press();
            }
          }}
          onPointerUp={(e) => {
            if (timerActive && !awaitingSubmit && settings.entryMode === 'keyboard') {
              e.preventDefault();
              engine.release();
            }
          }}
        >
          {room.status === 'WAITING' ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="text-4xl font-mono text-gray-500">—</div>
              {room.participants.length < 2 ? (
                <div className="text-sm text-muted text-center">
                  Waiting for more players… Share the code{' '}
                  <span className="font-mono font-semibold text-accent">{room.code}</span>
                </div>
              ) : (
                <div className="text-sm text-muted text-center">Next round starting in a moment…</div>
              )}
            </div>
          ) : submitted ? (
            /* Submitted — waiting for others */
            <div className="flex flex-col items-center gap-2">
              <div className={clsx('text-5xl font-mono font-bold', timerColor())}>
                {formatTime(pendingTime, pendingPenalty, settings.solvePrecision)}
              </div>
              <div className="text-sm text-muted">Waiting for others…</div>
            </div>
          ) : awaitingSubmit ? (
            /* Stopped — choose penalty */
            <div className="flex flex-col items-center gap-4">
              <div className={clsx('text-5xl md:text-7xl font-mono font-bold transition-colors', timerColor())}>
                {timerDisplay()}
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-card-hover transition-colors"
                  onClick={() => submitSolve('PLUS2')}
                >
                  +2
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-card-hover transition-colors text-red-400"
                  onClick={() => submitSolve('DNF')}
                >
                  DNF
                </button>
                <button
                  className="px-6 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
                  onClick={() => submitSolve('NONE')}
                >
                  OK
                </button>
              </div>
            </div>
          ) : settings.entryMode === 'typing' ? (
            /* Typing mode */
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="text-xs text-muted">Enter your time (e.g. 12.58 or 1:02.34)</div>
              <input
                autoFocus
                className="input text-center text-2xl font-mono w-56"
                placeholder="0.00"
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTypingSubmit()}
              />
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-card-hover transition-colors text-red-400"
                  onClick={() => { setPendingTime(0); setPendingPenalty('DNF'); setAwaitingSubmit(true); setTypingInput(''); }}
                >
                  DNF
                </button>
                <button className="btn-primary px-8" onClick={handleTypingSubmit}>
                  Submit
                </button>
              </div>
            </div>
          ) : (
            /* Running, inspection, or idle */
            <div className="flex flex-col items-center gap-2">
              <div className={clsx('text-5xl md:text-7xl font-mono font-bold transition-colors', timerColor())}>
                {timerDisplay()}
              </div>
              {engine.phase === 'idle' && (
                <div className="text-xs text-muted">
                  {settings.inspection ? 'Hold SPACE or tap to start inspection' : 'Hold SPACE or tap to start'}
                </div>
              )}
              {isInspectionPhase && (
                <div className="text-xs text-muted">
                  {settings.holdToStart ? 'Hold SPACE to start timer' : 'Press SPACE to start timer'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Participant statuses */}
        <div className="card p-4 space-y-2">
          <div className="label mb-2">Players</div>
          {room.participants.map((p) => {
            const st = participantStatus(p);
            const isMe = p.id === myId;
            return (
              <div key={p.id} className={clsx('flex items-center gap-2 text-sm', isMe && 'font-semibold')}>
                {dot(st.color)}
                <span className="flex-1 truncate">{p.name}{isMe && ' (you)'}</span>
                <span className={clsx('text-xs', st.color === 'green' ? 'text-green-400' : 'text-muted')}>
                  {st.label}
                </span>
              </div>
            );
          })}
          {room.participants.length === 0 && (
            <div className="text-xs text-muted">No players yet</div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Stats + Leaderboard ── */}
      <div className="flex flex-col gap-4">
        {/* Personal stats */}
        <div className="card p-4">
          <div className="label mb-3">Your Stats</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Rounds', value: personalStats.rounds },
              { label: 'Wins', value: personalStats.wins },
              {
                label: 'Best',
                value: personalStats.best !== null ? formatTime(personalStats.best, 'NONE', settings.solvePrecision) : '—',
              },
              {
                label: 'Average',
                value: personalStats.avg !== null ? formatTime(Math.round(personalStats.avg), 'NONE', settings.solvePrecision) : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-100 dark:bg-card-hover rounded-lg p-3">
                <div className="text-xs text-muted mb-1">{label}</div>
                <div className="font-mono font-semibold text-sm">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card p-4 flex-1 min-h-0">
          <div className="label mb-3">Leaderboard</div>
          {leaderboard.length === 0 ? (
            <div className="text-xs text-muted">No players yet</div>
          ) : (
            <div className="space-y-1">
              {leaderboard.map((p, i) => {
                const isMe = p.id === myId;
                const MEDALS = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={p.id}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                      isMe ? 'bg-accent/10 border border-accent/30' : 'hover:bg-gray-100 dark:hover:bg-card-hover',
                    )}
                  >
                    <span className="w-5 text-center text-sm">{MEDALS[i] ?? `${i + 1}.`}</span>
                    <span className="flex-1 font-medium truncate">{p.name}{isMe && ' ★'}</span>
                    <span className="font-mono text-accent font-semibold">{p.points}</span>
                    <span className="text-xs text-muted">pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My solve history */}
        {myHistory.length > 0 && (
          <div className="card p-4">
            <div className="label mb-3">My Round History</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...myHistory].reverse().map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted font-mono">
                  <span className="w-4 text-right">{myHistory.length - i}.</span>
                  <span className={clsx('flex-1', s.penalty === 'DNF' && 'text-red-400')}>
                    {formatTime(s.time, s.penalty ?? 'NONE', settings.solvePrecision)}
                  </span>
                  <span>{s.rank === 1 ? '🥇' : `#${s.rank}`}</span>
                  <span className={clsx(s.pointsEarned > 0 ? 'text-green-400' : '')}>+{s.pointsEarned}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Round result overlay */}
      {lastResult && (
        <RoundResultOverlay result={lastResult} onDismiss={() => setLastResult(null)} />
      )}

      <BattleSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
