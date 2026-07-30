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
import { Muted, Screen } from '../../components/ui';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { font, radius, space } from '../../theme';

// The Timer's detailed statistics, on their own screen.
//
// On desktop this is a 7-row x 6-column table sitting permanently beside the
// timer. That's the single clearest example of something that can't just be
// shrunk onto a phone: at a readable font size it's wider than the screen and it
// would leave no room for the timer itself. So it moved here, one tap from the
// Timer, and the Timer keeps only the numbers you watch between solves.
//
// The numbers themselves are unchanged: buildStatsTable / singleStats come
// straight from @scc/shared (the same module the web StatsTable imports), so
// there is no second implementation that could disagree.
//
// Everything is on one screen. An earlier pass split the columns behind a
// Results / Projections toggle to fit the width, which meant the BPA you were
// chasing and the current average you were chasing it with could never be on
// screen together. Dropping the table shape fixes that properly: one card per
// stat, current and best as the headline pair, and the projections as a
// secondary line underneath. Same six values as web, no toggle, no sideways
// scrolling. showBPA/showWPA/showTarget still control the projection line, as on
// web, and `single` omits it entirely since a projection only means something for
// an in-progress average.

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

export default function StatsScreen() {
  const p = usePalette();
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);
  const { showBPA, showWPA, showTarget, solvePrecision } = useSettings();
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

  const anyProjections = showBPA || showWPA || showTarget;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>Statistics</Text>
        <Muted>
          {single.count} solve{single.count === 1 ? '' : 's'}
        </Muted>
      </View>

      <StatCard
        label="single"
        current={fmt(currentSingle, solvePrecision, isFmc, 0)}
        best={fmt(single.best, solvePrecision, isFmc, 0)}
        onPressCurrent={solves.length ? () => setDetailIndex(0) : undefined}
        onPressBest={bestSingleIdx !== null ? () => setDetailIndex(bestSingleIdx) : undefined}
      />

      {rows.map((r) => {
        const isMo3 = r.size === 3;
        return (
          <StatCard
            key={r.size}
            label={isMo3 ? 'mo3' : `ao${r.size}`}
            current={fmt(r.current, solvePrecision, isFmc, 2)}
            best={fmt(r.best, solvePrecision, isFmc, 2)}
            onPressCurrent={solves.length >= r.size ? () => openAverage(r.size, 0) : undefined}
            onPressBest={r.bestIndex !== null ? () => openAverage(r.size, r.bestIndex!) : undefined}
            projections={
              anyProjections
                ? [
                    ...(showBPA ? [{ label: 'BPA', value: fmt(r.bpa, solvePrecision, isFmc, 2) }] : []),
                    // Mo3's WPA is always DNF (any DNF makes a mean DNF), so it's
                    // not useful to show. Matching the web table.
                    ...(showWPA && !isMo3
                      ? [{ label: 'WPA', value: fmt(r.wpa, solvePrecision, isFmc, 2) }]
                      : []),
                    ...(showTarget
                      ? [{ label: 'Target', value: fmt(r.target, solvePrecision, isFmc, 0) }]
                      : []),
                  ]
                : undefined
            }
          />
        );
      })}

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

// One statistic: its name, the current/best pair as the headline, and the
// projection line when enabled.
function StatCard({
  label,
  current,
  best,
  onPressCurrent,
  onPressBest,
  projections,
}: {
  label: string;
  current: string;
  best: string;
  onPressCurrent?: () => void;
  onPressBest?: () => void;
  projections?: { label: string; value: string }[];
}) {
  const p = usePalette();
  const hasProjections = projections && projections.length > 0;

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderColor: p.border,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: p.text, fontFamily: font.sansBold, fontSize: 15, width: 62 }}>{label}</Text>
        <Value label="Current" value={current} onPress={onPressCurrent} accent />
        <Value label="Best" value={best} onPress={onPressBest} />
      </View>

      {hasProjections && (
        <View
          style={{
            flexDirection: 'row',
            gap: space.md,
            paddingTop: space.sm,
            borderTopWidth: 1,
            borderTopColor: p.border,
          }}
        >
          {projections.map((proj) => (
            <View key={proj.label} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <Text
                style={{
                  color: p.textMuted,
                  fontFamily: font.sansSemi,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {proj.label}
              </Text>
              <Text style={{ color: p.textMuted, fontFamily: font.mono, fontSize: 12 }}>{proj.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Value({
  label,
  value,
  onPress,
  accent,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  accent?: boolean;
}) {
  const p = usePalette();
  const tappable = !!onPress && value !== '—' && value !== '';
  const body = (
    <>
      <Text
        style={{
          color: p.textMuted,
          fontFamily: font.sansSemi,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent ? p.accent : p.text,
          fontFamily: font.monoBold,
          fontSize: 17,
          fontVariant: ['tabular-nums'],
          textDecorationLine: tappable ? 'underline' : 'none',
        }}
      >
        {value}
      </Text>
    </>
  );

  return tappable ? (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={{ flex: 1, gap: 1 }}>
      {body}
    </Pressable>
  ) : (
    <View style={{ flex: 1, gap: 1 }}>{body}</View>
  );
}
