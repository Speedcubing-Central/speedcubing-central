import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { formatTime } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import { Button, MONO, MONO_BOLD, Muted } from '../../components/ui';
import { font, radius, space, stroke } from '../../theme';
import type { RoundResult } from './useBattleSocket';

const MEDALS = ['🥇', '🥈', '🥉'];

// The scoreboard shown the moment a round is scored.
//
// Same content as the web overlay: who won, everyone's time in finishing order,
// and the points each of them earned. The differences are both about it being
// the whole screen here rather than a card on a desktop page:
//
//  * The list scrolls. Ten players at a legible size is taller than a phone.
//  * It says the next round starts by itself, because it does (the server
//    starts one five seconds later), and an overlay that looks like it is
//    waiting for you would otherwise imply the room is too.
//
// Dismissal is the caller's business: the room also clears this when the next
// round actually starts, so this can never end up covering a live attempt.
export function RoundResultOverlay({
  result,
  solvePrecision,
  onDismiss,
}: {
  result: RoundResult;
  solvePrecision: number;
  onDismiss: () => void;
}) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [fade]);

  const winner = result.results[0];
  const allDnf = !winner || winner.pointsEarned === 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: fade,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000b3',
        padding: space.lg,
      }}
    >
      {/* The backdrop dismisses, which is the gesture a phone user tries first
          on anything covering the screen. The card below stops the press so a
          tap aimed at the list does not close it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss round results"
        onPress={onDismiss}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '80%',
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: stroke.thin,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md,
        }}
      >
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text
            style={{
              color: p.textMuted,
              fontSize: 11,
              fontFamily: font.sansBold,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Round {result.roundNumber}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: p.text, fontSize: sc(20), fontFamily: font.sansBlack, textAlign: 'center' }}
          >
            {allDnf ? 'Nobody finished' : `${winner.name} wins`}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ gap: 2 }}>
          {result.results.map((r, i) => (
            <View
              key={r.participantId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 7 }}
            >
              <Text style={{ width: 26, textAlign: 'center', fontSize: 14 }}>{MEDALS[i] ?? `${i + 1}.`}</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: p.text, fontSize: sc(14), fontFamily: MONO }}>
                {r.name}
              </Text>
              <Text
                style={{
                  color: r.penalty === 'DNF' ? p.red : p.textMuted,
                  fontSize: sc(13),
                  fontFamily: MONO,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatTime(r.time, r.penalty ?? 'NONE', solvePrecision, r.plusTwoCount)}
              </Text>
              <Text
                style={{
                  minWidth: 34,
                  textAlign: 'right',
                  color: r.pointsEarned > 0 ? p.green : p.textMuted,
                  fontSize: sc(13),
                  fontFamily: MONO_BOLD,
                }}
              >
                +{r.pointsEarned}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Muted style={{ textAlign: 'center' }}>The next round starts on its own.</Muted>
        <Button label="Continue" variant="primary" onPress={onDismiss} />
      </View>
    </Animated.View>
  );
}
