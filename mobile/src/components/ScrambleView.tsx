import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePalette, useSettings } from '../store/settings';
import { carrotScramble, formatScramble, isSquareOne, sq1Pairs } from '../lib/scramble';
import { font, radius, space } from '../theme';
import { MONO } from './ui';
import { Icon, type IconName } from './Icon';

// Scramble display, matching the web ScramblePanel's text rules (which is the
// part that actually matters for correctness): megaminx broken into one row per
// line with optional carrot notation, Square-1 split into "(a,b) /" pairs that
// wrap individually so a line never breaks mid-pair and a meaningful trailing
// slash is never dropped.
//
// Text only, by design: the scramble *image* is a separate component
// (ScrambleNet), so the Timer can place it in the footer beside the stats rather
// than stacked under the scramble text where it would compete with the timer for
// vertical space. Web draws its diagram with a cubing.js <twisty-player>, which
// has no React Native equivalent, so ScrambleNet renders the net natively
// instead. See components/ScrambleNet.tsx and lib/cubingSvg.ts.
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
            <ScrambleAction
              icon="skipBack"
              label="Previous scramble"
              onPress={onGoBack}
              disabled={!canGoBack}
            />
          )}
          {onRefresh && (
            <ScrambleAction icon="refresh" label="New scramble" onPress={onRefresh} disabled={loading} />
          )}
        </View>
      )}
    </View>
  );
}

// Icon-only, with the words moved to the accessibility label. The two controls
// are unambiguous as glyphs and this keeps the row from crowding the scramble it
// sits under.
function ScrambleAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: p.cardHover,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={16} color={p.text} />
    </Pressable>
  );
}
