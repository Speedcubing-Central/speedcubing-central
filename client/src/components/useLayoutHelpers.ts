import { useEffect, useState, type RefObject } from 'react';

// Measures a ref'd element's own height, tracked via ResizeObserver. Safe to
// use for a column/card whose height doesn't depend on anything sized from
// this measurement (would be circular otherwise — see useDiagramFit).
//
// Polls (via a short setTimeout, not requestAnimationFrame — rAF can be
// suspended entirely for a backgrounded/hidden tab, which would stall this
// retry indefinitely) until `ref.current` is actually attached before
// observing. This hook's effect only ever runs once (it depends on the ref
// object's own stable identity, not on whatever it currently points to), so
// a ref whose target mounts *after* that first run (e.g. a
// conditionally-rendered div gated on data that's still loading) would
// otherwise bail out on `!el` and silently report 0 forever, with no later
// retry. For a target that's already mounted at effect-time (the common
// case) this costs nothing — `tryAttach` succeeds synchronously on the
// first call, same as before.
export function useElementHeight(ref: RefObject<HTMLDivElement>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryAttach = () => {
      const el = ref.current;
      if (!el) {
        timer = setTimeout(tryAttach, 50);
        return;
      }
      const recompute = () => setHeight(el.clientHeight);
      recompute();
      ro = new ResizeObserver(recompute);
      ro.observe(el);
    };
    tryAttach();
    return () => {
      if (timer !== null) clearTimeout(timer);
      ro?.disconnect();
    };
  }, [ref]);
  return height;
}

// Tracks the md: breakpoint so fixed-height column layouts only apply on
// desktop — mobile has no fixed-height column (the whole page scrolls
// instead), so there's no real budget to compute there.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}
