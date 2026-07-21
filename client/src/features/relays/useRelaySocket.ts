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

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] }) as RelaySocket;
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      setRoom(null);
    });

    socket.on('relay_room_state', (r) => setRoom(r));
    socket.on('relay_hold_state', ({ holding }) => setHolding(holding));
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
    if (id) setHolding((prev) => (prev.includes(id) ? prev : [...prev, id]));
    socketRef.current?.emit('relay_press', { code });
  }, []);

  const release = useCallback((code: string) => {
    const id = myParticipantIdRef.current;
    if (id) setHolding((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev));
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
