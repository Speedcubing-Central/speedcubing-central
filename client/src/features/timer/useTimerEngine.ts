import { useCallback, useEffect, useRef, useState } from 'react';
import type { Penalty } from '@scc/shared';
import type { InspectionDirection } from '../../store/settings';

export type TimerPhase =
  | 'idle' // ready, showing scramble
  | 'inspecting' // inspection running, not yet holding
  | 'holding' // key/touch down, not held long enough yet
  | 'ready' // held long enough — release to start
  | 'running' // timing
  | 'stopped'; // just stopped

const INSPECTION_MS = 15000;

interface Options {
  inspection: boolean;
  inspectionDirection: InspectionDirection;
  inspectionVoice: boolean;
  holdToStart: boolean;
  holdDuration: number; // ms
  enabled: boolean;
  startSound?: boolean;
  onComplete: (timeMs: number, penalty: Penalty) => void;
}

// Speak a short WCA inspection call (e.g. "8 seconds").
function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* speech not available */
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 200);
  } catch {
    /* audio not available */
  }
}

export function useTimerEngine(opts: Options) {
  const { inspection, inspectionVoice, holdToStart, holdDuration, enabled, startSound, onComplete } = opts;

  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [inspectionElapsed, setInspectionElapsed] = useState(0);

  const startRef = useRef(0);
  const rafRef = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const inspectionStart = useRef(0);
  const inspectionRaf = useRef(0);
  const inspectionPenaltyRef = useRef<Penalty>('NONE');
  const spoken = useRef({ eight: false, twelve: false });
  const phaseRef = useRef<TimerPhase>('idle');
  phaseRef.current = phase;

  // Keep the latest opts available to stable callbacks.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stopInspectionRaf = () => cancelAnimationFrame(inspectionRaf.current);
  const stopTimerRaf = () => cancelAnimationFrame(rafRef.current);

  const tick = useCallback(() => {
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Inspection penalty based on the moment the solve STARTS (WCA rules).
  function inspectionPenaltyAtStart(): Penalty {
    if (!optsRef.current.inspection) return 'NONE';
    const used = performance.now() - inspectionStart.current;
    if (used > 17000) return 'DNF';
    if (used > 15000) return 'PLUS2';
    return 'NONE';
  }

  const stopRunning = useCallback(() => {
    stopTimerRaf();
    const finalMs = performance.now() - startRef.current;
    setElapsed(finalMs);
    setPhase('stopped');
    onComplete(Math.round(finalMs), inspectionPenaltyRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  const startRunning = useCallback(() => {
    stopInspectionRaf();
    inspectionPenaltyRef.current = inspectionPenaltyAtStart();
    startRef.current = performance.now();
    setElapsed(0);
    setPhase('running');
    if (optsRef.current.startSound) beep();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const beginInspectionCountdown = useCallback(() => {
    inspectionStart.current = performance.now();
    spoken.current = { eight: false, twelve: false };
    const update = () => {
      const used = performance.now() - inspectionStart.current;
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
      holdTimer.current = window.setTimeout(() => setPhase('ready'), delay);
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
      // Released before armed — return to the prior state.
      setPhase(optsRef.current.inspection ? 'inspecting' : 'idle');
    }
  }, [startRunning]);

  // Cancel the current attempt (Escape). Does NOT record a solve.
  const cancel = useCallback(() => {
    clearHold();
    stopTimerRaf();
    stopInspectionRaf();
    setElapsed(0);
    setInspectionElapsed(0);
    setPhase('idle');
  }, []);

  // Keyboard (spacebar to start + escape). Starting (and the hold-to-arm
  // sequence leading up to it) is Space-specific, but once the timer is
  // actually running, any key stops it — matching the moment your hands
  // leave the keyboard for the cube, where a stray keypress means you're
  // done, not that you specifically hit Space again.
  useEffect(() => {
    if (!enabled) return;
    const isTextTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phaseRef.current !== 'idle' && phaseRef.current !== 'stopped') {
          e.preventDefault();
          cancel();
        }
        return;
      }
      if (e.repeat || isTextTarget(e.target)) return;
      if (phaseRef.current === 'running') {
        e.preventDefault();
        press();
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTextTarget(e.target)) return;
      e.preventDefault();
      release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled, press, release, cancel]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      stopTimerRaf();
      stopInspectionRaf();
      clearHold();
    },
    [],
  );

  // Derived inspection remaining (ms), for the countdown display.
  const inspectionRemaining = INSPECTION_MS - inspectionElapsed;

  return { phase, elapsed, inspectionElapsed, inspectionRemaining, press, release, cancel };
}

// Inspection display text for either counting direction, capping at the same
// +2/DNF thresholds the engine itself applies at solve-start
// (inspectionPenaltyAtStart above) — without this cap, count-up mode would
// just keep counting seconds past 17 instead of reflecting the penalty
// that's about to be assessed.
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
