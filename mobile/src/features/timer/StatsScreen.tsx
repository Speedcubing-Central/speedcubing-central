import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  bestSingleIndex,
  buildStatsTable,
  effectiveTime,
  FMC_MIN_MOVES,
  formatMoveCount,
  formatTime,
  makeAverageView,
  singleStats,
  TIMER_ONLY_EVENT_IDS,
  type AvgSize,
  type SolveAverage,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { Muted, Screen } from '../../components/ui';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { font, radius, space } from '../../theme';

// The Timer's detailed statistics, on their own screen.
//
// On desktop this is a 7-row x 6-column table sitting permanently beside the
// timer. It can't stay beside the timer on a phone, so it moved here, one tap
// away, but it keeps the table *shape*: the same rows, the same columns, in the
// same order, because that grid is how the numbers are meant to be read. You
// compare down a column (is my current ao12 near my best ao12?) and across a row
// (how far is this average's BPA from its WPA?), and stacked per-stat cards, the
// previous design here, support neither of those readings.
//
// Fitting six columns on a phone is the one real obstacle, handled by pinning
// the stat-name column and letting the value columns scroll horizontally under
// it. The name stays on screen, so a row is always identifiable no matter how
// far across you are, and nothing is ever truncated or hidden behind a toggle.
// With the default column set the table fits outright and never scrolls; the
// scroll only engages when BPA/WPA/Target are all enabled on a narrow screen.
//
// The numbers themselves are unchanged: buildStatsTable / singleStats come
// straight from @scc/shared, the same module the web StatsTable imports, so
// there is no second implementation that could disagree.

// Row geometry is fixed rather than content-driven because the pinned name
// column and the scrolling value columns are two separate view trees: they only
// stay in register if both agree on an exact row height up front.
const HEADER_H = 30;
const ROW_H = 42;
// Wide enough for the longest label, 'ao1000', which wrapped to a second line
// at 58. The labels are also pinned to one line below, so a future longer one
// truncates visibly rather than silently reflowing the row.
const NAME_W = 68;
const VALUE_W = 74;

// Matches WCA's FMC convention, same as the web table: a single is a whole move
// count, but a mean/average is reported to 2 decimals. BPA/WPA count as
// averages here too, being averages themselves.
//
// The Math.round before formatTime is the web StatsTable's behavior, copied
// deliberately: it double-rounds a fractional-millisecond average (a raw
// 9374.5ms WPA renders 9.38, not 9.37), and matching arithmetic displayed two
// different ways would still be two different stats to the user.
function fmt(v: number | null, timeDecimals: number, isFmc: boolean, fmcDecimals: number): string {
  if (v === null) return '—';
  if (!isFinite(v)) return 'DNF';
  return isFmc ? formatMoveCount(v, 'NONE', fmcDecimals) : formatTime(Math.round(v), 'NONE', timeDecimals);
}

/** One value column of the table. `onPress` is set only where a detail view exists. */
interface Col {
  key: string;
  header: string;
  /** Muted, like web's projection columns, versus the accent/primary result columns. */
  muted?: boolean;
  accent?: boolean;
}

export default function StatsScreen() {
  const p = usePalette();
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);
  const { showBPA, showWPA, showTarget, solvePrecision } = useSettings();
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  const solves = data.solves;

  // O(n·size) per average size, memoized so opening a sheet doesn't recompute a
  // large session's ao1000 from scratch.
  const rows = useMemo(() => buildStatsTable(solves, isFmc ? FMC_MIN_MOVES : 0), [solves, isFmc]);
  const single = useMemo(() => singleStats(solves), [solves]);
  const bestSingleIdx = useMemo(() => bestSingleIndex(solves), [solves]);

  const currentSingle = solves.length
    ? effectiveTime(solves[0].time, solves[0].penalty, solves[0].plusTwoCount)
    : null;

  const openAverage = (size: AvgSize, startIndex: number) => {
    const v = makeAverageView(solves, startIndex, size);
    if (v) setAvgView(v);
  };

  // Same columns as the web table, in the same order, honouring the same
  // showBPA/showWPA/showTarget settings.
  const cols: Col[] = [
    { key: 'current', header: 'Current', accent: true },
    { key: 'best', header: 'Best' },
    ...(showBPA ? [{ key: 'bpa', header: 'BPA', muted: true }] : []),
    ...(showWPA ? [{ key: 'wpa', header: 'WPA', muted: true }] : []),
    ...(showTarget ? [{ key: 'target', header: 'Target', muted: true }] : []),
  ];
  const anyProjections = showBPA || showWPA || showTarget;

  // Cell contents per row, keyed to match `cols`.
  const singleCells: Record<string, { value: string; onPress?: () => void }> = {
    current: {
      value: fmt(currentSingle, solvePrecision, isFmc, 0),
      onPress: solves.length ? () => setDetailIndex(0) : undefined,
    },
    best: {
      value: fmt(single.best, solvePrecision, isFmc, 0),
      onPress: bestSingleIdx !== null ? () => setDetailIndex(bestSingleIdx) : undefined,
    },
    // A projection only means something for an in-progress average, so the
    // single row leaves those cells empty, as on web.
    bpa: { value: '' },
    wpa: { value: '' },
    target: { value: '' },
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>Statistics</Text>
        <Muted>
          {single.count} solve{single.count === 1 ? '' : 's'}
        </Muted>
      </View>

      <View
        style={{
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Pinned stat-name column. Sits outside the ScrollView so a row stays
              identifiable however far across the value columns you scroll. */}
          <View style={{ width: NAME_W }}>
            <View style={{ height: HEADER_H, justifyContent: 'flex-end', paddingLeft: space.md, paddingBottom: 4 }}>
              <Text style={headerTextStyle(p.textMuted)}>Stat</Text>
            </View>
            <RowLabel label="single" first />
            {rows.map((r) => (
              <RowLabel key={r.size} label={r.size === 3 ? 'mo3' : `ao${r.size}`} />
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // No bounce: with the common column set there is nothing to scroll,
            // and a table that rubber-bands against a pinned column reads as
            // broken rather than springy.
            bounces={false}
            contentContainerStyle={{ paddingRight: space.md }}
          >
            <View>
              <View style={{ flexDirection: 'row', height: HEADER_H, alignItems: 'flex-end', paddingBottom: 4 }}>
                {cols.map((c) => (
                  <Text key={c.key} style={[headerTextStyle(p.textMuted), { width: VALUE_W, textAlign: 'right' }]}>
                    {c.header}
                  </Text>
                ))}
              </View>

              <ValueRow cols={cols} cells={singleCells} first />

              {rows.map((r) => {
                const isMo3 = r.size === 3;
                const cells: Record<string, { value: string; onPress?: () => void }> = {
                  current: {
                    value: fmt(r.current, solvePrecision, isFmc, 2),
                    onPress: solves.length >= r.size ? () => openAverage(r.size, 0) : undefined,
                  },
                  best: {
                    value: fmt(r.best, solvePrecision, isFmc, 2),
                    onPress: r.bestIndex !== null ? () => openAverage(r.size, r.bestIndex!) : undefined,
                  },
                  bpa: { value: fmt(r.bpa, solvePrecision, isFmc, 2) },
                  // Mo3's WPA is always DNF (any DNF makes a mean DNF), so it's
                  // left blank rather than shown, matching the web table.
                  wpa: { value: isMo3 ? '' : fmt(r.wpa, solvePrecision, isFmc, 2) },
                  // fmcDecimals 0 here, not 2: a Target is a single next
                  // result, not an average, so for FMC it's a whole move count.
                  // Same argument the web table passes.
                  target: { value: fmt(r.target, solvePrecision, isFmc, 0) },
                };
                return <ValueRow key={r.size} cols={cols} cells={cells} />;
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <Muted>
        Tap a current or best average to see the solves it was made of.
        {anyProjections
          ? ' BPA and WPA are the best and worst possible averages given the solves so far; Target is the slowest next solve that would still set a new best.'
          : ''}
      </Muted>

      {avgView && <AverageDetailSheet view={avgView} event={event} onClose={() => setAvgView(null)} />}
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
    </Screen>
  );
}

function headerTextStyle(color: string) {
  return {
    color,
    fontFamily: font.sansSemi,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  };
}

// A stat name in the pinned column. `first` omits the top hairline so the rule
// under the header isn't drawn twice.
function RowLabel({ label, first }: { label: string; first?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={{
        height: ROW_H,
        justifyContent: 'center',
        paddingLeft: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: p.border,
      }}
    >
      <Text numberOfLines={1} style={{ color: p.text, fontFamily: font.sansBold, fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

function ValueRow({
  cols,
  cells,
  first,
}: {
  cols: Col[];
  cells: Record<string, { value: string; onPress?: () => void }>;
  first?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        height: ROW_H,
        alignItems: 'center',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: p.border,
      }}
    >
      {cols.map((c) => {
        const cell = cells[c.key] ?? { value: '' };
        return (
          <ValueCell
            key={c.key}
            value={cell.value}
            onPress={cell.onPress}
            accent={c.accent}
            muted={c.muted}
          />
        );
      })}
    </View>
  );
}

function ValueCell({
  value,
  onPress,
  accent,
  muted,
}: {
  value: string;
  onPress?: () => void;
  accent?: boolean;
  muted?: boolean;
}) {
  const p = usePalette();
  // An em dash is the placeholder for "no value yet" and an empty string means
  // the cell doesn't apply to this row; neither is worth a tap target.
  const tappable = !!onPress && value !== '—' && value !== '';
  const color = accent ? p.accent : muted ? p.textMuted : p.text;

  const text = (
    <Text
      style={{
        color,
        fontFamily: muted ? font.mono : font.monoBold,
        fontSize: muted ? 12 : 14,
        fontVariant: ['tabular-nums'],
        textAlign: 'right',
      }}
      numberOfLines={1}
    >
      {value}
    </Text>
  );

  if (!tappable) return <View style={{ width: VALUE_W }}>{text}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ width: VALUE_W, height: ROW_H, justifyContent: 'center', opacity: pressed ? 0.55 : 1 })}
    >
      {text}
    </Pressable>
  );
}
