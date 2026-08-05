import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { formatTime, getEvent, type Penalty } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { getGuestName, setGuestName } from '../../lib/guestName';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { useFittedFontSize } from '../../components/useFittedFontSize';
import { useTimerEngine, formatInspectionDisplay } from '../timer/useTimerEngine';
import { PenaltyButtons } from '../timer/PenaltyButtons';
import { useBattleSocket, type RoundResult } from './useBattleSocket';
import { battleAlgSetLabel } from './algSetOptions';
import { EventAndAlgSetSelect } from './EventPicker';

// Keep in sync with the timer card's `md:min-h-[...]` class below — the
// guaranteed minimum the scramble panel's budget calculation reserves for
// it, mirroring TimerPage's identical split (see the comment there): the
// timer card's own clientHeight is observed directly via useFittedFontSize
// rather than derived by subtracting other elements' measured sizes from
// the column height — that indirect-subtraction approach turned out to be
// genuinely racy (see the fix history on the solo relay runner's clock),
// while observing the flex-1 element's own box via ResizeObserver is not.
const TIMER_MIN_HEIGHT = 160;
const COLUMN_GAP = 16; // gap-4
// Width of the penalty controls when a stopped solve puts them *beside* the
// digit rather than under it, plus the gap to their left — keep in sync with
// the `md:w-[240px]` / `md:gap-8` classes on that row below. 240 covers the
// widest the OK/+2/DNF row gets (stacking a +2 reveals a "−" affordance
// inside it) and the Submit button's longest label.
const PENALTY_COL_WIDTH = 240;
const PENALTY_COL_GAP = 32; // md:gap-8

// The roster is the one part of the column whose height is set by the room
// rather than by the layout: a row per player, up to 10. It scrolls past
// ROSTER_MAX_HEIGHT, which alone is not enough — 10 players make the card 218
// tall, and on a 700px-tall window that put the column 30px past the viewport
// and scrolled the whole page mid-round (the timer at its minimum and the
// cube already at its floor, so nothing else had anything left to give).
// So the cap is also fitted to the column: what is left once the header, the
// timer's minimum, the scramble panel's floor and the gaps are accounted for.
// It only ever binds on short columns — a tall one clamps back to
// ROSTER_MAX_HEIGHT and is unchanged, and a 2-4 player roster is shorter than
// the cap either way, so the common cases never see it.
//
// SCRAMBLE_MIN_HEIGHT is that panel's floor: useDiagramFit's 90px cube plus
// the 132 the panel measures around it here (its own chrome and a one-or-two
// line scramble). It has to be a constant rather than a measurement, because
// measuring the panel to size the roster would feed straight back into the
// roster-to-panel budget below and ratchet. A 7-line megaminx scramble is
// taller than this allows for, so that case reclaims a little less than it
// should — still far better than the unbounded roster it replaces.
const ROSTER_MAX_HEIGHT = 160;
const ROSTER_MIN_HEIGHT = 60; // ~2 rows and a glimpse of the third
const ROSTER_CHROME = 58; // p-4 (32) + the "Players" label and its mb-2 (26)
const SCRAMBLE_MIN_HEIGHT = 222;

// The leaderboard is the same story in the right-hand column, and it bites at
// the same moment: it lists every player too, and at 10 of them its own
// max-h-56 leaves the column 32px over, since Stats and Chat's minimum have
// already claimed the rest. Capping only the roster would have moved the page
// scroll from one column to the other rather than removing it. Same shape of
// fix: preferred cap on a column with room, fitted to the column when not.
const LEADERBOARD_MAX_HEIGHT = 224; // max-h-56
const LEADERBOARD_MIN_HEIGHT = 72; // ~2 rows
const LEADERBOARD_CHROME = 62; // p-4 (32) + the "Leaderboard" label and its mb-3 (30)
const CHAT_MIN_HEIGHT = 180; // the elastic region's floor, below

// Round history is the third list in that column that grows on its own — a
// row per round played, with no end to the rounds a room can run. Its
// max-h-48 was never reachable: Stats, the leaderboard and Chat's floor claim
// the column between them, so every pixel it took came straight off the
// bottom of the page and scrolled it. It is last in the column and the least
// urgent thing in it, so it gets what's left rather than a share of its own,
// and the leaderboard's cap keeps HISTORY_MIN_CARD back for it.
const HISTORY_MAX_HEIGHT = 192; // max-h-48
const HISTORY_MIN_HEIGHT = 36; // ~2 rows
const HISTORY_CHROME = 62; // p-4 (32) + the "My Round History" label and its mb-3 (30)
const HISTORY_MIN_CARD = HISTORY_MIN_HEIGHT + HISTORY_CHROME;

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

// Host-only: switch the room to a different event/algorithm set. Local
// state starts from the room's current event so opening the modal shows
// what's already selected rather than resetting to a default.
function ChangeEventModal({
  open,
  onClose,
  currentEventId,
  currentAlgSetId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentEventId: string;
  currentAlgSetId: string | null;
  onSave: (eventId: string, algSetId: string | null) => void;
}) {
  const [eventId, setEventId] = useState(currentEventId);
  const [algSetId, setAlgSetId] = useState<string | null>(currentAlgSetId);

  useEffect(() => {
    if (open) {
      setEventId(currentEventId);
      setAlgSetId(currentAlgSetId);
    }
  }, [open, currentEventId, currentAlgSetId]);

  return (
    <Modal open={open} onClose={onClose} title="Change Event" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Changing the event resets the room's round and points for everyone.
        </p>
        <EventAndAlgSetSelect eventId={eventId} algSetId={algSetId} onEventChange={setEventId} onAlgSetChange={setAlgSetId} />
        <button
          className="btn-primary w-full"
          onClick={() => {
            onSave(eventId, algSetId);
            onClose();
          }}
        >
          Change Event
        </button>
      </div>
    </Modal>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function HostBadge() {
  return (
    <span className="text-[10px] leading-none px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold shrink-0">
      HOST
    </span>
  );
}

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
              <span className="text-muted font-mono">{formatTime(r.time, r.penalty ?? 'NONE', 2, r.plusTwoCount)}</span>
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
  // `location.state` doesn't survive a hard page refresh — falling back to
  // the persisted guest name (see lib/guestName.ts) means a refreshed guest
  // tab resumes with the exact same name it joined with, so the server's
  // guestName-based reconnect match finds the same participant instead of
  // creating a second one.
  const displayName = user?.displayName ?? state?.displayName ?? getGuestName();
  const password = state?.password;

  // Redirect to lobby if no name (guest opened link directly). Not just a
  // one-shot check: `user` loads asynchronously after mount, so a logged-in
  // user refreshing could otherwise get stuck on this prompt forever even
  // once their real displayName becomes available a moment later.
  const [namePrompt, setNamePrompt] = useState(!displayName);
  const [tempName, setTempName] = useState('');
  useEffect(() => {
    if (displayName) setNamePrompt(false);
  }, [displayName]);

  const {
    connected,
    room,
    lastResult,
    setLastResult,
    error,
    setError,
    myHistory,
    chatMessages,
    myParticipantId,
    setMyParticipantId,
    joinRoom,
    solveComplete,
    leaveRoom,
    changeEvent,
    sendChatMessage,
  } = useBattleSocket();

  // Timer state
  const [submitted, setSubmitted] = useState(false);
  const [pendingPenalty, setPendingPenalty] = useState<Penalty>('NONE');
  const [pendingPlusTwoCount, setPendingPlusTwoCount] = useState<number>(0);
  const [pendingTime, setPendingTime] = useState<number>(0);
  const [awaitingSubmit, setAwaitingSubmit] = useState(false);
  const [typingInput, setTypingInput] = useState('');
  // Editing an already-submitted time/penalty — allowed for as long as the
  // round stays ACTIVE (the server accepts a resubmission right up until it
  // actually scores the round; see socket.ts's solve_complete comment).
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  // The edit form's penalty, held apart from the submitted one so Cancel
  // leaves the solve alone: nothing here reaches the server until Update.
  const [editPenalty, setEditPenalty] = useState<Penalty>('NONE');
  const [editPlusTwoCount, setEditPlusTwoCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangeEvent, setShowChangeEvent] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const timerActive = room?.status === 'ACTIVE' && !submitted;

  const onTimerComplete = useCallback(
    (timeMs: number, _penalty: Penalty, _plusTwoCount: number) => {
      setPendingTime(timeMs);
      setPendingPenalty('NONE');
      setPendingPlusTwoCount(0);
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

  // `time`/`plusTwoCount` default to the already-set pending values (the
  // normal confirm-screen path); the typing tile's DNF shortcut passes 0
  // explicitly so it doesn't have to wait a render for a just-called
  // setPendingTime(0) to land.
  function submitSolve(penalty: Penalty, time: number = pendingTime, plusTwoCount: number = pendingPlusTwoCount) {
    if (!code || !room) return;
    const count = penalty === 'DNF' ? 0 : plusTwoCount;
    solveComplete(code.toUpperCase(), time, penalty, count);
    setPendingTime(time);
    setPendingPenalty(penalty);
    setPendingPlusTwoCount(count);
    setSubmitted(true);
    setAwaitingSubmit(false);
    engine.cancel();
  }

  function handleTypingSubmit() {
    const parsed = parseTimeInput(typingInput, settings.solvePrecision);
    if (!parsed) { toast.error('Invalid time format'); return; }
    setPendingTime(parsed.time);
    setPendingPenalty(parsed.penalty);
    setPendingPlusTwoCount(parsed.plusTwoCount);
    setAwaitingSubmit(true);
    setTypingInput('');
  }

  function openEdit() {
    // The field holds the raw time; the penalty it carries lives in the
    // buttons beside it, seeded from what was submitted.
    setEditInput(formatTime(pendingTime, 'NONE', settings.solvePrecision));
    setEditPenalty(pendingPenalty);
    setEditPlusTwoCount(pendingPlusTwoCount);
    setEditing(true);
  }

  function handleEditSubmit() {
    const parsed = parseTimeInput(editInput, settings.solvePrecision);
    if (!parsed) { toast.error('Invalid time format'); return; }
    // The buttons own the penalty, but typing one still works and wins when
    // it's there ("dnf", or a trailing "+" per +2) — typing it is every bit
    // as deliberate as clicking it, and it's the older of the two habits.
    const typedPenalty = parsed.penalty === 'DNF' || parsed.plusTwoCount > 0;
    // "dnf" parses to a zero time, so keep the time the solve already had
    // rather than discarding it: the penalty is editable from here, and a
    // DNF you can undo has to still know what it was. The main submit path
    // sends the real time with a DNF too.
    const time = parsed.penalty === 'DNF' ? pendingTime : parsed.time;
    submitSolve(
      typedPenalty ? parsed.penalty : editPenalty,
      time,
      typedPenalty ? parsed.plusTwoCount : editPlusTwoCount,
    );
    setEditing(false);
  }

  // Join the room on mount, and re-join on every reconnect. `joined` used to
  // be a one-shot flag that was never cleared, so it only ever sent
  // join_room once per page load: after any socket drop (backgrounded tab,
  // network blip, dev-server restart) socket.io reconnects the transport
  // but the server sees a brand-new connection with no room membership —
  // this client kept rendering whatever `room` snapshot it had before the
  // drop, forever, since it never re-sent join_room to get a fresh one.
  // That's what a report of "only I can see myself, and nobody can start
  // the next round" turned out to be: the OTHER player's client was
  // correctly synced (their socket never dropped), while this one was
  // silently stuck, and the server was also silently dropping this
  // player's solve submissions (myParticipantId is null on that stale
  // socket), which blocked round completion for both sides. Resetting the
  // guard whenever `connected` goes false ensures the effect fires again —
  // and re-sends join_room — the moment it comes back true.
  const joined = useRef(false);
  useEffect(() => {
    if (!connected) { joined.current = false; return; }
    if (!code || namePrompt || joined.current) return;
    joined.current = true;
    const name = displayName || tempName;
    joinRoom({ code: code.toUpperCase(), name, password });
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
      setEditing(false);
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

  // Enter/Escape when awaiting penalty choice (unless an input is focused)
  useEffect(() => {
    if (!awaitingSubmit) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAwaitingSubmit(false);
        engine.cancel();
        return;
      }
      if (e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      submitSolve(pendingPenalty, pendingTime, pendingPlusTwoCount);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingSubmit, pendingPenalty, pendingPlusTwoCount, pendingTime]);

  function handleLeave() {
    if (code) leaveRoom(code.toUpperCase());
    navigate('/battle');
  }

  function handleNameSubmit() {
    if (!tempName.trim()) return;
    setGuestName(tempName.trim());
    setNamePrompt(false);
    setTimeout(() => {
      joined.current = false; // re-trigger join effect
    }, 0);
  }

  function handleSendChat() {
    const message = chatInput.trim();
    if (!message || !code) return;
    sendChatMessage(code.toUpperCase(), message);
    setChatInput('');
  }

  // Keep the chat log scrolled to the newest message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  // ── Personal stats derived from history ────────────────────────────────────
  const nonDnfTimes = myHistory.filter((s) => s.penalty !== 'DNF' && s.time !== null).map((s) => s.time!);
  const personalStats = {
    rounds: myHistory.length,
    wins: myHistory.filter((s) => s.rank === 1 && s.penalty !== 'DNF').length,
    best: nonDnfTimes.length ? Math.min(...nonDnfTimes) : null,
    avg: nonDnfTimes.length ? nonDnfTimes.reduce((a, b) => a + b, 0) / nonDnfTimes.length : null,
  };

  // ── Participant list helpers ───────────────────────────────────────────────
  const myId = myParticipantId;
  const isHost = room?.participants.find((p) => p.id === myId)?.isHost ?? false;

  function participantStatus(p: NonNullable<typeof room>['participants'][number]) {
    if (room?.status === 'WAITING') {
      return { label: 'Waiting', color: 'grey' as const };
    }
    // Show submitted time immediately for self before server room_state confirms.
    if (p.id === myId && submitted) {
      return { label: formatTime(pendingTime, pendingPenalty, settings.solvePrecision, pendingPlusTwoCount), color: 'green' as const };
    }
    if (p.finishedAt) return { label: formatTime(p.time, p.penalty ?? 'NONE', 2, p.plusTwoCount), color: 'green' as const };
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
    // Not the awaiting-penalty state: that branch renders the *penalised*
    // time itself, since that's the number the Submit button will send.
    if (engine.phase === 'stopped') {
      return formatTime(pendingTime, 'NONE', settings.solvePrecision);
    }
    if (isInspectionPhase) {
      return formatInspectionDisplay(settings.inspectionDirection, engine.inspectionElapsed, engine.inspectionRemaining);
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
  const algSetLabel = battleAlgSetLabel(room?.algSetId);
  const eventName = algSetLabel ? `${algSetLabel} Battle` : getEvent(event)?.name ?? event;
  const leaderboard = room ? [...room.participants].sort((a, b) => b.points - a.points) : [];

  // ── Height budget: fills the viewport like TimerPage, instead of letting
  // the page grow past it and scroll. The scramble panel is capped by a
  // budget computed from stable, timer-independent measurements (header +
  // participants list + the timer's own protected minimum); the timer card
  // itself is flex-1 with its digit size observed directly off its own
  // rendered height (useFittedFontSize) rather than derived by subtracting
  // a sibling's measured size from the column total — see TIMER_MIN_HEIGHT's
  // comment above for why that indirect approach isn't safe.
  const leftColRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);
  const colHeight = useElementHeight(leftColRef);
  const isDesktop = useIsDesktop();
  const showScramble = room?.status === 'ACTIVE' && !!room.scramble;
  const statsRef = useRef<HTMLDivElement>(null);
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const [scrambleMaxHeight, setScrambleMaxHeight] = useState<number | undefined>(undefined);
  const [rosterMaxHeight, setRosterMaxHeight] = useState(ROSTER_MAX_HEIGHT);
  const [leaderboardMaxHeight, setLeaderboardMaxHeight] = useState(LEADERBOARD_MAX_HEIGHT);
  const [historyMaxHeight, setHistoryMaxHeight] = useState(HISTORY_MAX_HEIGHT);
  // Both right-hand caps move when the lists they sit beside change length,
  // so the room's roster and the rounds played are inputs to this, not just
  // the window size.
  const playerCount = room?.participants.length ?? 0;
  const historyCount = myHistory.length;
  useEffect(() => {
    if (!isDesktop || colHeight <= 0) {
      setScrambleMaxHeight(undefined);
      setRosterMaxHeight(ROSTER_MAX_HEIGHT);
      setLeaderboardMaxHeight(LEADERBOARD_MAX_HEIGHT);
      setHistoryMaxHeight(HISTORY_MAX_HEIGHT);
      return;
    }
    const headerH = headerRef.current?.offsetHeight ?? 0;
    // header→scramble→timer→participants (3 gaps), or header→timer→participants (2) when there's no scramble to show.
    const gapCount = showScramble ? 3 : 2;
    // The roster is capped first, off the column and the header alone. Both
    // are independent of the roster, and of the two boxes it competes with,
    // so the dependency runs one way: column → roster → scramble budget →
    // cube. Sizing it off the panel instead would close that into a loop.
    const rosterCap = colHeight - headerH - TIMER_MIN_HEIGHT
      - (showScramble ? SCRAMBLE_MIN_HEIGHT : 0) - ROSTER_CHROME - COLUMN_GAP * gapCount;
    setRosterMaxHeight(Math.max(ROSTER_MIN_HEIGHT, Math.min(ROSTER_MAX_HEIGHT, rosterCap)));
    // Read *after* setting the cap (and re-run once it lands, hence the dep):
    // a roster measured before its own cap applied would hand the scramble
    // panel a budget short by the difference and shrink the cube for nothing.
    const participantsH = participantsRef.current?.offsetHeight ?? 0;
    const budget = colHeight - headerH - TIMER_MIN_HEIGHT - participantsH - COLUMN_GAP * gapCount;

    // Right-hand column, same idea. It's the other half of this grid row, so
    // it's exactly as tall as the left one. Stats is measured (fixed content,
    // and nothing here feeds back into it); Chat is elastic but floored, so
    // the leaderboard gets what's left over that floor, less the little it
    // has to keep back for history when there is any.
    const statsH = statsRef.current?.offsetHeight ?? 0;
    const hasHistory = historyCount > 0;
    const rightGaps = COLUMN_GAP * (hasHistory ? 3 : 2);
    const leaderboardCap = colHeight - statsH - CHAT_MIN_HEIGHT
      - (hasHistory ? HISTORY_MIN_CARD : 0) - LEADERBOARD_CHROME - rightGaps;
    setLeaderboardMaxHeight(Math.max(LEADERBOARD_MIN_HEIGHT, Math.min(LEADERBOARD_MAX_HEIGHT, leaderboardCap)));
    // History takes what the leaderboard actually used, not what it was
    // allowed — a 3-player leaderboard is well under its cap, and that
    // difference is history's to spend. Measured after the cap lands (the dep
    // below), and one-way: nothing sizes the leaderboard off history.
    const leaderboardH = leaderboardRef.current?.offsetHeight ?? 0;
    const historyCap = colHeight - statsH - CHAT_MIN_HEIGHT - leaderboardH - HISTORY_CHROME - rightGaps;
    setHistoryMaxHeight(Math.max(HISTORY_MIN_HEIGHT, Math.min(HISTORY_MAX_HEIGHT, historyCap)));

    const timeout = setTimeout(() => setScrambleMaxHeight(budget), 150);
    return () => clearTimeout(timeout);
  }, [isDesktop, colHeight, showScramble, rosterMaxHeight, leaderboardMaxHeight, playerCount, historyCount]);

  // Reserved space below the digit varies by which sub-state the timer card
  // is showing (penalty buttons, an edit row, "waiting for others" + an edit
  // link, ...) — each is a fixed, known amount for that particular state,
  // not something that needs measuring. Under-reserving doesn't just crowd
  // the layout, it fits a digit too tall for the card and the card starts
  // scrolling: awaitingSubmit's stack measures 114 (16 hint + 38 penalty row
  // + 36 Submit + three 8px gaps), which the old value of 100 did not cover,
  // so a stacked +2 revealing the extra Confirm button overflowed and the
  // card grew a scrollbar mid-round.
  //
  // Reserve the measured stack *plus* ~40 in the layouts that stack, because
  // this number is also the card's only source of breathing room: the digit
  // is fitted to `clientHeight - reservedBelow` and the card has no vertical
  // padding, so reserving exactly what the stack needs sizes the digit to
  // fill every last pixel and the result is flush against both edges. The
  // surplus is what `justify-center` splits into a real margin.
  //
  // awaitingSubmit is the exception, and the reason the whole card stopped
  // feeling cramped: from md up its controls sit *beside* the digit, so the
  // digit's height budget is the card itself and only the breathing room
  // comes off it. 48 rather than the 40 that margin actually needs, because
  // the fitted digit takes every pixel the reserve doesn't: with the reserve
  // set to exactly the margin, a card whose flex-distributed height lands on
  // a fraction rounds a pixel over (a 172px content box reporting
  // scrollHeight 173) and overflow-y-auto answers a 1px overflow with a real
  // 10px scrollbar. The spare few pixels absorb that rounding.
  // Below md they're still stacked underneath, where the full
  // 154 (16 hint + 38 penalty row + 36 Submit + three 8px gaps, plus the
  // margin) applies — under-reserving there fits a digit too tall for the
  // card and it starts scrolling, which is how a stacked +2 revealing an
  // extra button used to grow a scrollbar mid-round.
  const reservedBelow = (() => {
    if (!room || room.status === 'WAITING') return 60;
    if (submitted && editing) return 150;
    if (submitted) return 80;
    if (awaitingSubmit) return isDesktop ? 48 : 154;
    if (settings.entryMode === 'typing') return 110;
    if (engine.phase === 'idle' || isInspectionPhase) return 60;
    return 30;
  })();
  // The other half of that trade: what the digit gives up horizontally to buy
  // the vertical room back. Only the side-by-side layout reserves anything.
  // How many characters the digit's font has to be sized for, as a high-water
  // mark: it starts at whatever the solve stopped at and only ever grows while
  // penalties are toggled. Fitting the font to each label as it comes would
  // mean a digit that grows back every time a penalty is cleared, and one that
  // is smaller for "12.09+16" than the "12.09" it started as is much less
  // jarring than one that keeps changing size in both directions.
  //
  // Only the font uses it. The *box* is the current label's width, below —
  // a box held at the high-water mark stayed as wide as the longest label the
  // solve had reached, and since the text within it is right-aligned, picking
  // DNF left the three characters hard against the buttons with the width of
  // five characters of nothing to their left. The row was still centred as
  // geometry; it read as pushed to the right, which is the same thing as being
  // off-centre to anyone looking at it.
  const pendingLabel = formatTime(pendingTime ?? 0, pendingPenalty, settings.solvePrecision, pendingPlusTwoCount);
  const [digitBoxCh, setDigitBoxCh] = useState(pendingLabel.length);
  useEffect(() => {
    setDigitBoxCh(formatTime(pendingTime ?? 0, 'NONE', settings.solvePrecision, 0).length);
  }, [pendingTime, settings.solvePrecision]);
  useEffect(() => {
    setDigitBoxCh((ch) => Math.max(ch, pendingLabel.length));
  }, [pendingLabel]);

  // That same count is what the digit's font has to be fitted to, not just its
  // box. Sizing the font as if every label were five characters and then
  // putting a six-character one in it ("12.09+") is how a stopped solve came
  // to render straight across the penalty buttons: the box was the right width
  // for the text, and the text was far too big for the box.
  //
  // Only the states that show a *penalised* time pass it. The others (a
  // running clock, "0.00", "—") keep the hook's default and stay exactly as
  // they were — a running label changes length as it counts, and resizing the
  // digit mid-solve would be worse than the width it saves.
  const reservedRight = awaitingSubmit && isDesktop ? PENALTY_COL_WIDTH + PENALTY_COL_GAP : 0;
  const [timerCardRef, digitFontSize] = useFittedFontSize(
    reservedBelow,
    reservedRight,
    awaitingSubmit || submitted ? digitBoxCh : undefined,
  );

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
    // On desktop this fills exactly the content area height (100dvh minus
    // the page wrapper's padding), same as TimerPage — the grid row below
    // is flex-1 so both columns share that same bounded height instead of
    // growing past the viewport and forcing the whole page to scroll.
    <div className="flex flex-col gap-4 md:h-[calc(100dvh-2rem)]">
    <div className="flex flex-col md:grid md:grid-cols-[3fr_2fr] gap-4 flex-1 min-h-0">
      {/* ── LEFT: Timer area ── */}
      <div ref={leftColRef} className="flex flex-col gap-4 min-w-0 min-h-0">
        {/* Room header */}
        <div ref={headerRef} className="card p-3 flex items-center gap-3 shrink-0">
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
          {isHost && (
            <button
              className="text-muted hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
              title="Change event (host only)"
              onClick={() => setShowChangeEvent(true)}
            >
              <Icon name="pencil" size={18} />
            </button>
          )}
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

        {/* Scramble — shrinks (never crops, never scrolls; see useDiagramFit)
            to fit scrambleMaxHeight so it can't squeeze the timer below its
            protected minimum. */}
        {showScramble && (
          <ScramblePanel eventId={event} scramble={room.scramble} maxHeight={scrambleMaxHeight} className="shrink-0 overflow-hidden" />
        )}

        {/* Timer — protected minimum height so the scramble panel above can
            never squeeze it away; beyond that it grows to fill whatever's
            left (flex-1). Digit size is fitted to the card's own rendered
            height (see useFittedFontSize) instead of a static text-* class,
            so the clock actually uses the room it's given rather than
            leaving blank space below it. overflow-y-auto stays as a
            last-resort fallback. */}
        <div
          ref={timerCardRef}
          className="card relative px-6 flex flex-col items-center justify-center select-none cursor-default flex-1 min-h-0 overflow-y-auto"
          style={{ minHeight: isDesktop ? TIMER_MIN_HEIGHT : undefined }}
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
          ) : submitted && editing ? (
            /* Editing an already-submitted time/penalty. The button that
               opens this says "Edit time/penalty" and for a while only the
               first half was true: DNF was the one penalty reachable, as a
               button that submitted the moment it was clicked, so there was
               no way to add or clear a +2, and no way back to OK short of
               retyping the time. It's the same PenaltyButtons the stopped
               state uses now, and like there it only *selects* — Update is
               what commits.

               Same left/right split as that state, too: the form is four
               rows tall stacked, which overflows this card at the height a
               laptop leaves it, and the card would scroll. */
            <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-4 md:gap-8 w-full">
              <input
                autoFocus
                className="input text-center text-2xl font-mono w-56 md:shrink-0"
                placeholder="0.00"
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <div className="flex flex-col items-center gap-2 md:w-[240px] md:shrink-0">
                <div className="text-xs text-muted text-center">Edit the time, then pick a penalty</div>
                <PenaltyButtons
                  penalty={editPenalty}
                  plusTwoCount={editPlusTwoCount}
                  onChange={(p, c) => { setEditPenalty(p); setEditPlusTwoCount(c); }}
                  size="sm"
                />
                <div className="flex gap-2">
                  <button className="btn-primary px-6" onClick={handleEditSubmit}>
                    Update
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-card-hover transition-colors"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : submitted ? (
            /* Submitted — waiting for others, still editable until the round ends */
            <div className="flex flex-col items-center gap-2">
              <div className={clsx('font-mono font-bold leading-none', timerColor())} style={{ fontSize: digitFontSize }}>
                {formatTime(pendingTime, pendingPenalty, settings.solvePrecision, pendingPlusTwoCount)}
              </div>
              <div className="text-sm text-muted">Waiting for others…</div>
              <button className="text-xs text-accent hover:underline mt-1" onClick={openEdit}>
                Edit time/penalty
              </button>
            </div>
          ) : awaitingSubmit ? (
            /* Stopped: choose a penalty, then submit. Nothing here sends on
               its own: the buttons only *select*, and the always-present
               Submit button (or Enter) is the single thing that commits. The
               penalty buttons used to double as the submit action for OK and
               DNF, with a Confirm button that only appeared once a +2 was
               stacked, so the step that actually sends your time was
               invisible until you happened to pick the one penalty that
               revealed it. The digit shows the penalised result, so picking
               +2 or DNF visibly changes the number you're about to send.

               From md up the controls sit beside the digit instead of under
               it, because this card is short and wide: stacked, the hint,
               penalty row and Submit button cost 114px of the little height
               there is, while most of the card's width sits empty either
               side of the time. Side by side the card only has to be as tall
               as the taller column, so the digit gets the full height back —
               at a 740px-tall window that is a 134px digit instead of the
               40px floor it was pinned to. Below md the card is narrow
               instead of short, so they stay stacked there.

               The row is centred as a unit, and both boxes in it have a width
               of their own for that to mean anything: the control column is
               240, and the digit's box is its label (see above). It was flex-1
               before, which pinned the pair flush right and left the slack
               piled up on the left of the card. gap-2 between the stacked pieces, not
               gap-4: below md this is still the tallest thing the card ever
               holds, and at its 160px minimum the extra spacing is the
               difference between fitting and scrolling. */
            <div className="flex flex-col items-center gap-2 w-full md:flex-row md:items-center md:justify-center md:gap-8">
              <div
                className={clsx(
                  'font-mono font-bold leading-none transition-colors md:min-w-0 md:text-right',
                  pendingPenalty === 'DNF' ? 'text-red-400' : pendingPlusTwoCount > 0 ? 'text-yellow-400' : timerColor(),
                )}
                style={{
                  fontSize: digitFontSize,
                  // The label's own width, so the pair is centred around what
                  // is actually on screen — the digit is monospace, so one ch
                  // is one glyph and this is exact. min() so a digit fitted to
                  // the full remaining width can't push the control column off
                  // the card's right edge.
                  width: isDesktop ? `min(${pendingLabel.length}ch, 100%)` : undefined,
                }}
              >
                {formatTime(pendingTime, pendingPenalty, settings.solvePrecision, pendingPlusTwoCount)}
              </div>
              {/* Content width, not PENALTY_COL_WIDTH: that constant is what
                  the digit's font *reserves*, deliberately the widest this
                  column ever gets, and pinning the column to it left the
                  difference as air inside its right edge — 28px of it, which
                  the centred row then carried as a lean to the right. */}
              <div className="flex flex-col items-center gap-2 md:shrink-0">
                <div className="text-xs text-muted">Choose a penalty, then submit</div>
                <PenaltyButtons
                  penalty={pendingPenalty}
                  plusTwoCount={pendingPlusTwoCount}
                  onChange={(p, c) => {
                    setPendingPenalty(p);
                    setPendingPlusTwoCount(c);
                  }}
                />
                <button
                  className="btn-primary px-8"
                  onClick={() => submitSolve(pendingPenalty, pendingTime, pendingPlusTwoCount)}
                >
                  {pendingPenalty === 'DNF'
                    ? 'Submit DNF'
                    : pendingPlusTwoCount > 0
                      ? `Submit +${pendingPlusTwoCount * 2}`
                      : 'Submit'}
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
                  onClick={() => { submitSolve('DNF', 0); setTypingInput(''); }}
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
              <div className={clsx('font-mono font-bold leading-none transition-colors', timerColor())} style={{ fontSize: digitFontSize }}>
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

        {/* Participant statuses — capped with internal scroll (up to 10
            players) rather than growing unboundedly and pushing the column
            past its budget. The cap is ROSTER_MAX_HEIGHT on a column with the
            room for it, and fitted to the column when there isn't. */}
        <div ref={participantsRef} className="card p-4 shrink-0">
          <div className="label mb-2">Players</div>
          <div
            className="space-y-2 overflow-y-auto pr-1"
            style={{ maxHeight: isDesktop ? rosterMaxHeight : ROSTER_MAX_HEIGHT }}
          >
            {room.participants.map((p) => {
              const st = participantStatus(p);
              const isMe = p.id === myId;
              return (
                <div key={p.id} className={clsx('flex items-center gap-2 text-sm', isMe && 'font-semibold')}>
                  {dot(st.color)}
                  <span className="flex-1 truncate">{p.name}{isMe && ' (you)'}</span>
                  {p.isHost && <HostBadge />}
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
      </div>

      {/* ── RIGHT: Stats + Leaderboard ── */}
      <div className="flex flex-col gap-4 min-h-0">
        {/* Personal stats */}
        <div ref={statsRef} className="card p-4 shrink-0">
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

        {/* Leaderboard — capped with internal scroll (like the players
            list) rather than flex-1, so Chat below gets to be the column's
            one genuinely elastic region. */}
        <div ref={leaderboardRef} className="card p-4 shrink-0">
          <div className="label mb-3">Leaderboard</div>
          {leaderboard.length === 0 ? (
            <div className="text-xs text-muted">No players yet</div>
          ) : (
            <div
              className="space-y-1 overflow-y-auto pr-1"
              style={{ maxHeight: isDesktop ? leaderboardMaxHeight : LEADERBOARD_MAX_HEIGHT }}
            >
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
                    {p.isHost && <HostBadge />}
                    <span className="font-mono text-accent font-semibold">{p.points}</span>
                    <span className="text-xs text-muted">pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat — the column's one elastic region, absorbing whatever's
            left after Stats/Leaderboard/History (all shrink-0, capped). */}
        <div className="card p-4 flex flex-col flex-1 min-h-0" style={{ minHeight: CHAT_MIN_HEIGHT }}>
          <div className="label mb-2">Chat</div>
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {chatMessages.length === 0 ? (
              <div className="text-xs text-muted">No messages yet. Say hi!</div>
            ) : (
              chatMessages.map((m, i) => {
                const isMe = m.participantId === myId;
                return (
                  <div key={i} className="text-xs leading-snug break-words">
                    <span className={clsx('font-semibold', isMe ? 'text-accent' : 'text-gray-900 dark:text-gray-200')}>
                      {m.name}:{' '}
                    </span>
                    <span className="text-muted">{m.message}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 shrink-0">
            <input
              className="input text-sm py-1.5"
              placeholder="Say something…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              maxLength={500}
            />
            <button
              className="text-muted hover:text-accent transition-colors p-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send"
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
            >
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </div>

        {/* My solve history */}
        {myHistory.length > 0 && (
          <div className="card p-4 shrink-0">
            <div className="label mb-3">My Round History</div>
            <div
              className="space-y-1 overflow-y-auto pr-1"
              style={{ maxHeight: isDesktop ? historyMaxHeight : HISTORY_MAX_HEIGHT }}
            >
              {[...myHistory].reverse().map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted font-mono">
                  <span className="w-4 text-right">{myHistory.length - i}.</span>
                  <span className={clsx('flex-1', s.penalty === 'DNF' && 'text-red-400')}>
                    {formatTime(s.time, s.penalty ?? 'NONE', settings.solvePrecision, s.plusTwoCount)}
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
      {isHost && code && (
        <ChangeEventModal
          open={showChangeEvent}
          onClose={() => setShowChangeEvent(false)}
          currentEventId={room.eventId}
          currentAlgSetId={room.algSetId}
          onSave={(newEventId, newAlgSetId) => changeEvent(code.toUpperCase(), newEventId, newAlgSetId ?? undefined)}
        />
      )}
    </div>
    </div>
  );
}
