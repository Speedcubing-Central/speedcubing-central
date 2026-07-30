import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { formatMoveCount, formatTime, type PbHit } from '@scc/shared';
import { font, radius, space } from '../../theme';
import { MONO_BOLD } from '../../components/ui';

// The mobile PB celebration, matching the web client's PbCelebration.tsx: the
// same 2.8s window, the same 48 confetti pieces in the same six colours, the
// same randomized fall, drift and spin, and the same centred card listing every
// PB the solve just set.
//
// It replaced a banner tile that appeared in the footer, which pushed the
// scramble image and stats down the screen for four seconds every time you set a
// PB. An overlay is what the web does and it's the better behaviour anyway: a
// celebration shouldn't reflow the thing you're using.
//
// The web version is CSS keyframes; there's no CSS here, so this drives one
// shared Animated.Value from 0 to 1 and interpolates every piece off it. One
// driver rather than 48 keeps this to a single native animation, and because
// only transform and opacity are animated the whole thing runs on the native
// thread and never touches JS per frame, which matters on a screen whose entire
// job is timing.
const CELEBRATION_MS = 2800;
const CONFETTI_COUNT = 48;
const CONFETTI_COLORS = ['#2b72ff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#facc15'];

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  drift: number;
  size: number;
}

export function PbCelebration({
  hits,
  precision,
  isFmc,
  onDone,
}: {
  hits: PbHit[];
  precision: number;
  isFmc?: boolean;
  onDone: () => void;
}) {
  const { width, height } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;

  // Regenerated only when a new set of hits arrives, not on every render, so the
  // confetti never restarts or jumps mid-fall.
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * width,
        delay: Math.random() * 0.3,
        duration: 1.4 + Math.random() * 0.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: 180 + Math.random() * 540,
        drift: (Math.random() - 0.5) * 140,
        size: 7 + Math.random() * 5,
      })),
    [hits, width],
  );

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: CELEBRATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(t);
    // onDone is intentionally not a dependency: it's recreated every render by
    // the caller, and re-running this would restart the animation forever.
  }, [hits, progress]);

  return (
    // pointerEvents none throughout: the celebration must never eat a tap meant
    // for the timer underneath it.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => {
        // Each piece occupies [delay, delay+duration] of the shared timeline,
        // clamped so it holds still before and after its own window.
        const start = piece.delay / (CELEBRATION_MS / 1000);
        const end = Math.min(1, (piece.delay + piece.duration) / (CELEBRATION_MS / 1000));
        const range = { inputRange: [0, start, end, 1], extrapolate: 'clamp' as const };
        return (
          <Animated.View
            key={piece.id}
            style={{
              position: 'absolute',
              top: -20,
              left: piece.left,
              width: piece.size,
              height: piece.size * 1.6,
              backgroundColor: piece.color,
              borderRadius: 1.5,
              opacity: progress.interpolate({ ...range, outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: progress.interpolate({ ...range, outputRange: [0, 0, height + 40, height + 40] }) },
                { translateX: progress.interpolate({ ...range, outputRange: [0, 0, piece.drift, piece.drift] }) },
                {
                  rotate: progress.interpolate({
                    ...range,
                    outputRange: ['0deg', '0deg', `${piece.rotate}deg`, `${piece.rotate}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}

      <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg }}>
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: radius.lg,
            paddingHorizontal: space.xl,
            paddingVertical: space.lg,
            alignItems: 'center',
            gap: 6,
          }}
        >
          {hits.map((h, i) => (
            <PbLine
              key={`${h.label}-${i}`}
              hit={h}
              index={i}
              precision={precision}
              isFmc={isFmc}
              progress={progress}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// One PB line, entering with the same staggered rise the web version gives it.
function PbLine({
  hit,
  index,
  precision,
  isFmc,
  progress,
}: {
  hit: PbHit;
  index: number;
  precision: number;
  isFmc?: boolean;
  progress: Animated.Value;
}) {
  // Web staggers by 0.12s per line; same here, as a fraction of the timeline.
  const start = (index * 0.12) / (CELEBRATION_MS / 1000);
  const end = start + 0.35 / (CELEBRATION_MS / 1000);
  const range = { inputRange: [0, start, end, 1], extrapolate: 'clamp' as const };

  const value = isFmc
    ? formatMoveCount(hit.value, 'NONE', hit.label === 'single' ? 0 : 2)
    : formatTime(Math.round(hit.value), 'NONE', precision);

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        opacity: progress.interpolate({ ...range, outputRange: [0, 0, 1, 1] }),
        transform: [{ translateY: progress.interpolate({ ...range, outputRange: [14, 14, 0, 0] }) }],
      }}
    >
      <Text style={{ color: '#fff', fontFamily: MONO_BOLD, fontSize: 26, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: '#2b72ff', fontFamily: font.sansBlack, fontSize: 17 }}>PB {hit.label}</Text>
    </Animated.View>
  );
}
