import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatMoveCount,
  formatTime,
  makeAverageView,
  sortedSolveIndices,
  TIMER_ONLY_EVENT_IDS,
  type SolveAverage,
  type SolveSortBy,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { EmptyState, Muted, Segmented } from '../../components/ui';
import { SolveDetailSheet } from './SolveDetailSheet';
import { AverageDetailSheet } from './AverageDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { font, radius, space } from '../../theme';

// The session's solves, on their own screen.
//
// On desktop this list shares the right-hand column with the stats table; on a
// phone it gets the whole screen, which is what makes a long session actually
// browsable. Same sort options as web (Date / Single / Ao5 / Ao12, via
// @scc/shared's sortedSolveIndices) and the same multi-select bulk delete.
//
// The list is a real table with a pinned header rather than rows that each label
// their own values. Repeating "ao5" on every row spends horizontal space on the
// same word over and over, and it reads as a property of that one row instead of
// a column you can compare down. The header sits outside the FlatList so it stays
// put while the rows scroll under it, which is the whole point of naming the
// columns once.
//
// FlatList rather than the web version's hand-rolled virtualization. Same
// reason, since a session can hold thousands of solves, just handled by the
// platform.

// Column geometry, declared once and used by both the header and every row so
// they cannot drift apart.
const COL = {
  index: { width: 30 },
  time: { flex: 1.25 },
  ao5: { flex: 1 },
  ao12: { flex: 1 },
} as const;

export default function SolvesScreen() {
  const p = usePalette();
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  const [sortBy, setSortBy] = useState<SolveSortBy>('date');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);

  const solves = data.solves;
  // Indices into `solves` in display order. `solves` itself is never reordered,
  // ao5/ao12 windows depend on its chronological adjacency, so the array order
  // is load-bearing, not a display choice.
  const order = useMemo(() => sortedSolveIndices(solves, sortBy), [solves, sortBy]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function confirmBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(`Delete ${count} solve${count === 1 ? '' : 's'}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await data.deleteSolves(Array.from(selectedIds));
          setSelectedIds(new Set());
          setSelectMode(false);
        },
      },
    ]);
  }

  const fmt = (index: number): string => {
    const s = solves[index];
    return isFmc
      ? formatMoveCount(s.time, s.penalty, 0, s.plusTwoCount)
      : formatTime(s.time, s.penalty, solvePrecision, s.plusTwoCount);
  };

  // The rolling average of `size` that ended on this solve. Same
  // makeAverageView the stats screen and the web list use, and the same
  // round-then-format so a value shown in two places matches.
  const avgText = (index: number, size: 5 | 12): string => {
    const view = makeAverageView(solves, index, size);
    if (!view) return '·';
    const v = view.value;
    if (v === null) return '·';
    if (!isFinite(v)) return 'DNF';
    return isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', solvePrecision);
  };

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1, paddingHorizontal: space.md, paddingTop: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>
            Solves ({solves.length})
          </Text>
          {solves.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelectMode((m) => !m);
                setSelectedIds(new Set());
              }}
              hitSlop={8}
            >
              <Text style={{ color: p.accent, fontFamily: font.sansBold, fontSize: 13 }}>
                {selectMode ? 'Cancel' : 'Select'}
              </Text>
            </Pressable>
          )}
        </View>

        {!selectMode && solves.length > 0 && (
          <Segmented
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'date', label: 'Date' },
              { value: 'single', label: 'Single' },
              { value: 'ao5', label: 'Ao5' },
              { value: 'ao12', label: 'Ao12' },
            ]}
          />
        )}

        {selectMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Muted>{selectedIds.size} selected</Muted>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setSelectedIds((prev) =>
                  prev.size === solves.length ? new Set() : new Set(solves.map((s) => s.id)),
                )
              }
            >
              <Text style={{ color: p.text, fontSize: 13, fontFamily: font.sansSemi }}>
                {selectedIds.size === solves.length ? 'Deselect all' : 'Select all'}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              onPress={confirmBulkDelete}
              disabled={selectedIds.size === 0}
              style={{ opacity: selectedIds.size === 0 ? 0.4 : 1 }}
            >
              <Text style={{ color: p.red, fontFamily: font.sansBold, fontSize: 13 }}>
                Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Text>
            </Pressable>
          </View>
        )}

        {solves.length === 0 ? (
          <EmptyState title="No solves yet" body="Start the timer to record your first solve." />
        ) : (
          <>
            {/* Pinned column headers. Outside the FlatList, so they stay visible
                for the whole scroll instead of only at the top. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingHorizontal: space.sm,
                paddingBottom: space.xs,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: p.border,
              }}
            >
              {selectMode && <View style={{ width: 20 }} />}
              <HeaderLabel style={COL.index} align="left">
                #
              </HeaderLabel>
              <HeaderLabel style={COL.time} align="left">
                Time
              </HeaderLabel>
              <HeaderLabel style={COL.ao5}>Ao5</HeaderLabel>
              <HeaderLabel style={COL.ao12}>Ao12</HeaderLabel>
            </View>

            <FlatList
              data={order}
              keyExtractor={(index) => solves[index].id}
              refreshing={data.solvesLoading}
              onRefresh={() => data.reload()}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />
              )}
              renderItem={({ item: index, index: position }) => {
                const solve = solves[index];
                const selected = selectedIds.has(solve.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => (selectMode ? toggleOne(solve.id) : setDetailIndex(index))}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingVertical: 11,
                      paddingHorizontal: space.sm,
                      borderRadius: radius.sm,
                      backgroundColor: selected ? `${p.accent}22` : pressed ? p.cardHover : 'transparent',
                    })}
                  >
                    {selectMode && (
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: selected ? p.accent : p.border,
                          backgroundColor: selected ? p.accent : 'transparent',
                        }}
                      />
                    )}
                    <Text style={[COL.index, { color: p.textMuted, fontFamily: font.mono, fontSize: 11 }]}>
                      {sortBy === 'date' ? solves.length - index : position + 1}
                    </Text>
                    <View style={COL.time}>
                      <Text
                        style={{
                          color: solve.penalty === 'DNF' ? p.red : p.text,
                          fontFamily: font.monoBold,
                          fontSize: 16,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {fmt(index)}
                      </Text>
                      {solve.comment ? (
                        <Text numberOfLines={1} style={{ color: p.textMuted, fontFamily: font.sans, fontSize: 10 }}>
                          {solve.comment}
                        </Text>
                      ) : null}
                    </View>
                    <Cell style={COL.ao5}>{avgText(index, 5)}</Cell>
                    <Cell style={COL.ao12}>{avgText(index, 12)}</Cell>
                  </Pressable>
                );
              }}
            />
          </>
        )}
      </View>

      {detailIndex !== null && (
        <SolveDetailSheet
          solves={solves}
          index={detailIndex}
          event={event}
          onClose={() => setDetailIndex(null)}
          onUpdatePenalty={data.updatePenalty}
          onUpdateTime={data.updateTime}
          onUpdateComment={data.updateComment}
          onDelete={data.deleteSolve}
          onOpenAverage={(v) => {
            setDetailIndex(null);
            setAvgView(v);
          }}
        />
      )}
      {avgView && <AverageDetailSheet view={avgView} event={event} onClose={() => setAvgView(null)} />}
    </SafeAreaView>
  );
}

function HeaderLabel({
  children,
  style,
  align = 'right',
}: {
  children: string;
  style: { width: number } | { flex: number };
  align?: 'left' | 'right';
}) {
  const p = usePalette();
  return (
    <Text
      style={[
        style,
        {
          color: p.textMuted,
          fontFamily: font.sansBold,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          textAlign: align,
        },
      ]}
    >
      {children}
    </Text>
  );
}

function Cell({ children, style }: { children: string; style: { flex: number } }) {
  const p = usePalette();
  return (
    <Text
      style={[
        style,
        {
          color: p.textMuted,
          fontFamily: font.mono,
          fontSize: 13,
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
        },
      ]}
    >
      {children}
    </Text>
  );
}
