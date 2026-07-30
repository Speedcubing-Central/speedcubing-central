import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_PLUS_TWO_COUNT, type Penalty } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { radius, space } from '../../theme';

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

  const optionStyle = (active: boolean, activeColor: string) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: active ? activeColor : p.border,
    backgroundColor: active ? `${activeColor}26` : 'transparent',
  });

  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isOk }}
        onPress={() => onChange('NONE', 0)}
        style={optionStyle(isOk, p.green)}
      >
        <Text style={{ color: isOk ? p.green : p.textMuted, fontWeight: '700', fontSize: 13 }}>OK</Text>
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
              style={{
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: p.yellow,
              }}
            >
              <Text style={{ color: p.yellow, fontWeight: '700', fontSize: 15 }}>−</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isPlusTwo, disabled: plusTwoCount >= MAX_PLUS_TWO_COUNT }}
            accessibilityLabel={isPlusTwo ? `Add another +2, currently plus ${plusTwoCount * 2}` : 'Add +2'}
            onPress={() => onChange('NONE', Math.min(MAX_PLUS_TWO_COUNT, plusTwoCount + 1))}
            disabled={plusTwoCount >= MAX_PLUS_TWO_COUNT}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 11,
              opacity: plusTwoCount >= MAX_PLUS_TWO_COUNT ? 0.5 : 1,
            }}
          >
            <Text style={{ color: isPlusTwo ? p.yellow : p.textMuted, fontWeight: '700', fontSize: 13 }}>
              {isPlusTwo ? (plusTwoCount === 1 ? '+2' : `+${plusTwoCount * 2}`) : '+2'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isDnf }}
        onPress={() => onChange('DNF', 0)}
        style={optionStyle(isDnf, p.red)}
      >
        <Text style={{ color: isDnf ? p.red : p.textMuted, fontWeight: '700', fontSize: 13 }}>DNF</Text>
      </Pressable>
    </View>
  );
}
