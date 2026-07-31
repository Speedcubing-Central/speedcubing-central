import { useMemo } from 'react';
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
  type SolveDTO,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import { ColumnLabel, EMPTY, EmptyState, MONO, MONO_BOLD, StatName, Surface } from '../../components/ui';
import { space, stroke } from '../../theme';

// ── The session's statistics, as rows ─────────────────────────────────────
//
// On desktop this is a 7-row x 6-column table sitting permanently beside the
// timer, and the first mobile attempt kept that shape by pinning the stat-name
// column and scrolling the value columns sideways under it.
//
// That was the wrong trade. A table earns its shape from letting you compare
// down a column and across a row *at a glance*, and a column you have to drag
// into view is not at a glance: on a phone the sideways scroll cost the reading
// it was preserving the table to get. So the grid is transposed into one block
// per statistic, which is the shape a phone can actually show all at once.
//
// What survives from the table is the ordering and the emphasis, which is where
// the meaning actually lived: rows run single, mo3, ao5 ... ao1000 exactly as on
// web, current is the accent-coloured primary figure exactly as web's Current
// column is `text-accent`, and best sits beside it as the thing you are chasing.
// Projections drop to a third line because that is their real rank: they are
// what *could* happen, under the two numbers that did.
//
// Every figure comes from @scc/shared, the same module the web StatsTable
// imports. Nothing here computes a number a second way.

// Matches WCA's FMC convention, same as the web table: a single is a whole move
// count, but a mean/average is reported to 2 decimals. BPA/WPA count as
// averages here too, being averages themselves.
//
// The Math.round is a no-op now and kept only to match the web table
// line-for-line: averaging.ts rounds every average to the hundredth (WCA 9f), so
// the value arriving here is already an exact hundredth.
function fmt(v: number | null, timeDecimals: number, isFmc: boolean, fmcDecimals: number): string {
  if (v === null) return EMPTY;
  if (!isFinite(v)) return 'DNF';
  return isFmc ? formatMoveCount(v, 'NONE', fmcDecimals) : formatTime(Math.round(v), 'NONE', timeDecimals);
}

interface Figure {
  text: string;
  onPress?: () => void;
}

interface Projection {
  label: string;
  text: string;
}

export function StatRows({
  solves,
  event,
  compact = false,
  onOpenAverage,
  onOpenSolve,
}: {
  solves: SolveDTO[];
  event: string;
  /** Panel context: tighter rows, since it shares a fixed height with a list. */
  compact?: boolean;
  onOpenAverage: (view: SolveAverage) => void;
  onOpenSolve: (index: number) => void;
}) {
  const { showBPA, showWPA, showTarget, solvePrecision } = useSettings();
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  // O(n·size) per average size, memoized so opening a sheet doesn't recompute a
  // large session's ao1000 from scratch.
  const rows = useMemo(() => buildStatsTable(solves, isFmc ? FMC_MIN_MOVES : 0), [solves, isFmc]);
  const single = useMemo(() => singleStats(solves), [solves]);
  const bestSingleIdx = useMemo(() => bestSingleIndex(solves), [solves]);

  if (solves.length === 0) {
    return <EmptyState title="No solves yet" body="Your statistics appear here after your first solve." />;
  }

  const currentSingle = effectiveTime(solves[0].time, solves[0].penalty, solves[0].plusTwoCount);

  const openAverage = (size: AvgSize, startIndex: number) => {
    const v = makeAverageView(solves, startIndex, size);
    if (v) onOpenAverage(v);
  };

  return (
    <Surface padding="none" style={{ overflow: 'hidden' }}>
      <StatRow
        name="single"
        first
        compact={compact}
        current={{
          text: fmt(currentSingle, solvePrecision, isFmc, 0),
          onPress: () => onOpenSolve(0),
        }}
        best={{
          text: fmt(single.best, solvePrecision, isFmc, 0),
          onPress: bestSingleIdx !== null ? () => onOpenSolve(bestSingleIdx) : undefined,
        }}
        // A projection only means something for an in-progress average, so the
        // single row has none, as on web.
        projections={[]}
      />

      {rows.map((r) => {
        const isMo3 = r.size === 3;
        const projections: Projection[] = [];
        if (showBPA) projections.push({ label: 'bpa', text: fmt(r.bpa, solvePrecision, isFmc, 2) });
        // Mo3's WPA is always DNF (any DNF makes a mean DNF), so it's left out
        // rather than shown, matching the web table's blank cell.
        if (showWPA && !isMo3) projections.push({ label: 'wpa', text: fmt(r.wpa, solvePrecision, isFmc, 2) });
        // fmcDecimals 0 here, not 2: a Target is a single next result, not an
        // average, so for FMC it's a whole move count. Same argument the web
        // table passes.
        if (showTarget) projections.push({ label: 'target', text: fmt(r.target, solvePrecision, isFmc, 0) });

        return (
          <StatRow
            key={r.size}
            name={isMo3 ? 'mo3' : `ao${r.size}`}
            compact={compact}
            // Dimmed rather than hidden while the session is too short to have
            // one. Web shows every row always, and hiding them would make the
            // list jump as a session grows; but six full-weight rows of dashes
            // in a four-solve session is the clutter complaint in miniature, so
            // they recede instead.
            dim={solves.length < r.size}
            current={{
              text: fmt(r.current, solvePrecision, isFmc, 2),
              onPress: solves.length >= r.size ? () => openAverage(r.size, 0) : undefined,
            }}
            best={{
              text: fmt(r.best, solvePrecision, isFmc, 2),
              onPress: r.bestIndex !== null ? () => openAverage(r.size, r.bestIndex!) : undefined,
            }}
            projections={projections}
          />
        );
      })}
    </Surface>
  );
}

function StatRow({
  name,
  current,
  best,
  projections,
  compact,
  first,
  dim,
}: {
  name: string;
  current: Figure;
  best: Figure;
  projections: Projection[];
  compact?: boolean;
  first?: boolean;
  dim?: boolean;
}) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingVertical: compact ? space.sm : space.md,
        borderTopWidth: first ? 0 : stroke.hairline,
        borderTopColor: p.border,
        opacity: dim ? 0.45 : 1,
        gap: compact ? 2 : 4,
      }}
    >
      <StatName>{name}</StatName>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md }}>
        <Figure
          text={current.text}
          onPress={current.onPress}
          // Accent, because web's Current column is `text-accent`. It is also
          // the only figure on the row you are actively watching change.
          color={p.accent}
          size={sc(compact ? 19 : 22)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <ColumnLabel>best</ColumnLabel>
          <Figure text={best.text} onPress={best.onPress} color={p.text} size={sc(compact ? 14 : 16)} />
        </View>
      </View>

      {projections.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', columnGap: space.md, flexWrap: 'wrap' }}>
          {projections.map((proj) => (
            <View key={proj.label} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <ColumnLabel>{proj.label}</ColumnLabel>
              <ProjectionValue text={proj.text} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Figure({
  text,
  onPress,
  color,
  size,
}: {
  text: string;
  onPress?: () => void;
  color: string;
  size: number;
}) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  // EMPTY means there is no such average yet, so there is nothing to open.
  const tappable = !!onPress && text !== EMPTY;
  const body = (
    <ValueText
      text={text}
      color={tappable ? color : text === EMPTY ? p.textMuted : color}
      size={size}
      family={MONO_BOLD}
      maxFontMultiplier={maxFontMultiplier}
    />
  );
  if (!tappable) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      {body}
    </Pressable>
  );
}

function ProjectionValue({ text }: { text: string }) {
  const p = usePalette();
  const { s: sc, maxFontMultiplier } = useScreenScale();
  return (
    <ValueText
      text={text}
      color={p.textMuted}
      size={sc(12)}
      family={MONO}
      maxFontMultiplier={maxFontMultiplier}
    />
  );
}

// Every figure on this screen is tabular so a column of times doesn't jitter
// horizontally as the digits change under it.
function ValueText({
  text,
  color,
  size,
  family,
  maxFontMultiplier,
}: {
  text: string;
  color: string;
  size: number;
  family: string;
  maxFontMultiplier: number;
}) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={maxFontMultiplier}
      style={{ color, fontSize: size, fontFamily: family, fontVariant: ['tabular-nums'] }}
    >
      {text}
    </Text>
  );
}
