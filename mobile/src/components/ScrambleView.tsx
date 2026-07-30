import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePalette, useSettings } from '../store/settings';
import { carrotScramble, formatScramble, isSquareOne, sq1Pairs } from '../lib/scramble';
import { radius, space } from '../theme';
import { MONO } from './ui';

// Scramble display, matching the web ScramblePanel's text rules (which is the
// part that actually matters for correctness): megaminx broken into one row per
// line with optional carrot notation, Square-1 split into "(a,b) /" pairs that
// wrap individually so a line never breaks mid-pair and a meaningful trailing
// slash is never dropped.
//
// Deliberately text-only. The web panel also renders a cubing.js
// <twisty-player> 2D diagram; that's a web-component/WebGL widget with no React
// Native equivalent, and a scramble diagram is out of scope for this pass (see
// the Algorithms tab stub for the same reason). The scramble text itself is
// complete and correct.
export function ScrambleView({
  eventId,
  scramble,
  loading,
  onRefresh,
  onGoBack,
  canGoBack,
  compact = false,
}: {
  eventId: string;
  scramble: string;
  loading: boolean;
  onRefresh?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  compact?: boolean;
}) {
  const p = usePalette();
  const carrot = useSettings((s) => s.carrotNotation);

  const fontSize = compact ? 14 : eventId === 'minx' ? 13 : 17;

  let body: React.ReactNode;
  if (loading && !scramble) {
    body = <ActivityIndicator color={p.accent} />;
  } else if (isSquareOne(eventId)) {
    body = (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8, rowGap: 4 }}>
        {sq1Pairs(scramble).map((pair, i) => (
          <Text
            key={`${i}-${pair}`}
            style={{ color: p.text, fontFamily: MONO, fontSize, lineHeight: fontSize * 1.5 }}
          >
            {pair}
          </Text>
        ))}
      </View>
    );
  } else {
    const formatted = formatScramble(scramble, eventId);
    const text = eventId === 'minx' && carrot ? carrotScramble(formatted) : formatted;
    body = (
      <Text
        style={{
          color: p.text,
          fontFamily: MONO,
          fontSize,
          lineHeight: fontSize * 1.5,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    );
  }

  return (
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
      <View style={{ minHeight: compact ? 24 : 48, justifyContent: 'center' }}>{body}</View>
      {(onRefresh || onGoBack) && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
          {onGoBack && (
            <ScrambleAction label="Previous" onPress={onGoBack} disabled={!canGoBack} />
          )}
          {onRefresh && <ScrambleAction label="New scramble" onPress={onRefresh} disabled={loading} />}
        </View>
      )}
    </View>
  );
}

function ScrambleAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        backgroundColor: p.cardHover,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: p.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
