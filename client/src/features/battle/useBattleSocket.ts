import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  BattleRoomDTO,
  BattleRoundResultEntry,
  ChatMessageDTO,
  Penalty,
} from '@scc/shared';

type BattleSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface RoundResult {
  roundNumber: number;
  results: BattleRoundResultEntry[];
}

export interface PersonalSolve {
  time: number | null;
  penalty: Penalty | null;
  plusTwoCount: number;
  rank: number;
  pointsEarned: number;
}

export function useBattleSocket() {
  const socketRef = useRef<BattleSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<BattleRoomDTO | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-session personal history (accumulated across rounds while this tab is open).
  const [myHistory, setMyHistory] = useState<PersonalSolve[]>([]);
  // Chat is intentionally ephemeral (not persisted server-side, same as
  // round history) — accumulated only for as long as this tab stays on
  // this room.
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  // Real state (not just a ref) so components re-render when it changes —
  // e.g. BattleRoom's host-only controls need to know "is this me" reactively,
  // and a ref alone wouldn't trigger a re-render until some *other* room_state
  // update happened to land afterward. The ref alongside it exists purely for
  // the round_result handler below, registered once in the effect with no
  // deps — a stale closure over state there would never see updates after
  // the first render, so it needs the always-current ref instead.
  const [myParticipantId, setMyParticipantIdState] = useState<string | null>(null);
  const myParticipantIdRef = useRef<string | null>(null);
  // Tracks the room's (eventId, algSetId) so a host-triggered event change —
  // which resets round history server-side — also clears this tab's own
  // local history, instead of it carrying over from the old event.
  const prevEventKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] }) as BattleSocket;
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    // Clearing `room` (not just flipping `connected`) matters: BattleRoom
    // only special-cases a fully-null room ("Joining room…"), so without
    // this a brief window between reconnecting and the fresh room_state
    // arriving would render the *previous* (now possibly-stale) snapshot
    // rather than a loading state.
    socket.on('disconnect', () => {
      setConnected(false);
      setRoom(null);
    });

    socket.on('room_state', (r) => {
      const key = `${r.eventId}:${r.algSetId ?? ''}`;
      if (prevEventKeyRef.current !== null && prevEventKeyRef.current !== key) {
        setMyHistory([]);
      }
      prevEventKeyRef.current = key;
      setRoom(r);
    });

    socket.on('round_start', ({ scramble, roundNumber }) => {
      setRoom((prev) => (prev ? { ...prev, status: 'ACTIVE', scramble, roundNumber } : prev));
    });

    socket.on('participant_finished', ({ participantId, time, penalty, plusTwoCount }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === participantId
              ? { ...p, time, penalty, plusTwoCount, finishedAt: new Date().toISOString() }
              : p,
          ),
        };
      });
    });

    socket.on('round_result', ({ results, roundNumber }) => {
      setLastResult({ results, roundNumber });
      // Record this round in personal history.
      const myId = myParticipantIdRef.current;
      if (myId) {
        const mine = results.find((r) => r.participantId === myId);
        if (mine) {
          setMyHistory((prev) => [
            ...prev,
            { time: mine.time, penalty: mine.penalty, plusTwoCount: mine.plusTwoCount, rank: mine.rank, pointsEarned: mine.pointsEarned },
          ]);
        }
      }
    });

    socket.on('chat_message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('error_msg', ({ message }) => setError(message));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback(
    (payload: { code: string; name: string; password?: string }, participantId?: string) => {
      const id = participantId ?? null;
      myParticipantIdRef.current = id;
      setMyParticipantIdState(id);
      socketRef.current?.emit('join_room', payload);
    },
    [],
  );

  // Called after join_room is acknowledged via room_state so we can grab our participant id.
  const setMyParticipantId = useCallback((id: string) => {
    myParticipantIdRef.current = id;
    setMyParticipantIdState(id);
  }, []);

  const solveComplete = useCallback((code: string, time: number, penalty: Penalty, plusTwoCount: number) => {
    socketRef.current?.emit('solve_complete', { code, time, penalty, plusTwoCount });
  }, []);

  const leaveRoom = useCallback((code: string) => {
    socketRef.current?.emit('leave_room', { code });
  }, []);

  // Host-only — the server rejects this if the caller isn't the room's current host.
  const changeEvent = useCallback((code: string, eventId: string, algSetId?: string) => {
    socketRef.current?.emit('change_event', { code, eventId, algSetId });
  }, []);

  const sendChatMessage = useCallback((code: string, message: string) => {
    socketRef.current?.emit('send_chat_message', { code, message });
  }, []);

  return {
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
  };
}
