import { useEffect, useRef, useState, useCallback } from 'react';
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
      className={clsx(
        'card p-3 flex flex-col items-center gap-1.5 cursor-grab active:cursor-grabbing select-none w-28 shrink-0',
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

// ── The holding / active screen: mirrors SoloRelayRunner's layout language
// (a dominant clock, a tile strip, a capped scramble panel) but scoped to
// only this participant's own legs, and driven by the shared server clock
// (startedAt) instead of an owned timer engine. ──
const CLOCK_MIN_HEIGHT = 200;
const CLOCK_MAX_HEIGHT = 360;
const CLOCK_SHARE = 0.4;
const COLUMN_GAP = 12;
const FONT_SAFETY_MARGIN = 16;
const MAX_DIGIT_SIZE = 128;

function MyRelayPanel({
  room,
  me,
  holding,
  startedAt,
  code,
  press,
  release,
  markDone,
}: {
  room: RelayRoomDTO;
  me: RelayParticipantDTO | undefined;
  holding: string[];
  startedAt: string | null;
  code: string;
  press: (code: string) => void;
  release: (code: string) => void;
  markDone: (code: string) => void;
}) {
  // relay_started arrives before the (heavier) relay_room_state broadcast
  // that flips room.status to 'ACTIVE' — keying off startedAt too means the
  // clock visibly starts the instant that first, lighter event lands
  // instead of waiting on the second one. Safe to do: by the time
  // startedAt is set, every leg's scramble was already generated at the
  // ready-up step (see relaySocket.ts's generateScramblesIfReady), so
  // whatever `room` data is already in hand has what this screen needs.
  const isActive = room.status === 'ACTIVE' || !!startedAt;
  const iAmHolding = !!me && holding.includes(me.id);
  const myLegs = room.legs.filter((l) => l.assignedToId === me?.id).sort((a, b) => a.order - b.order);
  const [selected, setSelected] = useState(0);
  const activeLeg = myLegs[selected];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive]);

  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  const doneCount = room.participants.filter((p) => p.isDone).length;

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
        className="card relative shrink-0 flex flex-col items-center justify-center overflow-y-auto select-none touch-none cursor-pointer"
        style={{ height: isDesktop ? layout.clockHeight : undefined }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (isActive) {
            if (!me?.isDone) markDone(code);
          } else {
            press(code);
          }
        }}
        onPointerUp={(e) => {
          if (!isActive) {
            e.preventDefault();
            release(code);
          }
        }}
      >
        {isActive ? (
          <>
            <div className="font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0" style={{ fontSize: digitFontSize }}>
              {formatTime(elapsedMs, 'NONE', 2)}
            </div>
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">
              {me?.isDone
                ? 'Waiting for everyone else to finish…'
                : `Press Space (or tap) when you finish your events — ${doneCount}/${room.participants.length} done`}
            </p>
          </>
        ) : (
          <>
            <div
              className={clsx('font-mono font-bold tabular-nums leading-none w-full text-center px-8 shrink-0', iAmHolding && 'text-red-400')}
              style={{ fontSize: digitFontSize }}
            >
              {holding.length}/{room.participants.length}
            </div>
            <p className="text-sm text-muted mt-6 text-center px-4 shrink-0">
              {holding.length === room.participants.length
                ? 'Everyone is holding — let go to start!'
                : 'Hold spacebar (or tap and hold) — starts the instant everyone is holding and the first person lets go'}
            </p>
          </>
        )}
      </div>

      <div ref={tilesRef} className="shrink-0 flex flex-col gap-1.5">
        <div className="label mb-0">Your Events — click one to view its scramble</div>
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
        <div className="flex-1 min-h-0">
          <ScramblePanel eventId={activeLeg.eventId} scramble={activeLeg.scramble} maxHeight={layout.scrambleMaxHeight} className="h-full overflow-hidden" />
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
    holding,
    startedAt,
    completed,
    error,
    setError,
    chatMessages,
    myParticipantId,
    setMyParticipantId,
    joinRoom,
    leaveRoom,
    startRoom,
    assignEvent,
    toggleReady,
    press,
    release,
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
  const canHold = room?.status === 'ASSIGNING' && allAssigned && allReady;
  const showMyRelayPanel = canHold || room?.status === 'ACTIVE';
  const showAssigningScreen = room?.status === 'ASSIGNING' && !showMyRelayPanel;
  const me = room?.participants.find((p) => p.id === myParticipantId);
  const meIsReady = me?.isReady ?? false;
  const meIsDone = me?.isDone ?? false;

  // Hold-to-start is purely a signal to the server (which decides when
  // everyone has simultaneously held and the first release starts the
  // shared clock) — not a local timer state machine like the Timer page's.
  useEffect(() => {
    if (!canHold || !code) return;
    const isTextTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTextTarget(e.target)) return;
      e.preventDefault();
      press(code.toUpperCase());
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTextTarget(e.target)) return;
      e.preventDefault();
      release(code.toUpperCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [canHold, code, press, release]);

  // During ACTIVE, a single Space press (not a hold) signals "I'm done with
  // my events" — the relay itself stops once every participant has done
  // this (see relaySocket.ts's relay_mark_done), not on any kind of
  // simultaneous release the way starting requires.
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
                <div className="label mb-2">Unassigned Events — drag onto a person</div>
                <DropZone
                  id={UNASSIGNED}
                  className="card p-4 flex flex-wrap content-start gap-3 overflow-y-auto"
                  style={{ height: BOX_HEIGHT }}
                >
                  {room.legs.filter((l) => !l.assignedToId).map((l) => (
                    <EventTile key={l.id} id={l.id} eventId={l.eventId} label={legLabel(l.eventId, l.order)} />
                  ))}
                  {room.legs.every((l) => l.assignedToId) && <div className="text-sm text-muted p-2 self-center mx-auto">All events assigned</div>}
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
                        className="flex-1 min-h-0 flex flex-wrap content-start gap-2 rounded-lg overflow-y-auto"
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
                    {allAssigned ? 'Everyone must be ready before you can start holding spacebar.' : 'Assign every event to a person first.'}
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
          <MyRelayPanel room={room} me={me} holding={holding} startedAt={startedAt} code={(code ?? '').toUpperCase()} press={press} release={release} markDone={markDone} />
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
