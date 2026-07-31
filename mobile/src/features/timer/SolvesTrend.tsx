import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import {
  effectiveTime,
  formatMoveCount,
  formatTime,
  makeAverageView,
  TIMER_ONLY_EVENT_IDS,
  type SolveDTO,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import { ColumnLabel, MONO, Surface } from '../../components/ui';
import { space } from '../../theme';

// ── Session trend ─────────────────────────────────────────────────────────
//
// A list of times tells you what you did; it does not tell you how it is going.
// Whether you are warming up, drifting, or having one bad solve inside a good
// session is a shape, and a column of numbers is the one representation that
// hides it. Hence: singles as a faint line, the rolling ao5 as the solid one
// (the ao5 is the thing most people actually judge a session by), and the
// session best marked.
//
// Deliberately not a full charting library: this is four SVG primitives and it
// keeps the dependency list where it is.

// Rendering every solve in a 3000-solve session would be thousands of SVG
// points for a strip a few centimetres wide, where they could not be told
// apart anyway. The recent window is also the part you can still do something
// about.
const WINDOW = 80;
const CHART_H = 96;

export function SolvesTrend({ solves, event }: { solves: SolveDTO[]; event: string }) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  const [width, setWidth] = useState(0);

  const series = useMemo(() => {
    const n = Math.min(solves.length, WINDOW);
    // `solves` is newest-first; a chart reads oldest-left, so walk back.
    const points: { single: number; ao5: number | null; index: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const s = solves[i];
      const view = makeAverageView(solves, i, 5);
      const ao5 = view?.value ?? null;
      points.push({
        single: effectiveTime(s.time, s.penalty, s.plusTwoCount),
        ao5: ao5 !== null && isFinite(ao5) ? ao5 : null,
        index: i,
      });
    }
    const finite = points.filter((pt) => isFinite(pt.single));
    if (finite.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const pt of finite) {
      min = Math.min(min, pt.single);
      max = Math.max(max, pt.single);
    }
    for (const pt of points) {
      if (pt.ao5 !== null) {
        min = Math.min(min, pt.ao5);
        max = Math.max(max, pt.ao5);
      }
    }
    // A session where every solve is identical would otherwise divide by zero.
    if (max - min < 1) {
      max = min + 1;
    }
    const pad = (max - min) * 0.12;
    let bestIdx = 0;
    for (let k = 0; k < points.length; k++) {
      if (isFinite(points[k].single) && points[k].single < points[bestIdx].single) bestIdx = k;
    }
    return { points, min: min - pad, max: max + pad, rawMin: min, rawMax: max, bestIdx, count: n };
  }, [solves]);

  // Two solves is the fewest that can show a direction at all.
  if (!series || series.points.length < 2) return null;

  const { points, min, max, rawMin, rawMax, bestIdx } = series;
  const innerW = Math.max(0, width - space.md * 2);
  const innerH = CHART_H;
  const x = (k: number) => (points.length === 1 ? innerW / 2 : (k / (points.length - 1)) * innerW);
  const y = (v: number) => innerH - ((v - min) / (max - min)) * innerH;

  // Built by index rather than by filtering first, so a DNF breaks the line
  // where it happened instead of being quietly closed over, and so this stays
  // linear (the filter-then-indexOf version was quadratic).
  const singleLine: string[] = [];
  const ao5Line: string[] = [];
  const dnfs: number[] = [];
  for (let k = 0; k < points.length; k++) {
    const pt = points[k];
    if (isFinite(pt.single)) singleLine.push(`${x(k)},${y(pt.single)}`);
    else dnfs.push(k);
    if (pt.ao5 !== null) ao5Line.push(`${x(k)},${y(pt.ao5)}`);
  }

  const fmt = (v: number) =>
    isFmc ? formatMoveCount(v, 'NONE', 0) : formatTime(Math.round(v), 'NONE', solvePrecision);

  return (
    <Surface padding="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingHorizontal: space.md,
          paddingTop: space.sm,
        }}
      >
        <ColumnLabel>
          last {series.count} solve{series.count === 1 ? '' : 's'}
        </ColumnLabel>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {/* A chart with no scale is decoration. These two numbers are the
              whole y axis, which is as much as a strip this size can carry. */}
          <ColumnLabel style={{ fontFamily: MONO }}>{fmt(rawMin)}</ColumnLabel>
          <ColumnLabel style={{ fontFamily: MONO }}>{fmt(rawMax)}</ColumnLabel>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, height: innerH + space.sm * 2 }}>
        {/* Held back until the container has been measured: an SVG drawn at
            width 0 and then re-drawn is a visible flicker on every mount. */}
        {innerW > 0 && (
          <Svg width={innerW} height={innerH}>
            {/* A DNF has no position on a time axis, so it is a full-height
                mark rather than a point on the line, and the line breaks
                across it. That is also how the average treats it. */}
            {dnfs.map((k) => (
              <Line
                key={`dnf-${k}`}
                x1={x(k)}
                y1={0}
                x2={x(k)}
                y2={innerH}
                stroke={p.red}
                strokeWidth={1}
                opacity={0.35}
              />
            ))}
            {singleLine.length > 1 ? (
              <Polyline points={singleLine.join(' ')} fill="none" stroke={p.textMuted} strokeWidth={1} opacity={0.55} />
            ) : null}
            {ao5Line.length > 1 ? (
              <Polyline
                points={ao5Line.join(' ')}
                fill="none"
                stroke={p.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {isFinite(points[bestIdx].single) && (
              <Circle cx={x(bestIdx)} cy={y(points[bestIdx].single)} r={3.5} fill={p.green} />
            )}
          </Svg>
        )}
      </View>
    </Surface>
  );
}
