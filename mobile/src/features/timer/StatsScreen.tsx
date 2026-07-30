import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import { MONO, Muted, Screen, Segmented } from '../../components/ui';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { radius, space } from '../../theme';

// The Timer's detailed statistics, on their own screen.
//
// On desktop this is a 7-row x 6-column table sitting permanently beside the
// timer. That's the single clearest example of something that can't just be
// shrunk onto a phone: at a readable font size it's wider than the screen and it
// would leave no room for the timer itself. So it moved here, one tap from the
// Timer, and the Timer keeps only the two numbers you watch between solves.
//
// The numbers themselves are unchanged, buildStatsTable / singleStats come
// straight from @scc/shared (the same module the web StatsTable imports), so
// there is no second implementation that could disagree.
//
// The remaining width problem is solved by splitting the columns into two views
// rather than by horizontal scrolling: "Results" (Current / Best, what you
// normally want) and "Projections" (BPA / WPA / Target, the in-progress-average
// planning numbers). Both respect the same showBPA/showWPA/showTarget settings
// the web table does.
type ColumnView = 'results' | 'projections';

// Matches WCA's FMC convention, same as the web table: a single is a whole move
// count, but a mean/average is reported to 2 decimals. BPA/WPA count as
// averages here too, being averages themselves.
function fmt(v: number | null, timeDecimals: number, isFmc: boolean, fmcDecimals: number): string {
  if (v === null) return '—';
  if (!isFinite(v)) return 'DNF';
  return isFmc ? formatMoveCount(v, 'NONE', fmcDecimals) : formatTime(Math.round(v), 'NONE', timeDecimals);
}

export default function StatsScreen() {
  const p = usePalette();
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);
  const { showBPA, showWPA, showTarget, solvePrecision } = useSettings();
  const [view, setView] = useState<ColumnView>('results');
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  const solves = data.solves;

  // O(n·size) per average size, memoized so scrolling or opening a sheet
  // doesn't recompute a large session's ao1000 from scratch.
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

  const projectionCols = [
    ...(showBPA ? ['BPA'] : []),
    ...(showWPA ? ['WPA'] : []),
    ...(showTarget ? ['Target'] : []),
  ];
  const showProjections = projectionCols.length > 0;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>Statistics</Text>
        <Muted>
          {single.count} solve{single.count === 1 ? '' : 's'}
        </Muted>
      </View>

      {showProjections && (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'results', label: 'Results' },
            { value: 'projections', label: 'Projections' },
          ]}
        />
      )}

      <View
        style={{
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: space.md }}>
          <HeaderCell label="Stat" flex={1.1} align="left" />
          {view === 'results' || !showProjections ? (
            <>
              <HeaderCell label="Current" flex={1} />
              <HeaderCell label="Best" flex={1} />
            </>
          ) : (
            projectionCols.map((c) => <HeaderCell key={c} label={c} flex={1} />)
          )}
        </View>

        {/* Single */}
        <Row
          label="single"
          cells={
            view === 'results' || !showProjections
              ? [
                  {
                    value: fmt(currentSingle, solvePrecision, isFmc, 0),
                    accent: true,
                    onPress: solves.length ? () => setDetailIndex(0) : undefined,
                  },
                  {
                    value: fmt(single.best, solvePrecision, isFmc, 0),
                    onPress: bestSingleIdx !== null ? () => setDetailIndex(bestSingleIdx) : undefined,
                  },
                ]
              : // A single has no BPA/WPA/Target. Those only apply to an
                // in-progress average. The web table renders an empty spanning
                // cell here; same idea.
                projectionCols.map(() => ({ value: '' }))
          }
        />

        {rows.map((r) => {
          const isMo3 = r.size === 3;
          const label = isMo3 ? 'mo3' : `ao${r.size}`;
          const cells =
            view === 'results' || !showProjections
              ? [
                  {
                    value: fmt(r.current, solvePrecision, isFmc, 2),
                    accent: true,
                    onPress: solves.length >= r.size ? () => openAverage(r.size, 0) : undefined,
                  },
                  {
                    value: fmt(r.best, solvePrecision, isFmc, 2),
                    onPress: r.bestIndex !== null ? () => openAverage(r.size, r.bestIndex!) : undefined,
                  },
                ]
              : [
                  ...(showBPA ? [{ value: fmt(r.bpa, solvePrecision, isFmc, 2) }] : []),
                  // Mo3's WPA is always DNF (any DNF makes a mean DNF), so it's
                  // not useful to show. Matching the web table.
                  ...(showWPA ? [{ value: isMo3 ? '' : fmt(r.wpa, solvePrecision, isFmc, 2) }] : []),
                  ...(showTarget ? [{ value: fmt(r.target, solvePrecision, isFmc, 0) }] : []),
                ];
          return <Row key={r.size} label={label} cells={cells} />;
        })}
      </View>

      <Muted>
        {view === 'results' && showProjections
          ? 'Tap a current or best average to see the solves it was made of.'
          : 'BPA / WPA are the best and worst possible averages given the solves so far. Target is the slowest next solve that would still set a new best.'}
      </Muted>

      {avgView && (
        <AverageDetailSheet view={avgView} event={event} onClose={() => setAvgView(null)} />
      )}
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

function HeaderCell({
  label,
  flex,
  align = 'right',
}: {
  label: string;
  flex: number;
  align?: 'left' | 'right';
}) {
  const p = usePalette();
  return (
    <Text
      style={{
        flex,
        color: p.textMuted,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: align,
      }}
    >
      {label}
    </Text>
  );
}

function Row({
  label,
  cells,
}: {
  label: string;
  cells: { value: string; accent?: boolean; onPress?: () => void }[];
}) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: space.md,
        borderTopWidth: 1,
        borderTopColor: p.border,
      }}
    >
      <Text style={{ flex: 1.1, color: p.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
      {cells.map((c, i) => {
        const tappable = !!c.onPress && c.value !== '—' && c.value !== '';
        const content = (
          <Text
            style={{
              color: c.accent ? p.accent : p.textMuted,
              fontFamily: MONO,
              fontSize: 14,
              textAlign: 'right',
              textDecorationLine: tappable ? 'underline' : 'none',
            }}
          >
            {c.value}
          </Text>
        );
        return tappable ? (
          <Pressable key={i} accessibilityRole="button" onPress={c.onPress} style={{ flex: 1 }} hitSlop={8}>
            {content}
          </Pressable>
        ) : (
          <View key={i} style={{ flex: 1 }}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

