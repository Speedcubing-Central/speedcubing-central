import { Text, useWindowDimensions, View } from 'react-native';
import { getEvent, normalizeScramble } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { CopyButton, MONO, Muted } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { space } from '../../theme';

// The scrambled cube, as big as the screen will allow.
//
// The inline image on the Timer is sized to leave the timer its height, which
// is the right default but still a compromise on a 7x7: 21 sticker rows in
// ~168pt is about 8pt each, fine for a glance and tight if you are actually
// checking a face. This is the escape hatch, and it costs the Timer layout
// nothing because it only exists while it is open.
//
// Cheap to open: lib/cubingSvg caches each puzzle by promise, so the drawing
// here reuses the load the inline image already paid for.
export function ScrambleImageSheet({
  visible,
  eventId,
  scramble,
  onClose,
}: {
  visible: boolean;
  eventId: string;
  scramble: string;
  onClose: () => void;
}) {
  const p = usePalette();
  const { width, height } = useWindowDimensions();

  // The sheet's own horizontal padding is space.lg each side.
  const available = width - space.lg * 2;
  // Leaves room for the sheet header, the scramble text under the image and the
  // bottom inset, so a tall drawing (square-1 is taller than it is wide) cannot
  // push the text off the panel.
  const maxImageH = height * 0.52;

  return (
    <Sheet visible={visible} onClose={onClose} title={getEvent(eventId)?.name ?? eventId}>
      <View style={{ gap: space.md, paddingBottom: space.md }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          {hasScrambleNet(eventId) && scramble ? (
            <ScrambleNet eventId={eventId} scramble={scramble} size={available} maxHeight={maxImageH} />
          ) : (
            <Muted>No image for this event.</Muted>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Muted>Scramble</Muted>
          <CopyButton
            getText={() => normalizeScramble(scramble)}
            label="Copy scramble"
            accessibilityLabel="Copy this scramble"
          />
        </View>
        <Text selectable style={{ color: p.text, fontFamily: MONO, fontSize: 13, lineHeight: 20 }}>
          {normalizeScramble(scramble)}
        </Text>
      </View>
    </Sheet>
  );
}
