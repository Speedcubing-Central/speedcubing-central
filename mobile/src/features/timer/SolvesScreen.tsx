import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
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
import { EmptyState, MONO, Muted, Segmented } from '../../components/ui';
import { SolveDetailSheet } from './SolveDetailSheet';
import { AverageDetailSheet } from './AverageDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { radius, space } from '../../theme';

// The session's solves, on their own screen.
//
// On desktop this list shares the right-hand column with the stats table; on a
// phone it gets the whole screen, which is what makes a long session actually
// browsable. Same sort options as web (Date / Single / Ao5 / Ao12, via
// @scc/shared's sortedSolveIndices) and the same multi-select bulk delete.
//
// FlatList rather than the web version's hand-rolled virtualization. Same
// reason, since a session can hold thousands of solves, just handled by the
// platform.
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

  // The ao5 / ao12 that ended on a given solve, shown as secondary text so the
  // list carries the same context the desktop list does.
  const avgLabel = (index: number): string => {
    const ao5 = makeAverageView(solves, index, 5);
    if (!ao5) return '';
    const v = ao5.value;
    const text = v === null ? '—' : !isFinite(v) ? 'DNF' : isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', solvePrecision);
    return `ao5 ${text}`;
  };

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1, padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>
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
              <Text style={{ color: p.accent, fontWeight: '700', fontSize: 13 }}>
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
              <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
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
              <Text style={{ color: p.red, fontWeight: '700', fontSize: 13 }}>
                Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Text>
            </Pressable>
          </View>
        )}

        {solves.length === 0 ? (
          <EmptyState title="No solves yet" body="Start the timer to record your first solve." />
        ) : (
          <FlatList
            data={order}
            keyExtractor={(index) => solves[index].id}
            refreshing={data.solvesLoading}
            onRefresh={() => data.reload()}
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
                    gap: space.md,
                    paddingVertical: 12,
                    paddingHorizontal: space.md,
                    marginBottom: 6,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: selected ? p.accent : p.border,
                    backgroundColor: pressed ? p.cardHover : p.card,
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
                  <Text style={{ color: p.textMuted, fontSize: 11, width: 34 }}>
                    {sortBy === 'date' ? solves.length - index : position + 1}.
                  </Text>
                  <Text
                    style={{
                      color: solve.penalty === 'DNF' ? p.red : p.text,
                      fontFamily: MONO,
                      fontSize: 17,
                      fontWeight: '600',
                      minWidth: 86,
                    }}
                  >
                    {fmt(index)}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: p.textMuted, fontSize: 11, fontFamily: MONO }}>{avgLabel(index)}</Text>
                    {solve.comment ? (
                      <Text numberOfLines={1} style={{ color: p.textMuted, fontSize: 10 }}>
                        {solve.comment}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
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
