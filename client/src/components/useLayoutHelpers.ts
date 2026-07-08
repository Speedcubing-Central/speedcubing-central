import { useEffect, useState, type RefObject } from 'react';

// Measures a ref'd element's own height, tracked via ResizeObserver. Safe to
// use for a column/card whose height doesn't depend on anything sized from
// this measurement (would be circular otherwise — see useDiagramFit).
export function useElementHeight(ref: RefObject<HTMLDivElement>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => setHeight(el.clientHeight);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
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
