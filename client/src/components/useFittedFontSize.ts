import { useLayoutEffect, useState, type RefObject } from 'react';

// Sizes text to whatever room is actually left in its container, instead of
// guessing at viewport-relative units. `reservedBelow` is the pixel height
// of whatever else shares the container (hint text, or a manual-entry
// input row) — measuring the real container avoids re-guessing a vh
// percentage against a screen we can't see.
//
// useLayoutEffect, not useEffect: the initial `size` state (144, the old
// static max) is a placeholder for the one render before this can measure
// the real container — useEffect runs *after* the browser paints, so that
// placeholder was briefly visible on every mount (and on any prop change
// that recreates the container, e.g. switching Timer's keyboard/typing
// entry mode) before being corrected a frame or two later. Usually too
// fast to notice, but not always — 144px plus the hint text below it is
// taller than the card's own protected minimum height, so a slow paint
// caught a real, reported "timer text way too big, panel has a scrollbar"
// that then self-corrected. useLayoutEffect runs synchronously before
// paint, so the browser never has anything but the correctly-fitted size
// to show.
export function useFittedFontSize(containerRef: RefObject<HTMLDivElement>, reservedBelow: number): number {
  const [size, setSize] = useState(144); // 9rem, matches the old max
  useLayoutEffect(() => {
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
