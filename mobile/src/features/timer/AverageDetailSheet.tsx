import { useMemo } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import {
  formatMoveCount,
  formatTime,
  normalizeScramble,
  TIMER_ONLY_EVENT_IDS,
  type SolveAverage,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { MONO } from '../../components/ui';
import { radius, space } from '../../theme';

// One average, broken out into the solves that made it. The mobile equivalent
// of the web AverageDetail modal.
//
// Same content and same conventions: solves in chronological order (first solve
// first, which is why `view.window` is already reversed by makeAverageView), and
// the dropped best/worst dimmed and parenthesised.
//
// The web version hand-rolls a virtualized list because an ao1000 means
// rendering a thousand rows. FlatList is virtualized by default, so that comes
// for free here.
export function AverageDetailSheet({
  view,
  event,
  onClose,
}: {
  view: SolveAverage;
  event: string;
  onClose: () => void;
}) {
  const p = usePalette();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  const droppedSet = useMemo(() => new Set(view.droppedIndices), [view.droppedIndices]);

  const value =
    view.value === null
      ? '—'
      : !isFinite(view.value)
        ? 'DNF'
        : isFmc
          ? formatMoveCount(view.value, 'NONE', 2)
          : formatTime(Math.round(view.value), 'NONE', solvePrecision);
  const label = view.size === 3 ? 'mo3' : `ao${view.size}`;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View
        style={{
          height: '75%',
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: space.sm,
          }}
        >
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '800' }}>{label}</Text>
          <Text style={{ color: p.accent, fontSize: 20, fontWeight: '700', fontFamily: MONO }}>{value}</Text>
        </View>

        <FlatList
          data={view.window}
          keyExtractor={(s) => s.id}
          renderItem={({ item, index }) => {
            const dropped = droppedSet.has(index);
            return (
              <View
                style={{
                  flexDirection: 'row',
                  gap: space.sm,
                  alignItems: 'baseline',
                  borderWidth: 1,
                  borderColor: p.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  paddingVertical: 9,
                  marginBottom: 6,
                  opacity: dropped ? 0.5 : 1,
                }}
              >
                <Text style={{ color: p.textMuted, fontSize: 11, width: 28 }}>{index + 1}.</Text>
                <Text style={{ color: p.text, fontFamily: MONO, fontSize: 14, width: 78 }}>
                  {dropped ? '(' : ''}
                  {isFmc
                    ? formatMoveCount(item.time, item.penalty)
                    : formatTime(item.time, item.penalty, solvePrecision, item.plusTwoCount)}
                  {dropped ? ')' : ''}
                </Text>
                <Text style={{ color: p.textMuted, fontFamily: MONO, fontSize: 10, flex: 1 }}>
                  {normalizeScramble(item.scramble) || '—'}
                </Text>
              </View>
            );
          }}
        />

        {view.droppedIndices.length > 0 && (
          <Text style={{ color: p.textMuted, fontSize: 11, marginTop: space.sm }}>
            Dropped solves (best &amp; worst) are dimmed and shown in parentheses.
          </Text>
        )}
      </View>
    </Modal>
  );
}
