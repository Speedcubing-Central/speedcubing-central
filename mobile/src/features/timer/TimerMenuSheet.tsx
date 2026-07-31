import { Pressable, Text, View } from 'react-native';
import { usePalette } from '../../store/settings';
import { Icon, type IconName } from '../../components/Icon';
import { Muted } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { font, radius, space } from '../../theme';

// The Timer header's overflow.
//
// The header used to carry three identical grey icon buttons (chart, list,
// gear) beside the event pill and the session name. Three same-weight glyphs in
// a row read as noise rather than as three choices, and they were squeezing the
// session name badly enough that HANDOFF lists the truncation as an open issue.
// Collapsing them returns about 76pt to the name.
//
// Everything here is a destination rather than an action, which is why a list
// of labelled rows is the right shape: you are picking where to go, and the
// hint line can say what you would find there.
export interface TimerMenuItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

export function TimerMenuSheet({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: TimerMenuItem[];
  onClose: () => void;
}) {
  const p = usePalette();
  return (
    <Sheet visible={visible} onClose={onClose} title="Timer">
      <View style={{ paddingBottom: space.sm }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={item.hint}
            onPress={() => {
              // Closed first, so the sheet's exit and the screen push don't
              // animate over each other.
              onClose();
              item.onPress();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingVertical: 13,
              paddingHorizontal: space.md,
              borderRadius: radius.sm,
              backgroundColor: pressed ? p.cardHover : 'transparent',
            })}
          >
            <Icon name={item.icon} size={20} color={p.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 15, fontFamily: font.sansSemi }}>{item.label}</Text>
              <Muted style={{ fontSize: 12 }}>{item.hint}</Muted>
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
