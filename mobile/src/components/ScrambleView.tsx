import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { usePalette, useSettings } from '../store/settings';
import { carrotScramble, formatScramble, isSquareOne, sq1Pairs } from '../lib/scramble';
import { space } from '../theme';
import { IconPill, MONO } from './ui';
import { ScrambleNet, hasScrambleNet } from './ScrambleNet';
import { useScreenScale } from '../lib/scale';

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
  onEdit,
  onCopy,
  onOpenImage,
  imageHeight,
  compact = false,
}: {
  eventId: string;
  scramble: string;
  loading: boolean;
  onRefresh?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  onEdit?: () => void;
  onCopy?: () => void;
  /** Opens the full-size view. Also what tapping the image itself does. */
  onOpenImage?: () => void;
  /**
   * Height for the scramble image, or omitted to draw no image at all.
   *
   * A height and not a width: the drawing's aspect ratio is only known once
   * cubing.js has resolved it, so reserving the box by the dimension known up
   * front is what stops the column reflowing when the image lands. See
   * `scrambleImageHeight` in lib/scramble.ts for how the number is chosen.
   */
  imageHeight?: number;
  compact?: boolean;
}) {
  const p = usePalette();
  const carrot = useSettings((s) => s.carrotNotation);
  const { s: sc, isShort, width: screenWidth } = useScreenScale();

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
      ? (pairs!.length > 10 ? 14 : 17)
      : len > 190
        ? 13
        : len > 120
          ? 15
          : len > 70
            ? 18
            : 22;
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
    // No card. The scramble is a label on the instrument, not a panel of its
    // own: giving it the same border and fill as the readout below made five
    // identical rectangles down the screen, and nothing then signalled which of
    // them mattered. Reading it needs contrast and space, not a frame.
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingTop: space.xs,
        gap: space.xs,
      }}
    >
      <View style={{ minHeight: compact ? 24 : sc(34), justifyContent: 'center' }}>{body}</View>
      {/* Icon-only, with the words moved to the accessibility label: the four
          controls are unambiguous as glyphs, and spelling them out would crowd
          the scramble they sit under. IconPill is the app-wide shape, so this
          row and any future one agree without either knowing about the other. */}
      {(onRefresh || onGoBack || onEdit || onCopy || onOpenImage) && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
          {onGoBack && (
            <IconPill
              name="skipBack"
              accessibilityLabel="Previous scramble"
              onPress={onGoBack}
              disabled={!canGoBack}
            />
          )}
          {onRefresh && (
            <IconPill name="refresh" accessibilityLabel="New scramble" onPress={onRefresh} disabled={loading} />
          )}
          {onEdit && (
            <IconPill
              name="pencil"
              accessibilityLabel="Enter a custom scramble"
              onPress={onEdit}
              disabled={loading}
            />
          )}
          {onCopy && (
            <IconPill
              name="copy"
              accessibilityLabel="Copy scramble"
              onPress={onCopy}
              disabled={loading || !scramble}
            />
          )}
          {onOpenImage && (
            <IconPill
              name="cube"
              accessibilityLabel="View the scrambled cube full size"
              onPress={onOpenImage}
              disabled={!scramble || !hasScrambleNet(eventId)}
            />
          )}
        </View>
      )}

      {/* The image last, so it sits closest to the timer.
          It is the thing you look at while checking your cube against the
          scramble, and putting it here also leaves a large passive block
          between the small action buttons and the tap-anywhere timer surface
          below, rather than putting those buttons on that boundary.

          Fixed height, derived width, centred. The height is the caller's and
          is known before the drawing resolves, so this box never changes size;
          only the drawing inside it does. */}
      {imageHeight !== undefined && hasScrambleNet(eventId) && scramble ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View the scrambled cube full size"
          onPress={onOpenImage}
          disabled={!onOpenImage}
          style={({ pressed }) => ({
            height: imageHeight,
            alignItems: 'center',
            justifyContent: 'center',
            // xs, not sm: the parent already contributes `gap: space.xs`, so
            // this lands on 8 in total, which is what the layout harness models
            // between the action row and the image.
            marginTop: space.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ScrambleNet
            eventId={eventId}
            scramble={scramble}
            // The full usable width as the width budget, so the height below is
            // always the binding constraint on a phone and the box stays put.
            size={screenWidth - space.md * 2 - space.sm * 2}
            maxHeight={imageHeight}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
