import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RelayRoomDTO,
  RelayCompletedResult,
  ChatMessageDTO,
} from '@scc/shared';

type RelaySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// How many probes each sync burst sends, and how far apart. The best
// (lowest round trip) sample of a burst wins — see the relay_time_sync_result
// handler below.
const SYNC_SAMPLES = 5;
const SYNC_SAMPLE_GAP_MS = 200;
// Re-synced periodically so a long room session can't drift out of true.
const SYNC_REFRESH_MS = 30_000;

export function useRelaySocket() {
  const socketRef = useRef<RelaySocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RelayRoomDTO | null>(null);
  const [countdownStartAt, setCountdownStartAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState<RelayCompletedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [myParticipantId, setMyParticipantIdState] = useState<string | null>(null);
  const myParticipantIdRef = useRef<string | null>(null);

  // ── Server clock offset ────────────────────────────────────────────────
  // Every instant a relay deals in (countdown start, relay start, the total)
  // is on the *server's* clock, but a browser can only read its own — and
  // consumer devices are routinely seconds off. Rendering a server timestamp
  // against Date.now() directly is what produced both reported bugs: a
  // device running behind the server showed a negative elapsed time at the
  // start, and one running ahead showed a bigger number than the total the
  // server ultimately recorded. This is the correction, estimated NTP-style.
  //
  // Held in a ref, not state: it's read inside an animation frame loop and
  // by serverNow() below, and a re-render on every refined sample would be
  // pure churn for a value that only ever shifts by milliseconds.
  const clockOffsetRef = useRef(0);
  // Round trip of the best sample *of the burst in progress*. Within a burst
  // the fastest sample wins, since accuracy here is bounded by how
  // symmetric the trip was and a fast trip has less room to be lopsided.
  // Reset per burst rather than kept for the session on purpose: a device
  // that sleeps and resumes, or gets an NTP correction mid-session, moves
  // its clock under us, and an all-time-best sample from ten minutes ago
  // would otherwise lock in an offset that is now simply wrong.
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);

  // The server's current time, as best this client can tell.
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] }) as RelaySocket;
    socketRef.current = socket;

    let syncTimers: ReturnType<typeof setTimeout>[] = [];
    const sendSyncBurst = () => {
      bestRttRef.current = Number.POSITIVE_INFINITY;
      for (let i = 0; i < SYNC_SAMPLES; i++) {
        syncTimers.push(
          setTimeout(() => socket.emit('relay_time_sync', { clientSentAt: Date.now() }), i * SYNC_SAMPLE_GAP_MS),
        );
      }
    };

    socket.on('connect', () => {
      setConnected(true);
      sendSyncBurst();
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setRoom(null);
    });

    socket.on('relay_time_sync_result', ({ clientSentAt, serverNow }) => {
      const rtt = Date.now() - clientSentAt;
      if (rtt < 0 || rtt >= bestRttRef.current) return;
      // Assumes the two legs of the round trip took the same time, so the
      // server's reply describes the server's clock as of half a round trip
      // ago. Off by however lopsided the trip actually was, which for the
      // fastest sample of a burst is small next to the multi-second device
      // clock errors this exists to cancel out.
      bestRttRef.current = rtt;
      clockOffsetRef.current = serverNow + rtt / 2 - Date.now();
    });

    const refresh = setInterval(sendSyncBurst, SYNC_REFRESH_MS);

    socket.on('relay_room_state', (r) => {
      setRoom(r);
      // Authoritative for both clocks — this is what clears them on a room
      // reset (the host's "Run it again"/"Adjust distribution"). Without it
      // the *previous* run's startedAt would sit in local state forever,
      // since nothing else clears it, leaving the my-events panel stuck on
      // an already-running clock instead of returning to the ready screen.
      setCountdownStartAt(r.countdownStartAt);
      setStartedAt(r.startedAt);
    });
    // Both of these also arrive inside the room_state broadcast that follows
    // them, but that one is the heavier payload and lands a beat later —
    // handling the light events directly is what makes the countdown appear
    // and the clock flip over on time rather than a render or two late.
    socket.on('relay_countdown', ({ startAt }) => {
      setCountdownStartAt(startAt);
      setStartedAt(null);
    });
    socket.on('relay_countdown_cancelled', () => setCountdownStartAt(null));
    socket.on('relay_started', ({ startedAt }) => {
      setStartedAt(startedAt);
      setCountdownStartAt(null);
    });
    socket.on('relay_completed', (result) => setCompleted(result));
    socket.on('chat_message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('error_msg', ({ message }) => setError(message));

    return () => {
      clearInterval(refresh);
      syncTimers.forEach(clearTimeout);
      syncTimers = [];
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback((payload: { code: string; name: string; password?: string }, participantId?: string) => {
    const id = participantId ?? null;
    myParticipantIdRef.current = id;
    setMyParticipantIdState(id);
    socketRef.current?.emit('join_relay_room', payload);
  }, []);

  const setMyParticipantId = useCallback((id: string) => {
    myParticipantIdRef.current = id;
    setMyParticipantIdState(id);
  }, []);

  const leaveRoom = useCallback((code: string) => {
    socketRef.current?.emit('leave_relay_room', { code });
  }, []);

  const startRoom = useCallback((code: string) => {
    socketRef.current?.emit('relay_start_room', { code });
  }, []);

  const assignEvent = useCallback((code: string, legId: string, participantId: string | null) => {
    // Optimistic — the tile reflects its new slot the instant you drop it
    // instead of visually snapping back and then jumping once the
    // server's round trip confirms the move. Mirrors exactly what the
    // server itself does (see relaySocket.ts's relay_assign_event): move
    // the leg, reset everyone's ready state. The authoritative
    // relay_room_state broadcast that follows just confirms this — if it
    // ever disagrees (e.g. two people dragging at once), that broadcast
    // wins, same as before.
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        legs: prev.legs.map((l) => (l.id === legId ? { ...l, assignedToId: participantId } : l)),
        participants: prev.participants.map((p) => ({ ...p, isReady: false })),
      };
    });
    socketRef.current?.emit('relay_assign_event', { code, legId, participantId });
  }, []);

  const toggleReady = useCallback((code: string, isReady: boolean) => {
    socketRef.current?.emit('relay_toggle_ready', { code, isReady });
  }, []);

  // Distinct from toggleReady: that one approves the event distribution,
  // this one is "cube in hand, count me down" from the start screen. Only
  // this one can arm the countdown.
  const toggleStartReady = useCallback((code: string, isReady: boolean) => {
    socketRef.current?.emit('relay_toggle_start_ready', { code, isReady });
  }, []);

  // The stop instant is stamped here, the moment the key/tap actually
  // happened, and sent along — not left for the server to infer from when
  // the message arrives. Stamped in server-clock terms (serverNow), so the
  // total the server records is the number that was genuinely on screen,
  // rather than that plus however long the trip took. The server clamps it
  // to a latency-sized correction, so this is a nudge it can sanity-check,
  // not a time this client gets to declare.
  const markDone = useCallback(
    (code: string) => {
      socketRef.current?.emit('relay_mark_done', { code, at: Math.round(serverNow()) });
    },
    [serverNow],
  );

  const adjustDistribution = useCallback((code: string) => {
    socketRef.current?.emit('relay_adjust_distribution', { code });
  }, []);

  const runAgain = useCallback((code: string) => {
    socketRef.current?.emit('relay_run_again', { code });
  }, []);

  const sendChatMessage = useCallback((code: string, message: string) => {
    socketRef.current?.emit('send_chat_message', { code, message });
  }, []);

  return {
    connected,
    room,
    countdownStartAt,
    startedAt,
    serverNow,
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
    toggleStartReady,
    markDone,
    adjustDistribution,
    runAgain,
    sendChatMessage,
  };
}
