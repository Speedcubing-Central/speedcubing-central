import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import clsx from 'clsx';
import '@cubing/icons';
import { formatTime, getEvent, type RelayParticipantDTO, type RelayRoomDTO } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ScramblePanel } from '../../components/ScramblePanel';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { eventIconClass } from '../../lib/eventIcons';
import { getGuestName, setGuestName } from '../../lib/guestName';
import { useRelaySocket } from './useRelaySocket';

const UNASSIGNED = 'unassigned';

// The unassigned-events pool's fixed height — modest and content-independent
// on purpose, since it's not the main event here. The per-participant boxes
// get the real "as big as possible" treatment instead: they fill whatever
// vertical space is actually available (grid-auto-rows: 1fr within a
// bounded, viewport-fit column — see the ASSIGNING screen below), which
// with few participants ends up far bigger than any fixed pixel value
// could reasonably guess. See MyRelayPanel below for the same
// non-content-driven approach applied to the clock/scramble split.
const BOX_HEIGHT = 208; // h-52

function EventTile({ id, eventId, label }: { id: string; eventId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined}
      // No fixed width — this is a grid item now (see DropZone's
      // auto-fill/minmax columns), so it stretches to fill its column
      // instead of a flex-wrap row leaving leftover space on the right
      // whenever the box is wider than an exact multiple of tile widths.
      className={clsx(
        'card p-3 flex flex-col items-center gap-1.5 cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-50',
      )}
    >
      <span className={`cubing-icon ${eventIconClass(eventId)}`} style={{ fontSize: 34, lineHeight: 1 }} />
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function DropZone({
  id,
  children,
  className,
  style,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx(className, isOver && 'ring-2 ring-accent')} style={style}>
      {children}
    </div>
  );
}

// ── The countdown / active screen: mirrors SoloRelayRunner's layout
// language (a dominant clock, a tile strip, a capped scramble panel) but
// scoped to only this participant's own legs, and driven by the shared
// server clock instead of an owned timer engine. ──
const CLOCK_MIN_HEIGHT = 200;
const CLOCK_MAX_HEIGHT = 360;
const CLOCK_SHARE = 0.4;
const COLUMN_GAP = 12;
const FONT_SAFETY_MARGIN = 16;
const MAX_DIGIT_SIZE = 128;

function MyRelayPanel({
  room,
  me,
  countdownStartAt,
  startedAt,
  serverNow,
  code,
  toggleStartReady,
  markDone,
}: {
  room: RelayRoomDTO;
  me: RelayParticipantDTO | undefined;
  countdownStartAt: string | null;
  startedAt: string | null;
  serverNow: () => number;
  code: string;
  toggleStartReady: (code: string, isReady: boolean) => void;
  markDone: (code: string) => void;
}) {
  // The instant this relay starts (or started), on the server's clock. The
  // countdown value is the same number the start will use — the server
  // commits to it up front — so once it elapses this screen flips to a
  // running clock on its own, without waiting for relay_started to make the
  // round trip. That's the point of announcing it early: every client
  // reaches t=0 together instead of each starting when its own packet lands.
  const startMs = startedAt
    ? new Date(startedAt).getTime()
    : countdownStartAt
      ? new Date(countdownStartAt).getTime()
      : null;
  // Being on this screen only means everyone's readied up — scramble
  // generation runs in the background afterward (generateScramblesIfReady
  // in relaySocket.ts) and can take a few seconds for slower events, so
  // there's a real window where a leg's scramble genuinely isn't here yet.
  // The server won't arm the countdown until they've all landed, so this is
  // just what fills the screen until then.
  const scramblesReady = room.legs.every((l) => !!l.scramble);
  // Generation now retries a slow/failed leg across a few rounds
  // server-side (see generateScramblesIfReady) rather than giving up
  // instantly, so this window can occasionally run several seconds long.
  // Purely cosmetic — just tells anyone staring at the spinner that a
  // retry is happening, not that something's broken.
  const [genWaitingLong, setGenWaitingLong] = useState(false);
  useEffect(() => {
    if (scramblesReady) {
      setGenWaitingLong(false);
      return;
    }
    const t = setTimeout(() => setGenWaitingLong(true), 8000);
    return () => clearTimeout(t);
  }, [scramblesReady]);
  const myLegs = room.legs.filter((l) => l.assignedToId === me?.id).sort((a, b) => a.order - b.order);
  const [selected, setSelected] = useState(0);
  const activeLeg = myLegs[selected];
  // Server time, not Date.now() — this device's own clock is only used via
  // serverNow()'s offset correction. See useRelaySocket for why.
  const [now, setNow] = useState(serverNow);

  // useLayoutEffect, and seeded before the loop rather than leaving the first
  // value to the first animation frame: `now` is deliberately not ticking
  // before there's a clock to show, so by the time the countdown is armed it
  // still holds whatever the time was when this panel mounted — potentially
  // a minute earlier, while the team sorted out their events. Left to
  // useEffect, React would paint one frame of `startMs - thatStaleNow` (a
  // countdown reading 33, say) before the first frame corrected it to 3.
  // A layout effect's state update is flushed before the browser paints, so
  // that frame never reaches the screen.
  useLayoutEffect(() => {
    if (startMs === null) return;
    setNow(serverNow());
    let raf = 0;
    const tick = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startMs, serverNow]);

  // Positive while counting down, so `3` covers the first whole second of a
  // three-second countdown and it reads 3 → 2 → 1 before hitting zero.
  const untilStartMs = startMs === null ? 0 : startMs - now;
  const countdownSeconds = Math.ceil(untilStartMs / 1000);
  // Clamped at zero so a client whose clock estimate is still settling can
  // never paint a negative time — the original symptom this whole change
  // exists to fix.
  const elapsedMs = startMs === null ? 0 : Math.max(0, now - startMs);
  // Which view this screen is in is decided by the server first and the
  // local clock only second. The local expiry is what makes the flip feel
  // instant (it beats relay_started's round trip), but it depends on `now`
  // advancing — and `now` is driven by requestAnimationFrame, which a
  // browser stops entirely for a backgrounded tab. Keyed on the local clock
  // alone, a team-mate who tabbed away during the countdown would come back
  // to a screen still counting down over an already-running relay.
  const serverStarted = room.status === 'ACTIVE' || !!startedAt;
  const isCountingDown = !serverStarted && untilStartMs > 0;
  const isRunning = serverStarted || (startMs !== null && untilStartMs <= 0);
  const doneCount = room.participants.filter((p) => p.isDone).length;
  // The gate the countdown actually waits on. Everyone reaching this screen
  // only means the event split was agreed — this is each person separately
  // saying they've got their cube and are ready to go.
  const startReadyCount = room.participants.filter((p) => p.isStartReady).length;
  const meIsStartReady = !!me?.isStartReady;
  const waitingOn = room.participants.filter((p) => !p.isStartReady).map((p) => p.name);
  const awaitingStartReady = !isRunning && !isCountingDown && scramblesReady;

  function legLabel(eventId: string, order: number): string {
    const before = room.legs.filter((l) => l.eventId === eventId && l.order < order).length;
    const total = room.legs.filter((l) => l.eventId === eventId).length;
    const name = getEvent(eventId)?.name ?? eventId;
    return total > 1 ? `${name} #${before + 1}` : name;
  }

  // Same deterministic, event/state-independent split used by the solo
  // relay runner — the clock/scramble ratio is a pure function of the
  // column's own height, not of anything that could race (see that file's
  // fix history for why measuring a content-dependent sibling isn't safe).
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
  const widthCap = layout.clockWidth * 0.34;
  const digitFontSize = Math.max(40, Math.min(layout.clockHeight - 68 - FONT_SAFETY_MARGIN, widthCap || MAX_DIGIT_SIZE, MAX_DIGIT_SIZE));

  return (
    <div ref={leftColRef} className="flex flex-col gap-3 h-full min-h-0">
      <div
        ref={clockRef}
        className={clsx(
          'card relative shrink-0 flex flex-col items-center justify-center overflow-y-auto select-none touch-none',
          ((isRunning && !me?.isDone) || awaitingStartReady || isCountingDown) && 'cursor-pointer',
        )}
        style={{ height: isDesktop ? layout.clockHeight : undefined }}
        onPointerDown={(e) => {
          if (isRunning) {
            if (me?.isDone) return;
            e.preventDefault();
            markDone(code);
            return;
          }
          // Before the start this surface is the ready-up control, and
          // during the countdown it's the abort — un-confirming calls the
          // countdown off, which is what letting go of spacebar used to do.
          if (awaitingStartReady || isCountingDown) {
            e.preventDefault();
            toggleStartReady(code, !meIsStartReady);
          }
        }}
      >
        {isRunning ? (
          <>
            <div className="font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0" style={{ fontSize: digitFontSize }}>
              {formatTime(elapsedMs, 'NONE', 2)}
            </div>
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">
              {me?.isDone
                ? 'Waiting for everyone else to finish…'
                : `Press Space (or tap) when you finish your events (${doneCount}/${room.participants.length} done)`}
            </p>
          </>
        ) : isCountingDown ? (
          <>
            <div
              className="font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0 text-accent"
              style={{ fontSize: digitFontSize }}
            >
              {countdownSeconds}
            </div>
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">Get ready — everyone starts together.</p>
          </>
        ) : !scramblesReady ? (
          <>
            <div className="h-10 w-10 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">
              {genWaitingLong
                ? "Still generating a couple of scrambles, retrying in the background. Won't be much longer…"
                : 'Generating scrambles…'}
            </p>
          </>
        ) : (
          <>
            <div
              className={clsx(
                'font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0',
                meIsStartReady && 'text-green-400',
              )}
              style={{ fontSize: digitFontSize }}
            >
              {startReadyCount}/{room.participants.length}
            </div>
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">
              {meIsStartReady
                ? // Named, not just counted. When this stalls, the whole
                  // question is who everyone is waiting on, and a bare
                  // "1/2 ready" makes that a guessing game.
                  `Waiting for ${waitingOn.join(', ')}. Press Space to cancel.`
                : 'Look at your scramble. Press Space (or tap) when you have your cube and are ready.'}
            </p>
          </>
        )}
      </div>

      <div ref={tilesRef} className="shrink-0 flex flex-col gap-1.5">
        <div className="label mb-0">Your Events (click one to view its scramble)</div>
        <div className="flex flex-wrap gap-1.5">
          {myLegs.map((l, i) => (
            <button
              key={l.id}
              onClick={() => setSelected(i)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors',
                selected === i ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card hover:bg-card-hover text-gray-700 dark:text-gray-200',
              )}
            >
              <span className={`cubing-icon ${eventIconClass(l.eventId)}`} style={{ fontSize: 18, lineHeight: 1 }} />
              {legLabel(l.eventId, l.order)}
            </button>
          ))}
          {myLegs.length === 0 && <div className="text-xs text-muted">No events assigned to you this round.</div>}
        </div>
      </div>

      {activeLeg && (
        <div className="flex-1 min-h-0 min-w-0">
          {/* Scrambles are generated as soon as everyone readies up, well
              before the countdown (see relaySocket.ts's
              generateScramblesIfReady) — but that generation is
              backgrounded server-side and can legitimately take a few
              seconds for some events, so there's a brief real window where
              a leg's scramble genuinely isn't here yet. `loading` shows the
              same "Scrambling…" state SoloRelayRunner uses rather than an
              empty string reading as a solved cube with no scramble at
              all. */}
          <ScramblePanel
            eventId={activeLeg.eventId}
            scramble={activeLeg.scramble}
            loading={!activeLeg.scramble}
            maxHeight={layout.scrambleMaxHeight}
            className="h-full overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}

export default function RelayRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const state = location.state as { displayName?: string; password?: string } | null;
  // Falls back to the persisted guest name (see lib/guestName.ts) for
  // anyone who reached this room via a raw shared link rather than the
  // lobby's join flow — location.state is only populated by that flow, and
  // doesn't survive a hard refresh either.
  const displayName = user?.displayName ?? state?.displayName ?? getGuestName();
  const password = state?.password;

  // Reactive, not just an initial useState — displayName can legitimately
  // become available a render or two after mount (e.g. while auth is still
  // loading), and the prompt must dismiss itself once it does instead of
  // staying stuck open forever.
  const [namePrompt, setNamePrompt] = useState(!displayName);
  useEffect(() => {
    if (displayName) setNamePrompt(false);
  }, [displayName]);
  const [tempName, setTempName] = useState(getGuestName);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const {
    connected,
    room,
    countdownStartAt,
    startedAt,
    serverNow,
    completed,
    error,
    setError,
    outdated,
    chatMessages,
    myParticipantId,
    setMyParticipantId,
    joinRoom,
    leaveRoom,
    startRoom,
    assignEvent,
    toggleReady,
    toggleStartReady,
    markDone,
    adjustDistribution,
    runAgain,
    sendChatMessage,
  } = useRelaySocket();

  const joined = useRef(false);
  useEffect(() => {
    if (!connected) { joined.current = false; return; }
    if (!code || namePrompt || joined.current) return;
    joined.current = true;
    const name = displayName || tempName;
    joinRoom({ code: code.toUpperCase(), name, password });
  }, [code, namePrompt, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!room || !displayName) return;
    const me = room.participants.find((p) => (user?.id && p.userId === user.id) || p.name === displayName);
    if (me) setMyParticipantId(me.id);
  }, [room, displayName, user?.id, setMyParticipantId]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError(null);
    }
  }, [error, setError]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const allAssigned = !!room && room.legs.every((l) => l.assignedToId);
  const allReady = !!room && room.participants.length > 0 && room.participants.every((p) => p.isReady);
  const readyCount = room?.participants.filter((p) => p.isReady).length ?? 0;
  // Transitioning into the my-events panel only needs allAssigned/allReady —
  // it shows a "Generating scrambles…" state itself until every scramble has
  // landed (see MyRelayPanel), then the countdown the server arms at that
  // same moment, rather than bouncing back to the assignment screen.
  const readyToShowPanel = room?.status === 'ASSIGNING' && allAssigned && allReady;
  const showMyRelayPanel = readyToShowPanel || room?.status === 'ACTIVE';
  const showAssigningScreen = room?.status === 'ASSIGNING' && !showMyRelayPanel;
  const me = room?.participants.find((p) => p.id === myParticipantId);
  const meIsReady = me?.isReady ?? false;
  const meIsStartReady = me?.isStartReady ?? false;
  const meIsDone = me?.isDone ?? false;
  // Scrambles have to be on screen before anyone can say they're ready to
  // solve — confirming against a scramble you can't see yet is meaningless.
  const scramblesReady = !!room && room.legs.every((l) => !!l.scramble);
  const canStartReady = readyToShowPanel && scramblesReady && room?.status !== 'ACTIVE';

  // On the start screen, Space toggles "ready to solve" — the gate the
  // countdown waits on. It stays live during the countdown so the same key
  // aborts it, which is what releasing spacebar used to do.
  useEffect(() => {
    if (!canStartReady || !code) return;
    const isTextTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTextTarget(e.target)) return;
      e.preventDefault();
      toggleStartReady(code.toUpperCase(), !meIsStartReady);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [canStartReady, meIsStartReady, code, toggleStartReady]);

  // During ACTIVE, a single Space press signals "I'm done with my events";
  // the relay stops once every participant has done this (see
  // relaySocket.ts's relay_mark_done).
  useEffect(() => {
    if (room?.status !== 'ACTIVE' || meIsDone || !code) return;
    const isTextTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTextTarget(e.target)) return;
      e.preventDefault();
      markDone(code.toUpperCase());
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [room?.status, meIsDone, code, markDone]);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (!code || !e.over) return;
      const legId = String(e.active.id);
      const target = String(e.over.id);
      assignEvent(code.toUpperCase(), legId, target === UNASSIGNED ? null : target);
    },
    [code, assignEvent],
  );

  function handleLeave() {
    if (code) leaveRoom(code.toUpperCase());
    navigate('/relays/team');
  }

  function handleNameSubmit() {
    if (!tempName.trim()) return;
    setGuestName(tempName.trim());
    setNamePrompt(false);
    setTimeout(() => { joined.current = false; }, 0);
  }

  function handleSendChat() {
    const message = chatInput.trim();
    if (!message || !code) return;
    sendChatMessage(code.toUpperCase(), message);
    setChatInput('');
  }

  function legLabel(eventId: string, order: number): string {
    if (!room) return eventId;
    const before = room.legs.filter((l) => l.eventId === eventId && l.order < order).length;
    const total = room.legs.filter((l) => l.eventId === eventId).length;
    const name = getEvent(eventId)?.name ?? eventId;
    return total > 1 ? `${name} #${before + 1}` : name;
  }

  // Ahead of every other screen, including the name prompt: this tab cannot
  // take part at all, and the room it would have joined is better off
  // without it (see relaySocket.ts's protocol check). "Joining room…"
  // forever would read as a hang, which is the failure this replaces.
  if (outdated) {
    return (
      <div className="max-w-sm mx-auto card p-6 space-y-4 text-center">
        <h2 className="text-lg font-bold">This page is out of date</h2>
        <p className="text-sm text-muted">
          Team Relay was updated while this tab was open. Reload to get the current version — you can rejoin the room
          straight after.
        </p>
        <button className="btn-primary w-full" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  if (namePrompt) {
    return (
      <div className="max-w-sm mx-auto card p-6 space-y-4">
        <h2 className="text-lg font-bold">Join Relay Room</h2>
        <input
          autoFocus
          className="input w-full"
          placeholder="Your display name"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
        />
        <button className="btn-primary w-full" onClick={handleNameSubmit}>Continue</button>
      </div>
    );
  }

  if (!connected) return <div className="p-8 text-muted text-center">Connecting…</div>;
  if (!room) return <div className="p-8 text-muted text-center">Joining room…</div>;

  const totalTimeMs = completed?.totalTimeMs ?? (room.status === 'FINISHED' && room.startedAt && room.finishedAt
    ? new Date(room.finishedAt).getTime() - new Date(room.startedAt).getTime()
    : null);

  const fillHeight = showMyRelayPanel || showAssigningScreen;

  return (
    // The height-bound treatment (fills the viewport like TimerPage, no
    // page scroll) applies to the assignment screen and the my-events
    // panel — the two screens where cramming everything into the actual
    // available space matters (bigger drop zones, a bigger clock). LOBBY
    // and the FINISHED modal are just small centered cards and keep the
    // page's normal auto-height flow.
    <div className={clsx('flex flex-col gap-4', fillHeight ? 'md:h-[calc(100dvh-2rem)]' : 'pb-8')}>
      {/* Header */}
      <div className="card p-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{room.name}</div>
          <div className="text-xs text-muted">
            {room.relayName} · <span className="font-mono tracking-wider">{room.code}</span>
          </div>
        </div>
        <button className="text-muted hover:text-red-400 transition-colors p-1" title="Leave room" onClick={handleLeave}>
          <Icon name="logout" size={18} />
        </button>
      </div>

      {room.status === 'LOBBY' && (
        <div className="max-w-lg mx-auto card p-6 text-center space-y-4">
          <div className="text-sm text-muted">
            Waiting in the lobby. Share the code <span className="font-mono font-semibold text-accent">{room.code}</span> with your team.
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {room.participants.map((p) => (
              <span key={p.id} className="px-3 py-1.5 rounded-full bg-card-hover text-sm">
                {p.name}{p.isHost && ' (host)'}
              </span>
            ))}
          </div>
          {me?.isHost && (
            <button className="btn-primary" onClick={() => code && startRoom(code.toUpperCase())}>
              Start Assigning Events
            </button>
          )}
        </div>
      )}

      {showAssigningScreen && (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid xl:grid-cols-[3fr_1fr] gap-4 flex-1 min-h-0">
            <div className="flex flex-col gap-4 min-h-0">
              {/* Unassigned pool — shrink-0, modest fixed size; the
                  participant boxes below are where "as big as possible"
                  actually matters. */}
              <div className="shrink-0">
                <div className="label mb-2">Unassigned Events (drag onto a person)</div>
                <DropZone
                  id={UNASSIGNED}
                  className="card p-4 grid content-start gap-3 overflow-y-auto"
                  style={{ height: BOX_HEIGHT, gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}
                >
                  {room.legs.filter((l) => !l.assignedToId).map((l) => (
                    <EventTile key={l.id} id={l.id} eventId={l.eventId} label={legLabel(l.eventId, l.order)} />
                  ))}
                  {room.legs.every((l) => l.assignedToId) && <div className="text-sm text-muted p-2 col-span-full text-center">All events assigned</div>}
                </DropZone>
              </div>

              {/* Participant boxes — fill whatever vertical space is left
                  (flex-1) instead of a small fixed height; grid-auto-rows:
                  1fr stretches every row of cards to share that space
                  evenly, so with few participants each box gets genuinely
                  large. Still not content-driven — a row's height comes
                  from how much room is available, never from how many
                  events happen to be sitting in a box that round. */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid gap-4 h-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gridAutoRows: '1fr' }}>
                  {room.participants.map((p) => (
                    <div key={p.id} className="card p-3 flex flex-col gap-2 min-h-[160px]">
                      <div className="flex items-center justify-between gap-2 shrink-0">
                        <span className="text-sm font-medium truncate">{p.name}{p.isHost && ' 👑'}</span>
                        <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', p.isReady ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                          {p.isReady ? 'Ready' : 'Not ready'}
                        </span>
                      </div>
                      <DropZone
                        id={p.id}
                        className="flex-1 min-h-0 grid content-start gap-2 rounded-lg overflow-y-auto"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}
                      >
                        {room.legs.filter((l) => l.assignedToId === p.id).map((l) => (
                          <EventTile key={l.id} id={l.id} eventId={l.eventId} label={legLabel(l.eventId, l.order)} />
                        ))}
                      </DropZone>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ready control — one canonical button for the whole team,
                  disabled until every event has a home. */}
              <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="font-semibold">{readyCount} / {room.participants.length} ready</div>
                  <div className="text-xs text-muted">
                    {allAssigned
                      ? "Once everyone approves the split, you'll see your scramble and ready up from there."
                      : 'Assign every event to a person first.'}
                  </div>
                </div>
                <button
                  className={clsx('btn-primary px-8 py-2.5', !allAssigned && 'opacity-40 cursor-not-allowed')}
                  disabled={!allAssigned}
                  onClick={() => code && toggleReady(code.toUpperCase(), !meIsReady)}
                >
                  {meIsReady ? "I'm ready ✓" : 'Ready'}
                </button>
              </div>
            </div>

            {/* Chat — fills the same bounded column height as the content
                side, instead of a fixed 400px that left a growing gap of
                its own on tall screens. */}
            <div className="card p-4 flex flex-col min-h-0">
              <div className="label mb-2 shrink-0">Chat</div>
              <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-muted">Discuss who's doing what…</div>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} className="text-xs leading-snug break-words">
                      <span className={clsx('font-semibold', m.participantId === myParticipantId ? 'text-accent' : 'text-gray-900 dark:text-gray-200')}>
                        {m.name}:{' '}
                      </span>
                      <span className="text-muted">{m.message}</span>
                    </div>
                  ))
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
                <button className="text-muted hover:text-accent transition-colors p-1.5 shrink-0 disabled:opacity-40" title="Send" onClick={handleSendChat} disabled={!chatInput.trim()}>
                  <Icon name="arrowRight" size={18} />
                </button>
              </div>
            </div>
          </div>
        </DndContext>
      )}

      {showMyRelayPanel && room && (
        <div className="flex-1 min-h-0">
          <MyRelayPanel
            room={room}
            me={me}
            countdownStartAt={countdownStartAt}
            startedAt={startedAt}
            serverNow={serverNow}
            code={(code ?? '').toUpperCase()}
            toggleStartReady={toggleStartReady}
            markDone={markDone}
          />
        </div>
      )}

      {room.status === 'FINISHED' && (
        <Modal open onClose={handleLeave} title="Relay complete!" size="md">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="text-5xl font-mono font-bold tabular-nums">{totalTimeMs !== null ? formatTime(totalTimeMs, 'NONE', 2) : '—'}</div>
            <div className="w-full space-y-1.5 max-h-56 overflow-y-auto">
              {room.legs.map((l) => {
                const p = room.participants.find((x) => x.id === l.assignedToId);
                return (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg bg-card-hover/50 px-3 py-2 text-sm">
                    <span className={`cubing-icon ${eventIconClass(l.eventId)}`} style={{ fontSize: 18, lineHeight: 1 }} />
                    <span className="flex-1 min-w-0 truncate">{legLabel(l.eventId, l.order)}</span>
                    <span className="text-xs text-muted">{p?.name ?? 'Unassigned'}</span>
                  </div>
                );
              })}
            </div>
            {me?.isHost ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
                <button
                  className="btn flex-1 py-2.5 rounded-lg text-sm border border-border"
                  onClick={() => code && adjustDistribution(code.toUpperCase())}
                >
                  Adjust distribution
                </button>
                <button className="btn-primary flex-1 py-2.5" onClick={() => code && runAgain(code.toUpperCase())}>
                  Run it again
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted text-center">Waiting for the host to start another round…</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
