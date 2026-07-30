import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  formatTime,
  getEvent,
  type BattlePublicRoomDTO,
  type BattleRoomDTO,
} from '@scc/shared';
import { api, apiError } from '../../lib/api';
import { createSocket, type SccSocket } from '../../lib/socket';
import { usePalette } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { Button, EmptyState, MONO, MONO_BOLD, Muted, Screen } from '../../components/ui';
import { font, radius, space } from '../../theme';

// Battle Mode, lobby and live room state, without gameplay.
//
// Gameplay (the timer, penalty submission, round results, chat) is explicitly out
// of scope for this pass. What IS here, and what matters most for the foundation,
// is the part that had to be proven rather than assumed: that a mobile client
// joins the *same* Socket.io room as a web client and sees the same live state.
//
// A Battle room is a database row keyed by its 6-character code, and
// `join_room`'s room membership is that code. Nothing about it is
// platform-specific. The one thing that wasn't platform-neutral was identity: the
// server's handshake middleware read the access token exclusively from the
// httpOnly access_token cookie, which a native client has no way to send. So a
// logged-in mobile user would have connected as a guest, and `join_room`'s
// reconnect matching (which matches a logged-in user by userId, and only falls
// back to guest-name matching otherwise) would have failed to resume their own
// participant row and its accumulated points.
//
// That's fixed by passing the stored access token through
// `socket.handshake.auth.token` (see lib/socket.ts) and verifying it server-side
// with the same verifyAccessToken the cookie path uses. This screen is what
// exercises it end to end: join a code created on the web and you appear in the
// web client's participant list, under your account name, in real time, and its
// participants appear here.
export default function BattleScreen() {
  const p = usePalette();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<BattlePublicRoomDTO[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState<BattleRoomDTO | null>(null);
  const [connectionNote, setConnectionNote] = useState<string | null>(null);
  const socketRef = useRef<SccSocket | null>(null);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await api.get<BattlePublicRoomDTO[]>('/battle/public');
      setRooms(data);
    } catch {
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // One socket for the lifetime of this screen; disconnected on unmount so a
  // participant row doesn't linger past the reconnect grace window.
  useEffect(
    () => () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    },
    [],
  );

  function join(roomCode: string) {
    const normalized = roomCode.trim().toUpperCase();
    if (!normalized) return;

    let socket = socketRef.current;
    if (!socket) {
      socket = createSocket();
      socketRef.current = socket;

      socket.on('connect', () => setConnectionNote('Connected'));
      socket.on('connect_error', (e) => setConnectionNote(`Connection failed: ${e.message}`));
      socket.on('disconnect', (reason) => setConnectionNote(`Disconnected (${reason})`));
      // The authoritative room state, broadcast to every member of the room
      // regardless of platform. This is the payload that proves a mobile client
      // and a web client are in the same room seeing the same thing.
      socket.on('room_state', (dto) => setJoined(dto));
      socket.on('error_msg', ({ message }) => Alert.alert('Battle', message));
    }
    if (!socket.connected) socket.connect();

    socket.emit('join_room', {
      code: normalized,
      // Identity for a logged-in user comes from the verified handshake token
      // server-side, never from this payload. The name is only used to label a
      // guest participant. Same contract as the web client.
      name: user?.displayName || 'Mobile guest',
    });
  }

  function leave() {
    const socket = socketRef.current;
    if (socket && joined) socket.emit('leave_room', { code: joined.code });
    setJoined(null);
  }

  async function createRoom() {
    try {
      const { data } = await api.post<{ code: string }>('/battle', {
        name: `${user?.displayName ?? 'Mobile'}'s room`,
        eventId: '333',
        isPublic: true,
      });
      setCode(data.code);
      join(data.code);
      loadRooms();
    } catch (e) {
      Alert.alert('Could not create room', apiError(e));
    }
  }

  if (joined) {
    return (
      <Screen scroll>
        <View>
          <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>{joined.name}</Text>
          <Muted>
            Room {joined.code} · {getEvent(joined.eventId)?.name ?? joined.eventId} · round {joined.roundNumber} ·{' '}
            {joined.status.toLowerCase()}
          </Muted>
        </View>

        <View
          style={{
            backgroundColor: p.card,
            borderColor: p.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space.md,
            gap: space.sm,
          }}
        >
          <Text style={{ color: p.text, fontFamily: font.sansBold }}>
            Players ({joined.participants.length})
          </Text>
          {joined.participants.map((participant) => (
            <View
              key={participant.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Text style={{ color: p.text, flex: 1 }}>
                {participant.name}
                {participant.isHost ? '  (host)' : ''}
                {/* A participant with a userId is a signed-in account; on mobile
                    that only happens when the handshake token verified. */}
                {participant.userId ? '' : '  · guest'}
              </Text>
              <Text style={{ color: p.textMuted, fontFamily: MONO, fontSize: 12 }}>
                {participant.time !== null
                  ? formatTime(participant.time, participant.penalty ?? 'NONE', 2, participant.plusTwoCount)
                  : participant.finishedAt
                    ? 'done'
                    : '—'}
              </Text>
              <Text style={{ color: p.accent, fontFamily: MONO_BOLD }}>{participant.points}</Text>
            </View>
          ))}
        </View>

        {joined.scramble ? (
          <View
            style={{
              backgroundColor: p.card,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: space.md,
            }}
          >
            <Muted style={{ marginBottom: 4 }}>Current scramble</Muted>
            <Text style={{ color: p.text, fontFamily: MONO, fontSize: 12, lineHeight: 19 }}>{joined.scramble}</Text>
          </View>
        ) : null}

        <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.md, padding: space.md }}>
          <Muted>
            Solving in a Battle room isn't in this build yet. This screen joins the room and shows its live state so
            cross-platform rooms can be verified. Round timing, penalties and chat come in a later pass.
          </Muted>
        </View>

        {connectionNote ? <Muted>{connectionNote}</Muted> : null}
        <Button label="Leave room" variant="danger" onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View>
        <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>Battle</Text>
        <Muted>Race other cubers in real time. Rooms are shared with the web app.</Muted>
      </View>

      <View
        style={{
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.md,
          gap: space.sm,
        }}
      >
        <Text style={{ color: p.text, fontFamily: font.sansBold }}>Join with a code</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={p.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={{
              flex: 1,
              color: p.text,
              fontFamily: MONO,
              fontSize: 18,
              letterSpacing: 2,
              textAlign: 'center',
              backgroundColor: p.cardHover,
              borderRadius: radius.sm,
              paddingVertical: 11,
            }}
          />
          <Button label="Join" variant="primary" onPress={() => join(code)} disabled={code.trim().length === 0} />
        </View>
        <Muted>A code created in the web app works here, and vice versa.</Muted>
      </View>

      <Button label="Create a public room" onPress={createRoom} />

      <View style={{ gap: space.sm }}>
        <Text
          style={{
            color: p.textMuted,
            fontSize: 11,
            fontFamily: font.sansBold,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Public rooms
        </Text>
        {loadingRooms ? (
          <Muted>Loading…</Muted>
        ) : rooms.length === 0 ? (
          <EmptyState title="No public rooms right now" body="Create one, or join with a code." />
        ) : (
          rooms.map((room) => (
            <Pressable
              key={room.code}
              accessibilityRole="button"
              onPress={() => {
                setCode(room.code);
                join(room.code);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? p.cardHover : p.card,
                borderColor: p.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.md,
              })}
            >
              <Text style={{ color: p.text, fontFamily: font.sansBold }}>{room.name}</Text>
              <Muted>
                {room.code} · {getEvent(room.eventId)?.name ?? room.eventId} · {room.participantCount}/10 ·{' '}
                {room.status.toLowerCase()}
              </Muted>
            </Pressable>
          ))
        )}
      </View>

      {connectionNote ? <Muted>{connectionNote}</Muted> : null}
    </Screen>
  );
}
