import { useCallback, useEffect, useRef, useState } from 'react';

export const FMC_TIME_LIMIT_MS = 60 * 60 * 1000;

export type FmcStatus = 'idle' | 'running' | 'stopped';

// A countdown, not a stopwatch — FMC is scored by move count, never by how
// fast you find or type your solution, so there's nothing to measure here.
// This is purely the 60-minute soft limit WCA gives a competitor to work
// out and write down a solution once the scramble is revealed. Resets
// whenever `resetKey` changes — TimerPage passes the current scramble, so a
// new scramble always starts a fresh, un-started 60:00 instead of carrying
// over whatever state the previous attempt ended in.
export function useFmcEngine(resetKey: string, onExpire: () => void) {
  const [status, setStatus] = useState<FmcStatus>('idle');
  const [remainingMs, setRemainingMs] = useState(FMC_TIME_LIMIT_MS);
  const deadlineRef = useRef<number | null>(null);
  // Ref rather than a dep so a re-render-only change in the caller's
  // onExpire identity doesn't tear down/restart the interval below.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  useEffect(() => {
    setStatus('idle');
    setRemainingMs(FMC_TIME_LIMIT_MS);
    deadlineRef.current = null;
    expiredRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (status !== 'running') return;
    const tick = () => {
      const left = Math.max(0, (deadlineRef.current ?? Date.now()) - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setStatus('stopped');
        onExpireRef.current();
      }
    };
    tick();
    // 1s resolution is plenty for a 60-minute countdown — no need for the
    // main stopwatch's requestAnimationFrame-driven centisecond precision.
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    deadlineRef.current = Date.now() + FMC_TIME_LIMIT_MS;
    setStatus('running');
  }, [status]);

  // Called once a result has actually been submitted (any of: move-count
  // save, verified-solution save, or manual DNF) so the countdown stops
  // advancing immediately rather than continuing to tick down toward an
  // expiry that no longer means anything.
  const finish = useCallback(() => {
    expiredRef.current = true;
    setStatus('stopped');
  }, []);

  return { status, remainingMs, start, finish };
}
