import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import type { Penalty } from '@scc/shared';
import type { InspectionDirection } from '../../store/settings';

// Port of client/src/features/timer/useTimerEngine.ts.
//
// Every rule that decides what time gets recorded is unchanged: the same
// idle -> inspecting -> holding -> ready -> running -> stopped phase machine,
// the same hold-to-arm window, and (importantly) the same WCA inspection
// penalty assessed at the moment the solve *starts* (>15s used = +2, >17s =
// DNF), so a solve timed on a phone is judged exactly like one timed on a
// laptop.
//
// What's different is only the input surface, because a phone has no keyboard:
//  * The window keydown/keyup listeners are gone. `press()`/`release()` are
//    driven by touch on the timer surface instead (see TimerScreen).
//  * `cancel()` is still here (Escape's job on web) but is reached from an
//    on-screen control rather than a key.
//  * Audio: the web version uses SpeechSynthesis for the 8s/12s inspection
//    calls and a WebAudio oscillator for the start beep. expo-speech is a
//    direct substitute for the former. For the latter there's no oscillator in
//    React Native, so `startSound` fires a haptic tick instead. On a phone
//    that's arguably the better cue anyway, and it changes no recorded value.
export type TimerPhase = 'idle' | 'inspecting' | 'holding' | 'ready' | 'running' | 'stopped';

const INSPECTION_MS = 15000;

interface Options {
  inspection: boolean;
  inspectionDirection: InspectionDirection;
  inspectionVoice: boolean;
  holdToStart: boolean;
  holdDuration: number; // ms
  enabled: boolean;
  startSound?: boolean;
  onComplete: (timeMs: number, penalty: Penalty, plusTwoCount: number) => void;
}

// Hermes exposes performance.now(); fall back to Date.now() if it's ever
// missing so the timer degrades to millisecond resolution rather than crashing.
const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

function speak(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { rate: 1.1 });
  } catch {
    /* speech not available */
  }
}

function startCue() {
  // Fire-and-forget: a failed haptic must never interfere with starting the
  // timer, and awaiting it would add latency to the one moment that matters.
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function useTimerEngine(opts: Options) {
  const { inspection, holdToStart, holdDuration, enabled, onComplete } = opts;

  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [inspectionElapsed, setInspectionElapsed] = useState(0);

  const startRef = useRef(0);
  const rafRef = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectionStart = useRef(0);
  const inspectionRaf = useRef(0);
  const inspectionPenaltyRef = useRef<{ penalty: Penalty; plusTwoCount: number }>({
    penalty: 'NONE',
    plusTwoCount: 0,
  });
  const spoken = useRef({ eight: false, twelve: false });
  const phaseRef = useRef<TimerPhase>('idle');
  phaseRef.current = phase;

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stopInspectionRaf = () => cancelAnimationFrame(inspectionRaf.current);
  const stopTimerRaf = () => cancelAnimationFrame(rafRef.current);

  const tick = useCallback(() => {
    setElapsed(now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Inspection penalty based on the moment the solve STARTS (WCA rules).
  function inspectionPenaltyAtStart(): { penalty: Penalty; plusTwoCount: number } {
    if (!optsRef.current.inspection) return { penalty: 'NONE', plusTwoCount: 0 };
    const used = now() - inspectionStart.current;
    if (used > 17000) return { penalty: 'DNF', plusTwoCount: 0 };
    if (used > 15000) return { penalty: 'NONE', plusTwoCount: 1 };
    return { penalty: 'NONE', plusTwoCount: 0 };
  }

  const stopRunning = useCallback(() => {
    stopTimerRaf();
    const finalMs = now() - startRef.current;
    setElapsed(finalMs);
    setPhase('stopped');
    onComplete(
      Math.round(finalMs),
      inspectionPenaltyRef.current.penalty,
      inspectionPenaltyRef.current.plusTwoCount,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  const startRunning = useCallback(() => {
    stopInspectionRaf();
    inspectionPenaltyRef.current = inspectionPenaltyAtStart();
    startRef.current = now();
    setElapsed(0);
    setPhase('running');
    if (optsRef.current.startSound) startCue();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const beginInspectionCountdown = useCallback(() => {
    inspectionStart.current = now();
    spoken.current = { eight: false, twelve: false };
    const update = () => {
      const used = now() - inspectionStart.current;
      setInspectionElapsed(used);
      if (optsRef.current.inspectionVoice) {
        if (!spoken.current.eight && used >= 8000) {
          spoken.current.eight = true;
          speak('8 seconds');
        }
        if (!spoken.current.twelve && used >= 12000) {
          spoken.current.twelve = true;
          speak('12 seconds');
        }
      }
      inspectionRaf.current = requestAnimationFrame(update);
    };
    update();
  }, []);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const beginHold = useCallback(() => {
    setPhase('holding');
    const delay = optsRef.current.holdToStart ? optsRef.current.holdDuration : 0;
    if (delay <= 0) {
      setPhase('ready');
    } else {
      holdTimer.current = setTimeout(() => setPhase('ready'), delay);
    }
  }, []);

  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'running') {
      stopRunning();
      return;
    }
    if (p === 'idle' || p === 'stopped') {
      if (optsRef.current.inspection) {
        setPhase('inspecting');
        setInspectionElapsed(0);
        beginInspectionCountdown();
      } else {
        beginHold();
      }
      return;
    }
    if (p === 'inspecting') {
      // Inspection keeps running; begin the hold-to-arm window.
      beginHold();
    }
  }, [beginHold, beginInspectionCountdown, stopRunning]);

  const release = useCallback(() => {
    const p = phaseRef.current;
    clearHold();
    if (p === 'ready') {
      startRunning();
    } else if (p === 'holding') {
      // Released before armed, return to the prior state.
      setPhase(optsRef.current.inspection ? 'inspecting' : 'idle');
    }
  }, [startRunning]);

  // Cancel the current attempt. Does NOT record a solve.
  const cancel = useCallback(() => {
    clearHold();
    stopTimerRaf();
    stopInspectionRaf();
    setElapsed(0);
    setInspectionElapsed(0);
    setPhase('idle');
  }, []);

  // If the engine gets disabled mid-attempt (a modal opened, the tab changed,
  // the scramble started reloading), abandon the attempt rather than leaving a
  // live timer running behind an unreachable surface. On web the equivalent
  // couldn't happen the same way because the keyboard listeners simply
  // detached; here the attempt state is what needs unwinding.
  useEffect(() => {
    if (!enabled && phaseRef.current !== 'idle' && phaseRef.current !== 'stopped') {
      cancel();
    }
  }, [enabled, cancel]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      stopTimerRaf();
      stopInspectionRaf();
      clearHold();
      Speech.stop();
    },
    [],
  );

  const inspectionRemaining = INSPECTION_MS - inspectionElapsed;

  return { phase, elapsed, inspectionElapsed, inspectionRemaining, press, release, cancel };
}

// Inspection display text for either counting direction, capping at the same
// +2/DNF thresholds the engine applies at solve-start. Without this cap,
// count-up mode would keep counting past 17 instead of reflecting the penalty
// that's about to be assessed. Verbatim from the web client.
export function formatInspectionDisplay(
  direction: InspectionDirection,
  inspectionElapsed: number,
  inspectionRemaining: number,
): string {
  if (direction === 'up') {
    if (inspectionElapsed < INSPECTION_MS) return String(Math.floor(inspectionElapsed / 1000));
    return inspectionElapsed < INSPECTION_MS + 2000 ? '+2' : 'DNF';
  }
  if (inspectionRemaining > 0) return String(Math.ceil(inspectionRemaining / 1000));
  return inspectionRemaining > -2000 ? '+2' : 'DNF';
}
