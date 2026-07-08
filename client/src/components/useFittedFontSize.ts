import { useEffect, useState, type RefObject } from 'react';

// Sizes text to whatever room is actually left in its container, instead of
// guessing at viewport-relative units. `reservedBelow` is the pixel height
// of whatever else shares the container (hint text, or a manual-entry
// input row) — measuring the real container avoids re-guessing a vh
// percentage against a screen we can't see.
export function useFittedFontSize(containerRef: RefObject<HTMLDivElement>, reservedBelow: number): number {
  const [size, setSize] = useState(144); // 9rem, matches the old max
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const heightCap = el.clientHeight - reservedBelow;
      const widthCap = el.clientWidth * 0.34;
      setSize(Math.max(40, Math.min(heightCap, widthCap, 144)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, reservedBelow]);
  return size;
}
