import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BattlePublicRoomDTO } from '@scc/shared';
import { api } from '../../lib/api';
import { useScreenScale } from '../../lib/scale';
import { usePalette } from '../../store/settings';
import { useAuth } from '../../store/auth';
import {
  Button,
  EmptyState,
  Label,
  Loading,
  MONO,
  MONO_BOLD,
  Muted,
  Screen,
  ScreenTitle,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { font, radius, space, stroke } from '../../theme';
import { CreateRoomSheet, JoinRoomSheet, battleEventLabel } from './LobbySheets';
import { hydrateGuestName } from './guestName';
import type { BattleStackParamList } from '../../navigation/BattleStack';

type Props = NativeStackScreenProps<BattleStackParamList, 'BattleLobby'>;

const MAX_PLAYERS = 10;
const REFRESH_MS = 5000;

// The lobby: create a room, join one by code, or pick a public one.
//
// Same three jobs as the web lobby and the same points explainer, restructured
// for a phone: the two modals become sheets, and the public list is the page
// rather than one section of it, since finding a room is what you opened this
// for. Pull to refresh as well as the five-second poll, because a list that only
// updates on a timer gives you nothing to do when it looks stale.
export default function BattleLobbyScreen({ navigation }: Props) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<BattlePublicRoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Warmed here rather than in the sheets, so a guest opening either one sees
    // their stored name already filled in rather than appearing a beat later.
    void hydrateGuestName();
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<BattlePublicRoomDTO[]>('/battle/public');
      if (mounted.current) setRooms(data);
    } catch {
      // A failed poll leaves the last list up rather than emptying the screen:
      // the rooms are probably still there, this request just did not arrive.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Polls only while this screen is focused. The web page polls for as long as
  // it is mounted, which on a phone would mean a request every five seconds from
  // a screen behind three others, and on a battery.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const enterRoom = useCallback(
    (code: string, displayName: string, password?: string) => {
      navigation.navigate('BattleRoom', { code, displayName, password });
    },
    [navigation],
  );

  function joinPublic(room: BattlePublicRoomDTO) {
    // A signed-in player has a name already and can go straight in. A guest has
    // to supply one, and it is the only thing their participant row can be
    // matched by later, so the sheet asks rather than inventing one.
    if (user?.displayName) {
      enterRoom(room.code, user.displayName);
      return;
    }
    setJoinCode(room.code);
    setShowJoin(true);
  }

  return (
    <Screen edges={['top']} gap={0}>
      <ScrollView
        // `flex: 1` is what makes this scroll at all, and therefore what makes
        // pull-to-refresh work. A ScrollView with no flex inside a column
        // container sizes itself to its content, so it has no bounded viewport
        // to scroll within: the list simply overflows and is clipped, and the
        // pull gesture has nothing to act on. Screen's own scrolling variant
        // does the same thing for the same reason.
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.lg, paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            // tintColor is the iOS spinner; colors and progressBackgroundColor
            // are Android's, which would otherwise draw a default-light spinner
            // on this app's dark background.
            tintColor={p.textMuted}
            colors={[p.accent]}
            progressBackgroundColor={p.card}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              if (mounted.current) setRefreshing(false);
            }}
          />
        }
      >
        <View>
          <ScreenTitle>Battle</ScreenTitle>
          <Muted>Race other cubers on the same scramble. Rooms are shared with the website.</Muted>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Create room" variant="primary" style={{ flex: 1 }} onPress={() => setShowCreate(true)} />
          <Button
            label="Join by code"
            style={{ flex: 1 }}
            onPress={() => {
              setJoinCode('');
              setShowJoin(true);
            }}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Label>Public rooms</Label>
            <Muted style={{ fontSize: 11 }}>Updates every 5s</Muted>
          </View>

          {loading ? (
            <Loading />
          ) : rooms.length === 0 ? (
            <EmptyState title="No public rooms right now" body="Create one, or join with a code." />
          ) : (
            rooms.map((room) => {
              const full = room.participantCount >= MAX_PLAYERS;
              return (
                <Pressable
                  key={room.code}
                  accessibilityRole="button"
                  accessibilityLabel={`Join ${room.name}`}
                  accessibilityState={{ disabled: full }}
                  disabled={full}
                  onPress={() => joinPublic(room)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? p.cardHover : p.card,
                    borderColor: p.border,
                    borderWidth: stroke.thin,
                    borderRadius: radius.md,
                    padding: space.md,
                    opacity: full ? 0.55 : 1,
                    gap: 6,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, color: p.text, fontFamily: font.sansBold, fontSize: sc(15) }}
                    >
                      {room.name}
                    </Text>
                    <StatusBadge status={room.status} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: p.textMuted, fontSize: sc(12), fontFamily: font.sans }}>
                      {battleEventLabel(room.eventId, room.algSetId)}
                      {' · '}
                      {room.participantCount}/{MAX_PLAYERS} player{room.participantCount === 1 ? '' : 's'}
                    </Text>
                    <Text style={{ color: p.textMuted, fontFamily: MONO, fontSize: sc(12), letterSpacing: 1 }}>
                      {room.code}
                    </Text>
                    {full ? (
                      <Text style={{ color: p.textMuted, fontFamily: font.sansBold, fontSize: 12 }}>Full</Text>
                    ) : (
                      <Icon name="arrowRight" size={16} color={p.accent} />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View
          style={{
            backgroundColor: p.card,
            borderColor: p.border,
            borderWidth: stroke.thin,
            borderRadius: radius.md,
            padding: space.md,
            gap: 6,
          }}
        >
          <Text style={{ color: p.text, fontFamily: font.sansBold, fontSize: sc(14), marginBottom: 2 }}>
            How points work
          </Text>
          {[
            ['🥇 1st', '+5'],
            ['🥈 2nd', '+3'],
            ['🥉 3rd', '+2'],
            ['4th and below', '+1'],
            ['DNF', '+0'],
          ].map(([place, points]) => (
            <View key={place} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: p.textMuted, fontSize: sc(13), fontFamily: font.sans }}>{place}</Text>
              <Text style={{ color: p.text, fontSize: sc(13), fontFamily: MONO_BOLD }}>{points}</Text>
            </View>
          ))}
          <Muted style={{ marginTop: 4 }}>Points last for the lifetime of the room.</Muted>
        </View>
      </ScrollView>

      <CreateRoomSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(code, displayName, password) => enterRoom(code, displayName, password)}
      />
      <JoinRoomSheet
        visible={showJoin}
        initialCode={joinCode}
        onClose={() => setShowJoin(false)}
        onJoin={(code, displayName, password) => enterRoom(code, displayName, password)}
      />
    </Screen>
  );
}

function StatusBadge({ status }: { status: string }) {
  const p = usePalette();
  const active = status === 'ACTIVE';
  const color = active ? p.green : p.yellow;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: `${color}26`,
      }}
    >
      <Text style={{ color, fontSize: 11, fontFamily: font.sansBold }}>{active ? 'In round' : 'Waiting'}</Text>
    </View>
  );
}
