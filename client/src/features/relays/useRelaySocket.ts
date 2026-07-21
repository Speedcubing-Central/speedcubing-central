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

export function useRelaySocket() {
  const socketRef = useRef<RelaySocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RelayRoomDTO | null>(null);
  const [holding, setHolding] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState<RelayCompletedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  const [myParticipantId, setMyParticipantIdState] = useState<string | null>(null);
  const myParticipantIdRef = useRef<string | null>(null);
  // Kept in sync purely so release() below can read the *current* holding
  // set/participant count without stale-closure issues, despite being a
  // useCallback with an empty dep array (see press/release's own comments).
  const holdingRef = useRef<string[]>([]);
  const roomRef = useRef<RelayRoomDTO | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] }) as RelaySocket;
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      setRoom(null);
    });

    socket.on('relay_room_state', (r) => {
      setRoom(r);
      roomRef.current = r;
      // Authoritative — also fixes a real bug the optimistic release below
      // would otherwise cause: without this, a room reset (e.g. the host's
      // "Run it again"/"Adjust distribution") would leave the *previous*
      // run's startedAt sitting in local state forever, since nothing else
      // ever clears it, and the my-events panel would stay stuck showing
      // an already-running clock instead of returning to hold-to-start.
      setStartedAt(r.startedAt);
    });
    socket.on('relay_hold_state', ({ holding }) => {
      setHolding(holding);
      holdingRef.current = holding;
    });
    socket.on('relay_started', ({ startedAt }) => setStartedAt(startedAt));
    socket.on('relay_completed', (result) => setCompleted(result));
    socket.on('chat_message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('error_msg', ({ message }) => setError(message));

    return () => {
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

  // Optimistic, same reasoning as assignEvent above — your own press/
  // release should register the instant you do it, not once a full
  // server round trip confirms it. The server's own relay_hold_state
  // broadcast (reflecting every participant, not just you) still arrives
  // right after and is authoritative; this just avoids visibly waiting on
  // it for your own action specifically.
  const press = useCallback((code: string) => {
    const id = myParticipantIdRef.current;
    if (id) {
      const next = holdingRef.current.includes(id) ? holdingRef.current : [...holdingRef.current, id];
      holdingRef.current = next;
      setHolding(next);
    }
    socketRef.current?.emit('relay_press', { code });
  }, []);

  const release = useCallback((code: string) => {
    const id = myParticipantIdRef.current;
    const total = roomRef.current?.participants.length ?? 0;
    // If everyone (including me) was holding right before this release,
    // this release IS the one that starts the shared clock — the server
    // will confirm that, but there's no need to wait for its round trip to
    // find out something the client already knows from the last
    // relay_hold_state broadcast. Optimistically start the clock now;
    // relay_started's eventual arrival just corrects the exact timestamp
    // by whatever the round trip actually took (imperceptibly small).
    const wasEveryoneHolding = !!id && total > 0 && holdingRef.current.includes(id) && holdingRef.current.length === total;
    if (id) {
      const next = holdingRef.current.includes(id) ? holdingRef.current.filter((p) => p !== id) : holdingRef.current;
      holdingRef.current = next;
      setHolding(next);
    }
    if (wasEveryoneHolding) setStartedAt(new Date().toISOString());
    socketRef.current?.emit('relay_release', { code });
  }, []);

  const markDone = useCallback((code: string) => {
    socketRef.current?.emit('relay_mark_done', { code });
  }, []);

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
  };
}
