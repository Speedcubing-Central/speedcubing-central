import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePalette, useSettings } from '../store/settings';
import { carrotScramble, formatScramble, isSquareOne, sq1Pairs } from '../lib/scramble';
import { font, radius, space } from '../theme';
import { MONO } from './ui';
import { useScreenScale } from '../lib/scale';
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
  const { s: sc, isShort } = useScreenScale();

  // Scale with the scramble's own length rather than by event. A 7x7 scramble is
  // ~100 moves and at 17pt wrapped to a dozen lines, which ate enough of the
  // column that the footer below the timer was pushed off the bottom of a screen
  // that deliberately doesn't scroll. Megaminx used to be special-cased here for
  // exactly this reason; length covers it and every other long scramble too.
  const len = scramble?.length ?? 0;
  const isSq1 = isSquareOne(eventId);
  // Square-1 is sized by pair count, not character count. Its pairs are atomic
  // (a line may never break inside "(4, 0) /"), so characters don't predict how
  // many lines you get the way they do for a stream of individual moves: a
  // 12-pair scramble wrapped to six lines at the size its length asked for,
  // which squeezed the timer and clipped the hint underneath it.
  const pairs = isSq1 ? sq1Pairs(scramble) : null;
  // Two independent pressures, applied in order. First the scramble's own size
  // (a 7x7 or a 13-pair Square-1 needs smaller type than a 3x3), then the
  // screen's, so the same scramble is smaller on a shorter phone rather than
  // pushing the timer below it off the bottom.
  const byContent = compact
    ? 14
    : isSq1
      ? (pairs!.length > 10 ? 13 : 15)
      : len > 190
        ? 12
        : len > 120
          ? 13
          : len > 70
            ? 15
            : 17;
  // A floor of 10: below that a scramble stops being reliably readable at
  // arm's length, which defeats the point of showing it.
  const fontSize = Math.max(10, sc(byContent) - (isShort && !compact ? 1 : 0));

  let body: React.ReactNode;
  if (loading && !scramble) {
    body = <ActivityIndicator color={p.accent} />;
  } else if (pairs) {
    body = (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 6, rowGap: 3 }}>
        {pairs.map((pair, i) => (
          <Text
            key={`${i}-${pair}`}
            style={{ color: p.text, fontFamily: MONO, fontSize, lineHeight: fontSize * 1.28 }}
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
          lineHeight: fontSize * 1.28,
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
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: space.xs,
      }}
    >
      <View style={{ minHeight: compact ? 24 : sc(34), justifyContent: 'center' }}>{body}</View>
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
        width: 38,
        height: 28,
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
