import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { UNOFFICIAL_EVENTS, WCA_EVENTS, type WcaEvent } from '@scc/shared';
import { usePalette } from '../store/settings';
import { radius, space } from '../theme';

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
      <Text
        style={{
          color: p.textMuted,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginTop: space.sm,
        }}
      >
        {label}
      </Text>
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
            <Text style={{ color: selected ? '#fff' : p.text, fontSize: 15, fontWeight: selected ? '700' : '500' }}>
              {e.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View
        style={{
          maxHeight: '78%',
          backgroundColor: p.card,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTopWidth: 1,
          borderColor: p.border,
          paddingHorizontal: space.md,
          paddingBottom: space.xl,
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: space.md }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
        </View>
        <Text style={{ color: p.text, fontSize: 18, fontWeight: '800', marginBottom: space.sm }}>Event</Text>
        <ScrollView>
          {renderGroup('WCA Events', wcaEvents)}
          {renderGroup('Unofficial Events', UNOFFICIAL_EVENTS)}
        </ScrollView>
      </View>
    </Modal>
  );
}
