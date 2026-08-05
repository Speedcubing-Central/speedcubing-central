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

  // How long a dropped connection is allowed to keep its last room snapshot on
  // screen. socket.io reconnects in about a second, and BattleRoom re-sends
  // join_room the moment it does, so for an ordinary blip the snapshot is only
  // ever a second stale and the room simply stays up. Past this, the
  // connection is not blipping, it is down, and a snapshot that old is a lie —
  // clear it and let the page fall back to its loading state.
  const STALE_ROOM_MS = 10_000;
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A solve completed while the connection is down. `emit` on a disconnected
  // socket is a silent no-op, so without this the submission is simply lost —
  // and the round then waits on a player who believes they have submitted.
  // Held until the server has acknowledged us again (see room_state below).
  const pendingSolveRef = useRef<
    { code: string; time: number; penalty: Penalty; plusTwoCount: number } | null
  >(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] }) as BattleSocket;
    socketRef.current = socket;

    socket.on('connect', () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      setConnected(true);
    });
    // The room snapshot deliberately outlives a disconnect now. It used to be
    // cleared here, which sounds harmless — the page shows a loading state for
    // the second or so a reconnect takes — except that BattleRoom bails out to
    // a bare "Connecting…" line for a null room, so every transient blip tore
    // the entire room off the screen and rebuilt it: scramble, timer,
    // leaderboard, chat. Nothing was ever actually lost (the server has all of
    // it, and this tab's own history never went anywhere), which is exactly
    // how it was reported — "it keeps disconnecting and reconnecting, but the
    // scramble and my results are still there". The reconnect was never the
    // problem; demolishing the page over it was. Keep the snapshot, mark the
    // connection, and let the header say so. Prolonged outages still clear it
    // (STALE_ROOM_MS), so a genuinely dead connection can't sit there showing
    // a room that may no longer resemble reality.
    socket.on('disconnect', (reason) => {
      setConnected(false);
      // Named reasons, because "some users keep getting disconnected" is only
      // actionable once you know whether it's the browser suspending a
      // backgrounded tab, a proxy closing the transport, or the server.
      console.warn(`[battle] socket disconnected: ${reason}`);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => setRoom(null), STALE_ROOM_MS);
    });

    socket.on('room_state', (r) => {
      const key = `${r.eventId}:${r.algSetId ?? ''}`;
      if (prevEventKeyRef.current !== null && prevEventKeyRef.current !== key) {
        setMyHistory([]);
      }
      prevEventKeyRef.current = key;
      setRoom(r);
      // The server only accepts a solve from a socket it has seen join, so a
      // held submission waits for this rather than for `connect` — room_state
      // is the first thing that follows the rejoin, and the proof it landed.
      const pending = pendingSolveRef.current;
      if (pending) {
        pendingSolveRef.current = null;
        socket.emit('solve_complete', pending);
      }
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
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
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
    const payload = { code, time, penalty, plusTwoCount };
    const socket = socketRef.current;
    // Held rather than dropped — see pendingSolveRef. Re-submitting (editing a
    // penalty) while still disconnected just replaces it, which is the right
    // answer: the last thing you chose is the thing you meant to send.
    if (!socket?.connected) {
      pendingSolveRef.current = payload;
      return;
    }
    socket.emit('solve_complete', payload);
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
