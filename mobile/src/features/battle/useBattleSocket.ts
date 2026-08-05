import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BattleRoomDTO,
  BattleRoundResultEntry,
  ChatMessageDTO,
  Penalty,
} from '@scc/shared';
import { createSocket, type SccSocket } from '../../lib/socket';

// Port of client/src/features/battle/useBattleSocket.ts.
//
// Every event name, payload and piece of derived state is the same, because the
// server is the same server and the room is the same database row: a room made
// on the web and joined from a phone is one Socket.io room with one set of
// participants. Nothing here is allowed to diverge from the web hook without the
// two platforms disagreeing about a room they are both in.
//
// The one real difference is the transport. `lib/socket.ts` connects to an
// explicit origin and carries the access token in the handshake, since a native
// client has no cookie jar; the web hook connects to its own origin and the
// cookie rides along by itself. Both end up verified by the same
// `verifyAccessToken` server-side.
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
  const socketRef = useRef<SccSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<BattleRoomDTO | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  // Errors the *room* raised: room not found, wrong password, room full, not
  // the host. These say something about this room and are worth acting on.
  const [error, setError] = useState<string | null>(null);
  // Errors the *connection* raised. Kept apart because socket.io retries these
  // by itself and they say nothing about the room, so treating them like a room
  // error would throw someone out of a perfectly good room over a tunnel blip.
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // Personal history, accumulated across rounds for as long as this screen is
  // open. Not persisted anywhere, same as on web.
  const [myHistory, setMyHistory] = useState<PersonalSolve[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>([]);
  // State as well as a ref: the room screen needs "am I the host" to be
  // reactive, and the round_result handler below is registered once with no
  // deps, so a closure over state there would never see an update. The ref is
  // for that handler; the state is for rendering.
  const [myParticipantId, setMyParticipantIdState] = useState<string | null>(null);
  const myParticipantIdRef = useRef<string | null>(null);
  // So a host changing the event, which resets points and rounds server-side,
  // also clears this device's local history rather than carrying it across.
  const prevEventKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnectionError(null);
    });
    // Clearing `room` and not just the flag: the room screen only shows its
    // "joining" state for a fully null room, so without this the window between
    // a reconnect and the fresh room_state would render the pre-drop snapshot,
    // which by then can be several rounds stale.
    socket.on('disconnect', () => {
      setConnected(false);
      setRoom(null);
    });
    socket.on('connect_error', (e) => setConnectionError(e.message || 'Could not reach the server'));

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
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === participantId
                  ? { ...p, time, penalty, plusTwoCount, finishedAt: new Date().toISOString() }
                  : p,
              ),
            }
          : prev,
      );
    });

    socket.on('round_result', ({ results, roundNumber }) => {
      setLastResult({ results, roundNumber });
      const myId = myParticipantIdRef.current;
      if (!myId) return;
      const mine = results.find((r) => r.participantId === myId);
      if (mine) {
        setMyHistory((prev) => [
          ...prev,
          {
            time: mine.time,
            penalty: mine.penalty,
            plusTwoCount: mine.plusTwoCount,
            rank: mine.rank,
            pointsEarned: mine.pointsEarned,
          },
        ]);
      }
    });

    socket.on('chat_message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('error_msg', ({ message }) => setError(message));

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback((payload: { code: string; name: string; password?: string }) => {
    socketRef.current?.emit('join_room', payload);
  }, []);

  const setMyParticipantId = useCallback((id: string) => {
    myParticipantIdRef.current = id;
    setMyParticipantIdState(id);
  }, []);

  const solveComplete = useCallback(
    (code: string, time: number, penalty: Penalty, plusTwoCount: number) => {
      socketRef.current?.emit('solve_complete', { code, time, penalty, plusTwoCount });
    },
    [],
  );

  const leaveRoom = useCallback((code: string) => {
    socketRef.current?.emit('leave_room', { code });
  }, []);

  /** Host only. The server rejects this from anybody else. */
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
    connectionError,
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
