import { useMemo, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';
import {
  formatAverageCopy,
  formatMoveCount,
  formatTime,
  normalizeScramble,
  TIMER_ONLY_EVENT_IDS,
  type SolveAverage,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { ColumnLabel, CopyButton, Divider, EMPTY, MONO, Surface } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { font, space } from '../../theme';

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
  visible,
  onClose,
}: {
  /** Null before anything has been opened, and again while the sheet exits. */
  view: SolveAverage | null;
  event: string;
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  // The sheet now stays mounted so it can play its 200ms exit animation, which
  // means `view` goes null while it is still on screen. Rendering the last
  // non-null one keeps the content in place all the way out instead of the
  // sheet flashing empty as it slides away.
  const lastRef = useRef<SolveAverage | null>(null);
  if (view) lastRef.current = view;
  const shown = view ?? lastRef.current;

  const droppedSet = useMemo(() => new Set(shown?.droppedIndices ?? []), [shown]);

  if (!shown) return null;

  const value =
    shown.value === null
      ? EMPTY
      : !isFinite(shown.value)
        ? 'DNF'
        : isFmc
          ? formatMoveCount(shown.value, 'NONE', 2)
          : formatTime(Math.round(shown.value), 'NONE', solvePrecision);
  const label = shown.size === 3 ? 'mo3' : `ao${shown.size}`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={label}
      fillHeight
      maxHeightRatio={0.78}
      headerRight={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {/* formatAverageCopy is @scc/shared's, the same function the web
              client uses, so an average pasted from either platform is
              byte-identical: same header, same numbering, same drops. */}
          <CopyButton
            getText={() => formatAverageCopy(shown, event, solvePrecision)}
            accessibilityLabel="Copy this average"
          />
          <Text style={{ color: p.accent, fontSize: 20, fontFamily: font.monoBold }}>{value}</Text>
        </View>
      }
    >
      {/* One Surface with rules between the rows, rather than a bordered mini
          card per row. Twenty stacked boxes read as twenty things; one list of
          twenty rows reads as one average, which is what it is. */}
      <Surface padding="none" style={{ flex: 1, overflow: 'hidden' }}>
        <FlatList
          data={shown.window}
          keyExtractor={(s) => s.id}
          ItemSeparatorComponent={Divider}
          renderItem={({ item, index }) => {
            const dropped = droppedSet.has(index);
            return (
              <View
                style={{
                  flexDirection: 'row',
                  gap: space.sm,
                  alignItems: 'baseline',
                  paddingHorizontal: space.md,
                  paddingVertical: 9,
                  opacity: dropped ? 0.5 : 1,
                }}
              >
                <ColumnLabel style={{ width: 28 }}>{index + 1}.</ColumnLabel>
                <Text
                  style={{
                    color: p.text,
                    fontFamily: MONO,
                    fontSize: 14,
                    width: 78,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {dropped ? '(' : ''}
                  {isFmc
                    ? formatMoveCount(item.time, item.penalty)
                    : formatTime(item.time, item.penalty, solvePrecision, item.plusTwoCount)}
                  {dropped ? ')' : ''}
                </Text>
                <Text style={{ color: p.textMuted, fontFamily: MONO, fontSize: 10, flex: 1 }}>
                  {normalizeScramble(item.scramble) || EMPTY}
                </Text>
              </View>
            );
          }}
        />
      </Surface>

      {shown.droppedIndices.length > 0 && (
        <Text style={{ color: p.textMuted, fontFamily: font.sans, fontSize: 11, marginTop: space.sm }}>
          Dropped solves (best and worst) are dimmed and shown in parentheses.
        </Text>
      )}
    </Sheet>
  );
}
