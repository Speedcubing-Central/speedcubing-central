import { memo, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatTime } from '@scc/shared';
import { MONO_BOLD } from '../../components/ui';
import type { TimerUpdate, InspectionDirection } from '../../store/settings';
import { formatInspectionDisplay, type TimerPhase, type TimerTickListener } from './useTimerEngine';
import { space } from '../../theme';

// ── The digits, and nothing else ──────────────────────────────────────────
//
// This exists purely to contain re-renders. The elapsed time changes every
// animation frame, and when it lived in the Timer screen's state that meant the
// entire screen re-rendered 60 times a second: the stats panel (a FlatList once
// it has been opened), the scramble view, an SVG cube, all of it, to move a few
// glyphs. The result was a timer that visibly updated a handful of times a
// second and inspection that lagged before it even appeared.
//
// So the engine pushes ticks to subscribers instead of holding them in state,
// and this is the only subscriber. A frame now costs one Text render.
//
// It also only sets state when the *string* changes, which is the difference
// between 60 renders a second and one during inspection, where the display is
// whole seconds. In centisecond mode the string genuinely does change every
// frame, and one leaf render per frame is what this component is sized for.

function runningText(ms: number, timerUpdate: TimerUpdate, solvePrecision: number): string {
  if (timerUpdate === 'hidden') return 'solving…';
  if (timerUpdate === 'seconds') return formatTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
  if (timerUpdate === 'deciseconds') return formatTime(Math.floor(ms / 100) * 100, 'NONE', 1);
  return formatTime(Math.floor(ms / 10) * 10, 'NONE', solvePrecision === 3 ? 3 : 2);
}

export interface TimerDigitsProps {
  phase: TimerPhase;
  subscribe: (listener: TimerTickListener) => () => void;
  inspection: boolean;
  inspectionDirection: InspectionDirection;
  timerUpdate: TimerUpdate;
  solvePrecision: number;
  /** Shown whenever no attempt is live: the last solve, or a zeroed clock. */
  restingText: string;
  color: string;
  fontSize: number;
}

export const TimerDigits = memo(function TimerDigits({
  phase,
  subscribe,
  inspection,
  inspectionDirection,
  timerUpdate,
  solvePrecision,
  restingText,
  color,
  fontSize,
}: TimerDigitsProps) {
  // Null whenever the phase is not one that ticks, in which case `restingText`
  // is shown instead. Keeping them separate means a phase change repaints
  // immediately rather than waiting for the next frame to correct the text.
  const [liveText, setLiveText] = useState<string | null>(null);

  const isInspecting = inspection && (phase === 'inspecting' || phase === 'holding' || phase === 'ready');
  const isRunning = phase === 'running';
  const live = isInspecting || isRunning;

  useEffect(() => {
    if (!live) {
      setLiveText(null);
      return;
    }
    let last: string | null = null;
    return subscribe((elapsed, inspectionElapsed) => {
      const next = isRunning
        ? runningText(elapsed, timerUpdate, solvePrecision)
        : formatInspectionDisplay(inspectionDirection, inspectionElapsed, 15000 - inspectionElapsed);
      // The guard is the point: during inspection this fires 60 times a second
      // and the answer changes once.
      if (next !== last) {
        last = next;
        setLiveText(next);
      }
    });
  }, [live, isRunning, subscribe, timerUpdate, solvePrecision, inspectionDirection]);

  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      // Sized from the tile it was measured into, so the OS text setting must
      // not scale it again on top of that: the result would be a number too
      // tall for the box, which is the clipping this replaced.
      allowFontScaling={false}
      style={{
        color,
        fontFamily: MONO_BOLD,
        fontSize,
        lineHeight: fontSize * 1.1,
        fontVariant: ['tabular-nums'],
        paddingHorizontal: space.lg,
      }}
    >
      {liveText ?? restingText}
    </Text>
  );
});
