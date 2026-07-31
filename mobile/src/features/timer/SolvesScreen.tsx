import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { sortedSolveIndices, type SolveAverage, type SolveSortBy } from '@scc/shared';
import { useSettings } from '../../store/settings';
import {
  EmptyState,
  Muted,
  Screen,
  ScreenTitle,
  Segmented,
  Surface,
  TextButton,
} from '../../components/ui';
import { SolveDetailSheet } from './SolveDetailSheet';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolvesList } from './SolvesList';
import { SolvesTrend } from './SolvesTrend';
import { useTimerDataContext } from './TimerDataContext';
import { space } from '../../theme';

// The session's solves, on their own screen.
//
// This is the *browse* surface: the whole screen, pull-to-refresh, and bulk
// select. The Timer's stats panel renders the same SolvesList as a *glance*
// surface, with a constrained height and no pull-to-refresh (which would fight
// the panel's drag). Same rows either way, so a solve never looks like two
// different things.
export default function SolvesScreen() {
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);

  const [sortBy, setSortBy] = useState<SolveSortBy>('date');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);

  const solves = data.solves;
  // Indices into `solves` in display order. `solves` itself is never reordered:
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

  const enterSelectMode = useCallback(() => setSelectMode(true), []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
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
          exitSelectMode();
        },
      },
    ]);
  }

  return (
    <Screen edges={[]} gap={space.sm}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle>Solves ({solves.length})</ScreenTitle>
        {solves.length > 0 && (
          <TextButton
            label={selectMode ? 'Cancel' : 'Select'}
            onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          />
        )}
      </View>

      {/* Hidden in select mode: you are doing bulk surgery on the list, not
          reading its shape, and the rows are what need the height. */}
      {!selectMode && <SolvesTrend solves={solves} event={event} />}

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
          <TextButton
            tone="default"
            label={selectedIds.size === solves.length ? 'Deselect all' : 'Select all'}
            onPress={() =>
              setSelectedIds((prev) =>
                prev.size === solves.length ? new Set() : new Set(solves.map((s) => s.id)),
              )
            }
          />
          <View style={{ flex: 1 }} />
          <TextButton
            tone="danger"
            label={`Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            onPress={confirmBulkDelete}
            disabled={selectedIds.size === 0}
          />
        </View>
      )}

      {solves.length === 0 ? (
        <EmptyState title="No solves yet" body="Start the timer to record your first solve." />
      ) : (
        <Surface padding="none" style={{ flex: 1, overflow: 'hidden' }}>
          <SolvesList
            solves={solves}
            event={event}
            order={order}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleOne}
            onEnterSelectMode={enterSelectMode}
            onOpenSolve={setDetailIndex}
            onOpenAverage={setAvgView}
            onRefresh={() => data.reload()}
            refreshing={data.solvesLoading}
          />
        </Surface>
      )}

      <SolveDetailSheet
        solves={solves}
        index={detailIndex}
        event={event}
        visible={detailIndex !== null}
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
      <AverageDetailSheet
        view={avgView}
        event={event}
        visible={avgView !== null}
        onClose={() => setAvgView(null)}
      />
    </Screen>
  );
}
