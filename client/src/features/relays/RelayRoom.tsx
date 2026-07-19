import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import clsx from 'clsx';
import '@cubing/icons';
import { formatTime, getEvent } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { Icon } from '../../components/Icon';
import { ScramblePanel } from '../../components/ScramblePanel';
import { eventIconClass } from '../../lib/eventIcons';
import { useRelaySocket } from './useRelaySocket';

const UNASSIGNED = 'unassigned';

function EventTile({ id, eventId, label }: { id: string; eventId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined}
      className={clsx(
        'card p-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none w-20 shrink-0',
        isDragging && 'opacity-50',
      )}
    >
      <span className={`cubing-icon ${eventIconClass(eventId)}`} style={{ fontSize: 24, lineHeight: 1 }} />
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx(className, isOver && 'ring-2 ring-accent')}>
      {children}
    </div>
  );
}

export default function RelayRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const state = location.state as { displayName?: string; password?: string } | null;
  const displayName = user?.displayName ?? state?.displayName ?? '';
  const password = state?.password;

  const [namePrompt, setNamePrompt] = useState(!displayName);
  const [tempName, setTempName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [selectedLeg, setSelectedLeg] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [now, setNow] = useState(Date.now());
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

  // Ticks the shared clock during ACTIVE — derived from the server's
  // startedAt timestamp (broadcast once, at the moment the first holder
  // released), not a locally-owned start/stop state machine.
  useEffect(() => {
    if (room?.status !== 'ACTIVE') return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [room?.status]);

  const allAssigned = !!room && room.legs.every((l) => l.assignedToId);
  const allReady = !!room && room.participants.length > 0 && room.participants.every((p) => p.isReady);
  const canHold = room?.status === 'ASSIGNING' && allAssigned && allReady;

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
      setIsHolding(true);
      press(code.toUpperCase());
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTextTarget(e.target)) return;
      e.preventDefault();
      setIsHolding(false);
      release(code.toUpperCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [canHold, code, press, release]);

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

  const myLegs = room.legs.filter((l) => l.assignedToId === myParticipantId).sort((a, b) => a.order - b.order);
  const me = room.participants.find((p) => p.id === myParticipantId);
  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  const totalTimeMs = completed?.totalTimeMs ?? (room.status === 'FINISHED' && room.startedAt && room.finishedAt
    ? new Date(room.finishedAt).getTime() - new Date(room.startedAt).getTime()
    : null);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="card p-3 flex items-center gap-3">
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
        <div className="card p-6 text-center space-y-4">
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

      {room.status === 'ASSIGNING' && (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid md:grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-4">
              <div>
                <div className="label mb-2">Unassigned Events — drag onto a person</div>
                <DropZone id={UNASSIGNED} className="card p-3 flex flex-wrap gap-2 min-h-[88px]">
                  {room.legs.filter((l) => !l.assignedToId).map((l) => (
                    <EventTile key={l.id} id={l.id} eventId={l.eventId} label={legLabel(l.eventId, l.order)} />
                  ))}
                  {room.legs.every((l) => l.assignedToId) && <div className="text-xs text-muted p-2">All events assigned</div>}
                </DropZone>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {room.participants.map((p) => (
                  <div key={p.id} className="card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{p.name}{p.isHost && ' 👑'}</span>
                      {p.id === myParticipantId ? (
                        <button
                          className={clsx('text-xs px-2 py-1 rounded-full font-medium', p.isReady ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}
                          onClick={() => code && toggleReady(code.toUpperCase(), !p.isReady)}
                        >
                          {p.isReady ? 'Ready' : 'Not ready'}
                        </button>
                      ) : (
                        <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', p.isReady ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                          {p.isReady ? 'Ready' : 'Not ready'}
                        </span>
                      )}
                    </div>
                    <DropZone id={p.id} className="min-h-[60px] flex flex-wrap gap-2 rounded-lg">
                      {room.legs.filter((l) => l.assignedToId === p.id).map((l) => (
                        <EventTile key={l.id} id={l.id} eventId={l.eventId} label={legLabel(l.eventId, l.order)} />
                      ))}
                    </DropZone>
                  </div>
                ))}
              </div>

              {canHold && (
                <div className={clsx('card p-6 text-center space-y-2', isHolding ? 'border-2 border-green-400' : '')}>
                  <div className="text-lg font-semibold">Everyone's assigned and ready!</div>
                  <div className="text-sm text-muted">
                    Everyone hold spacebar — the clock starts the instant the first person lets go.
                  </div>
                  {holding.length > 0 && (
                    <div className="text-xs text-muted">
                      Holding: {room.participants.filter((p) => holding.includes(p.id)).map((p) => p.name).join(', ') || '—'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat */}
            <div className="card p-4 flex flex-col" style={{ height: 400 }}>
              <div className="label mb-2">Chat</div>
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

      {room.status === 'ACTIVE' && (
        <div className="space-y-4">
          <div className="card p-8 flex flex-col items-center gap-2">
            <div className="text-6xl font-mono tabular-nums">{formatTime(elapsedMs, 'NONE', 2)}</div>
            <div className="text-sm text-muted">
              {room.participants.filter((p) => p.isDone).length} / {room.participants.length} done
            </div>
            {!me?.isDone && (
              <button className="btn-primary mt-2" onClick={() => code && markDone(code.toUpperCase())}>
                I'm done with my events
              </button>
            )}
            {me?.isDone && <div className="text-sm text-green-400">Waiting for everyone else to finish…</div>}
          </div>

          {myLegs.length > 0 && (
            <div>
              <div className="label mb-2">Your Events</div>
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                {myLegs.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLeg(l.id)}
                    className={clsx('card p-3 flex flex-col items-center gap-1.5', selectedLeg === l.id ? 'border-accent border-2' : 'hover:bg-card-hover')}
                  >
                    <span className={`cubing-icon ${eventIconClass(l.eventId)}`} style={{ fontSize: 28, lineHeight: 1 }} />
                    <span className="text-xs font-medium text-center leading-tight">{legLabel(l.eventId, l.order)}</span>
                  </button>
                ))}
              </div>
              {(() => {
                const active = myLegs.find((l) => l.id === selectedLeg) ?? myLegs[0];
                return active ? <ScramblePanel eventId={active.eventId} scramble={active.scramble} /> : null;
              })()}
            </div>
          )}
        </div>
      )}

      {room.status === 'FINISHED' && (
        <div className="space-y-4">
          <div className="card p-8 flex flex-col items-center gap-2">
            <div className="text-sm text-muted">Team Time</div>
            <div className="text-5xl font-mono tabular-nums">{totalTimeMs !== null ? formatTime(totalTimeMs, 'NONE', 2) : '—'}</div>
            <button className="btn mt-3 px-4 py-2 rounded-lg text-sm border border-border" onClick={() => navigate('/relays/team')}>
              Back to Lobby
            </button>
          </div>
          <div>
            <div className="label mb-2">Breakdown</div>
            <div className="space-y-1.5">
              {room.legs.map((l) => {
                const p = room.participants.find((x) => x.id === l.assignedToId);
                return (
                  <div key={l.id} className="card p-3 flex items-center gap-3">
                    <span className={`cubing-icon ${eventIconClass(l.eventId)}`} style={{ fontSize: 20, lineHeight: 1 }} />
                    <span className="text-sm flex-1 min-w-0 truncate">{legLabel(l.eventId, l.order)}</span>
                    <span className="text-xs text-muted">{p?.name ?? 'Unassigned'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
