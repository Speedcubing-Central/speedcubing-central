import { Pressable, Text, View } from 'react-native';
import { UNOFFICIAL_EVENTS, WCA_EVENTS, type WcaEvent } from '@scc/shared';
import { usePalette } from '../store/settings';
import { Label } from './ui';
import { Sheet, SheetScrollView } from './Sheet';
import { font, radius, space } from '../theme';

// Bottom-sheet event picker.
//
// Same two groups and same event lists as the web EventSelector
// (client/src/components/ui.tsx): every WCA event plus the unofficial ones, with
// the same optional exclusion hook. A native <select> dropdown of ~25 options is
// miserable on a phone, so this is a full-height sheet with tap targets instead.
export function EventPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
  excludeIds,
}: {
  visible: boolean;
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  excludeIds?: string[];
}) {
  const p = usePalette();
  const wcaEvents = excludeIds ? WCA_EVENTS.filter((e) => !excludeIds.includes(e.id)) : WCA_EVENTS;

  const renderGroup = (label: string, events: WcaEvent[]) => (
    <View style={{ gap: space.xs }}>
      <Label style={{ marginTop: space.sm }}>{label}</Label>
      {events.map((e) => {
        const selected = e.id === value;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onSelect(e.id);
              onClose();
            }}
            style={({ pressed }) => ({
              paddingVertical: 13,
              paddingHorizontal: space.md,
              borderRadius: radius.sm,
              backgroundColor: selected ? p.accent : pressed ? p.cardHover : 'transparent',
            })}
          >
            <Text
              style={{
                color: selected ? '#fff' : p.text,
                fontSize: 15,
                fontFamily: selected ? font.sansBold : font.sansMedium,
              }}
            >
              {e.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Event" fillHeight maxHeightRatio={0.78}>
      {/* Reports its scroll position to the sheet, so a drag that starts at the
          top of this list drags the sheet and every other drag scrolls. */}
      <SheetScrollView>
        {renderGroup('WCA Events', wcaEvents)}
        {renderGroup('Unofficial Events', UNOFFICIAL_EVENTS)}
      </SheetScrollView>
    </Sheet>
  );
}
