import { memo, useCallback, useMemo, type ReactElement } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  bestSingleIndex,
  formatMoveCount,
  formatTime,
  makeAverageView,
  TIMER_ONLY_EVENT_IDS,
  type SolveAverage,
  type SolveDTO,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { ColumnLabel, Divider, EMPTY, MONO, MONO_BOLD } from '../../components/ui';
import { radius, space } from '../../theme';

// ── The session's solves, as a table ──────────────────────────────────────
//
// Rendered both on the pushed Solves screen and inside the Timer's stats panel,
// so a solve looks the same wherever you meet it.
//
// It stays a real table with named columns rather than rows that each label
// their own values: repeating "ao5" on every row spends horizontal space on the
// same word over and over, and it reads as a property of that one row instead
// of a column you can compare down.
//
// FlatList rather than the web version's hand-rolled virtualization. Same
// reason (a session can hold thousands of solves), just handled by the platform.

// Column geometry, declared once and used by both the header and every row so
// they cannot drift apart.
const COL = {
  // Fits a five-digit solve number. At 30 a four-digit one wrapped its last
  // digit onto a second line, which also jogged the row height.
  index: { width: 46 },
  time: { flex: 1.25 },
  ao5: { flex: 1 },
  ao12: { flex: 1 },
} as const;

/**
 * The column heads. Lowercase, matching the web solves list (`#`, `single`,
 * `ao5`, `ao12`); the previous uppercase version made the mobile table shout
 * where the web one murmurs.
 *
 * Exported so a caller that scrolls the header away (the stats panel, whose
 * whole body is one list) can place it itself instead of having it pinned.
 */
export function SolvesColumnHeader({ selectMode }: { selectMode?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingBottom: space.xs,
        paddingTop: space.sm,
        backgroundColor: p.card,
      }}
    >
      {selectMode && <View style={{ width: 20 }} />}
      <ColumnLabel style={COL.index} align="left">
        #
      </ColumnLabel>
      <ColumnLabel style={COL.time} align="left">
        single
      </ColumnLabel>
      <ColumnLabel style={COL.ao5} align="right">
        ao5
      </ColumnLabel>
      <ColumnLabel style={COL.ao12} align="right">
        ao12
      </ColumnLabel>
    </View>
  );
}

export function SolvesList({
  solves,
  event,
  order,
  selectMode,
  selectedIds,
  onToggleSelect,
  onEnterSelectMode,
  onOpenSolve,
  onOpenAverage,
  onRefresh,
  refreshing,
  scrollEnabled = true,
  pinnedHeader = true,
  ListHeaderComponent,
}: {
  solves: SolveDTO[];
  event: string;
  /** Indices into `solves`, in display order. See the note in SolvesScreen. */
  order: number[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEnterSelectMode: () => void;
  onOpenSolve: (index: number) => void;
  onOpenAverage: (view: SolveAverage) => void;
  /** Omitted inside the stats panel, where pull-to-refresh fights the drag. */
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollEnabled?: boolean;
  /** False when the caller places SolvesColumnHeader inside its own header. */
  pinnedHeader?: boolean;
  ListHeaderComponent?: ReactElement | null;
}) {
  const p = usePalette();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  // Lazy, version-keyed memo for the two averages each row displays.
  //
  // Every visible row used to call makeAverageView twice per render, and a
  // third time on tap. Precomputing the whole session instead would be worse:
  // that is O(n) up front for a list that only ever shows a screenful, which on
  // a session of a few thousand solves is work nobody asked for. So it is
  // filled on demand and thrown away wholesale whenever anything it derives
  // from changes, which is what the useMemo identity does.
  const cache = useMemo(
    () => new Map<string, string>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solves, solvePrecision, isFmc],
  );

  const avgText = useCallback(
    (index: number, size: 5 | 12): string => {
      const key = `${size}:${index}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const view = makeAverageView(solves, index, size);
      const v = view?.value ?? null;
      const text =
        view === null || v === null
          ? EMPTY
          : !isFinite(v)
            ? 'DNF'
            : isFmc
              ? formatMoveCount(v, 'NONE', 2)
              : formatTime(Math.round(v), 'NONE', solvePrecision);
      cache.set(key, text);
      return text;
    },
    [cache, solves, solvePrecision, isFmc],
  );

  const timeText = useCallback(
    (index: number): string => {
      const s = solves[index];
      return isFmc
        ? formatMoveCount(s.time, s.penalty, 0, s.plusTwoCount)
        : formatTime(s.time, s.penalty, solvePrecision, s.plusTwoCount);
    },
    [solves, isFmc, solvePrecision],
  );

  // Opens the rolling average that ended on this solve, the same view the stats
  // rows open for their current and best figures.
  const openAverage = useCallback(
    (index: number, size: 5 | 12) => {
      const v = makeAverageView(solves, index, size);
      if (v) onOpenAverage(v);
    },
    [solves, onOpenAverage],
  );

  const handlePress = useCallback(
    (index: number) => {
      if (selectMode) onToggleSelect(solves[index].id);
      else onOpenSolve(index);
    },
    [selectMode, onToggleSelect, onOpenSolve, solves],
  );

  // Long-press is the gesture people already expect for "start selecting" in a
  // list. The header's Select button stays as the discoverable path, since a
  // gesture nobody is told about is not an affordance.
  const handleLongPress = useCallback(
    (index: number) => {
      if (selectMode) return;
      Haptics.selectionAsync();
      onEnterSelectMode();
      onToggleSelect(solves[index].id);
    },
    [selectMode, onEnterSelectMode, onToggleSelect, solves],
  );

  // Marked in the list because scrolling a session hunting for your best time
  // is a thing people do, and the sort control only helps if you are willing to
  // lose your place to use it.
  const bestIdx = useMemo(() => bestSingleIndex(solves), [solves]);

  const renderItem = useCallback(
    ({ item: index }: { item: number }) => {
      const solve = solves[index];
      return (
        <SolveRow
          index={index}
          isBest={index === bestIdx}
          // Newest-first, so the solve's own number in the session counts back
          // from the total. Deliberately not its rank in the current sort:
          // sorting by single used to renumber everything 1..n, so the fastest
          // solve became "1" and the number stopped identifying the solve.
          ordinal={solves.length - index}
          time={timeText(index)}
          isDnf={solve.penalty === 'DNF'}
          comment={solve.comment}
          ao5={avgText(index, 5)}
          ao12={avgText(index, 12)}
          selected={selectedIds.has(solve.id)}
          selectMode={selectMode}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onOpenAverage={openAverage}
        />
      );
    },
    [solves, timeText, avgText, selectedIds, selectMode, handlePress, handleLongPress, openAverage, bestIdx],
  );

  // Deliberately not wrapped in a Surface here. On the Solves screen the list
  // is a card on the page background; inside the stats panel it is already
  // inside one, and a card in a card is two borders a few points apart. The
  // caller owns the container, this owns the rows.
  return (
    <View style={{ flex: 1 }}>
      {pinnedHeader && (
        <>
          <SolvesColumnHeader selectMode={selectMode} />
          <Divider />
        </>
      )}
      <FlatList
        data={order}
        keyExtractor={(index) => solves[index].id}
        scrollEnabled={scrollEnabled}
        refreshing={onRefresh ? !!refreshing : undefined}
        onRefresh={onRefresh}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderItem}
        // The rows are a uniform single line, so telling FlatList not to clip
        // subviews keeps the pressed highlight from being cut at a cell edge.
        removeClippedSubviews={false}
      />
    </View>
  );
}

// memo'd, and every prop is a primitive or a stable callback, so toggling one
// checkbox re-renders one row rather than every row on screen. The handlers
// take the index rather than closing over it for exactly that reason.
const SolveRow = memo(function SolveRow({
  index,
  ordinal,
  time,
  isDnf,
  isBest,
  comment,
  ao5,
  ao12,
  selected,
  selectMode,
  onPress,
  onLongPress,
  onOpenAverage,
}: {
  index: number;
  ordinal: number;
  time: string;
  isDnf: boolean;
  isBest: boolean;
  comment?: string;
  ao5: string;
  ao12: string;
  selected: boolean;
  selectMode: boolean;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  onOpenAverage: (index: number, size: 5 | 12) => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selectMode ? selected : undefined }}
      onPress={() => onPress(index)}
      onLongPress={() => onLongPress(index)}
      delayLongPress={350}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: 11,
        paddingHorizontal: space.md,
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
      <Text
        numberOfLines={1}
        style={[COL.index, { color: p.textMuted, fontFamily: MONO, fontSize: 11 }]}
      >
        {ordinal}
      </Text>
      <View style={COL.time}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text
            style={{
              // Red for a DNF, green for the session best. Same semantics the
              // penalty buttons use, so the colours mean one thing each.
              color: isDnf ? p.red : isBest ? p.green : p.text,
              fontFamily: MONO_BOLD,
              fontSize: 16,
              fontVariant: ['tabular-nums'],
            }}
          >
            {time}
          </Text>
          {isBest && !isDnf ? <ColumnLabel style={{ color: p.green }}>best</ColumnLabel> : null}
        </View>
        {comment ? (
          <Text numberOfLines={1} style={{ color: p.textMuted, fontSize: 10 }}>
            {comment}
          </Text>
        ) : null}
      </View>
      {/* Tappable like the single beside them: these name a real average, and
          the sheet showing what it was made of is the obvious thing to want. */}
      <AvgCell
        style={COL.ao5}
        value={ao5}
        onPress={selectMode ? undefined : () => onOpenAverage(index, 5)}
      />
      <AvgCell
        style={COL.ao12}
        value={ao12}
        onPress={selectMode ? undefined : () => onOpenAverage(index, 12)}
      />
    </Pressable>
  );
});

function AvgCell({
  value,
  style,
  onPress,
}: {
  value: string;
  style: { flex: number };
  onPress?: () => void;
}) {
  // EMPTY means the average doesn't exist yet, so there is nothing to open.
  const tappable = !!onPress && value !== EMPTY;
  if (!tappable) return <Cell style={style}>{value}</Cell>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={value} style={style} hitSlop={4}>
      <Cell style={{ flex: 1 }}>{value}</Cell>
    </Pressable>
  );
}

function Cell({ children, style }: { children: string; style: { flex: number } }) {
  const p = usePalette();
  return (
    <Text
      style={[
        style,
        { color: p.textMuted, fontFamily: MONO, fontSize: 13, fontVariant: ['tabular-nums'], textAlign: 'right' },
      ]}
    >
      {children}
    </Text>
  );
}
