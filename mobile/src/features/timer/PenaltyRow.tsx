import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_PLUS_TWO_COUNT, type Penalty } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { font, radius, space } from '../../theme';

// OK / +2 / DNF selector. Same semantics as the web PenaltyButtons: OK clears
// any penalty, +2 stacks another +2 per tap up to MAX_PLUS_TWO_COUNT, and a "−"
// appears next to it once at least one is stacked so you can remove one without
// going back through OK. Sized for thumbs rather than a mouse.
export function PenaltyRow({
  penalty,
  plusTwoCount,
  onChange,
  hidePlusTwo,
}: {
  penalty: Penalty;
  plusTwoCount: number;
  onChange: (p: Penalty, plusTwoCount: number) => void;
  // FMC has no time-based penalty concept. A result is either a move count or
  // a DNF, never "+2 moves".
  hidePlusTwo?: boolean;
}) {
  const p = usePalette();

  const isOk = penalty === 'NONE' && plusTwoCount === 0;
  const isPlusTwo = penalty === 'NONE' && plusTwoCount > 0;
  const isDnf = penalty === 'DNF';

  // `pressed` is part of this, not decoration. These buttons live inside the
  // stats panel's drag surface, so a press can still be taken from them by a
  // gesture that turns out to be a drag, and a control that answers a touch
  // only once the state behind it has changed reads as slow even when it is
  // not. Dimming on contact is immediate and owes nothing to the round trip.
  const optionStyle = (active: boolean, activeColor: string, pressed: boolean) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: active ? activeColor : p.border,
    backgroundColor: active ? `${activeColor}26` : pressed ? p.cardHover : 'transparent',
    opacity: pressed ? 0.75 : 1,
  });

  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isOk }}
        onPress={() => onChange('NONE', 0)}
        style={({ pressed }) => optionStyle(isOk, p.green, pressed)}
      >
        <Text style={{ color: isOk ? p.green : p.textMuted, fontFamily: font.sansBold, fontSize: 13 }}>OK</Text>
      </Pressable>

      {!hidePlusTwo && (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: isPlusTwo ? p.yellow : p.border,
            backgroundColor: isPlusTwo ? `${p.yellow}26` : 'transparent',
            overflow: 'hidden',
          }}
        >
          {isPlusTwo && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove one +2"
              onPress={() => onChange('NONE', plusTwoCount - 1)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: p.yellow,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: p.yellow, fontFamily: font.sansBold, fontSize: 15 }}>−</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isPlusTwo, disabled: plusTwoCount >= MAX_PLUS_TWO_COUNT }}
            accessibilityLabel={isPlusTwo ? `Add another +2, currently plus ${plusTwoCount * 2}` : 'Add +2'}
            onPress={() => onChange('NONE', Math.min(MAX_PLUS_TWO_COUNT, plusTwoCount + 1))}
            disabled={plusTwoCount >= MAX_PLUS_TWO_COUNT}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 11,
              backgroundColor: !isPlusTwo && pressed ? p.cardHover : 'transparent',
              opacity: plusTwoCount >= MAX_PLUS_TWO_COUNT ? 0.5 : pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ color: isPlusTwo ? p.yellow : p.textMuted, fontFamily: font.sansBold, fontSize: 13 }}>
              {isPlusTwo ? (plusTwoCount === 1 ? '+2' : `+${plusTwoCount * 2}`) : '+2'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isDnf }}
        onPress={() => onChange('DNF', 0)}
        style={({ pressed }) => optionStyle(isDnf, p.red, pressed)}
      >
        <Text style={{ color: isDnf ? p.red : p.textMuted, fontFamily: font.sansBold, fontSize: 13 }}>DNF</Text>
      </Pressable>
    </View>
  );
}
