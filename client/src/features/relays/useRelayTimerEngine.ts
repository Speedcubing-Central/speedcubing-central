import { useCallback, useEffect, useRef, useState } from 'react';

export type RelayTimerPhase = 'idle' | 'holding' | 'ready' | 'running' | 'stopped';

interface Options {
  holdToStart: boolean;
  holdDuration: number; // ms
  enabled: boolean;
  startSound?: boolean;
  onStop: (timeMs: number) => void;
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

// A relay times ONE continuous attempt across many scrambles — unlike
// useTimerEngine (features/timer/useTimerEngine.ts), which unconditionally
// resets elapsed to 0 on every start, this hook's `running` phase is only
// ever entered once and never resets itself; the caller decides when to
// call `stop()` (after the final leg), not this hook. There's no per-leg
// "next" transition here — a relay's own tile UI handles moving between
// scrambles independently of the clock.
export function useRelayTimerEngine(opts: Options) {
  const { holdToStart, holdDuration, enabled, startSound, onStop } = opts;

  const [phase, setPhase] = useState<RelayTimerPhase>('idle');
  const [elapsed, setElapsed] = useState(0);

  const startRef = useRef(0);
  const rafRef = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const phaseRef = useRef<RelayTimerPhase>('idle');
  phaseRef.current = phase;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stopRaf = () => cancelAnimationFrame(rafRef.current);

  const tick = useCallback(() => {
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    stopRaf();
    const finalMs = performance.now() - startRef.current;
    setElapsed(finalMs);
    setPhase('stopped');
    onStop(Math.round(finalMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStop]);

  const start = useCallback(() => {
    startRef.current = performance.now();
    setElapsed(0);
    setPhase('running');
    if (optsRef.current.startSound) beep();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'running') {
      stop();
      return;
    }
    if (p !== 'idle' && p !== 'stopped') return;
    setPhase('holding');
    const delay = optsRef.current.holdToStart ? optsRef.current.holdDuration : 0;
    if (delay <= 0) setPhase('ready');
    else holdTimer.current = window.setTimeout(() => setPhase('ready'), delay);
  }, [stop]);

  const release = useCallback(() => {
    const p = phaseRef.current;
    clearHold();
    if (p === 'ready') start();
    else if (p === 'holding') setPhase('idle');
  }, [start]);

  const reset = useCallback(() => {
    clearHold();
    stopRaf();
    setElapsed(0);
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const isTextTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
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
  }, [enabled, press, release]);

  useEffect(
    () => () => {
      stopRaf();
      clearHold();
    },
    [],
  );

  return { phase, elapsed, press, release, reset };
}
