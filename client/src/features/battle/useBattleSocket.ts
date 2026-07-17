import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  BattleRoomDTO,
  BattleRoundResultEntry,
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
  const myParticipantIdRef = useRef<string | null>(null);

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
      setRoom(r);
    });

    socket.on('round_start', ({ scramble, roundNumber }) => {
      setRoom((prev) => (prev ? { ...prev, status: 'ACTIVE', scramble, roundNumber } : prev));
    });

    socket.on('participant_finished', ({ participantId, time, penalty }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === participantId
              ? { ...p, time, penalty, finishedAt: new Date().toISOString() }
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
            { time: mine.time, penalty: mine.penalty, rank: mine.rank, pointsEarned: mine.pointsEarned },
          ]);
        }
      }
    });

    socket.on('error_msg', ({ message }) => setError(message));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback(
    (payload: { code: string; name: string; password?: string }, participantId?: string) => {
      myParticipantIdRef.current = participantId ?? null;
      socketRef.current?.emit('join_room', payload);
    },
    [],
  );

  // Called after join_room is acknowledged via room_state so we can grab our participant id.
  const setMyParticipantId = useCallback((id: string) => {
    myParticipantIdRef.current = id;
  }, []);

  const solveComplete = useCallback((code: string, time: number, penalty: Penalty) => {
    socketRef.current?.emit('solve_complete', { code, time, penalty });
  }, []);

  const leaveRoom = useCallback((code: string) => {
    socketRef.current?.emit('leave_room', { code });
  }, []);

  return {
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
  };
}
