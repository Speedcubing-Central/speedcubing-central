import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react';

// Sizes text to whatever room is actually left in its container, instead of
// guessing at viewport-relative units. `reservedBelow` is the pixel height
// of whatever else shares the container (hint text, or a manual-entry
// input row) — measuring the real container avoids re-guessing a vh
// percentage against a screen we can't see.
//
// useLayoutEffect, not useEffect: the initial `size` state (144, the old
// static max) is a placeholder for the one render before this can measure
// the real container — useEffect runs *after* the browser paints, so that
// placeholder was briefly visible on every mount before being corrected a
// frame or two later. Usually too fast to notice, but not always — 144px
// plus the hint text below it is taller than the card's own protected
// minimum height, so a slow paint caught a real, reported "timer text way
// too big, panel has a scrollbar" that then self-corrected. useLayoutEffect
// runs synchronously before paint, so the browser never has anything but
// the correctly-fitted size to show.
//
// Returns a ref callback (attach it to the container) instead of accepting
// a RefObject from the caller. TimerPage points one stable RefObject at
// different physical <div>s depending on entry mode, and unmounts it
// entirely while FMC is active — swapping which element a RefObject points
// to doesn't change the RefObject's own identity, so a plain
// `useEffect(..., [containerRef])` had nothing to key a re-subscription off
// when the swap happened: the ResizeObserver kept watching the old,
// detached element (or nothing at all, if it mounted for the first time
// while `containerRef.current` was null), and `size` froze at a stale value
// that then got applied to the new element's real dimensions — either
// too small for it, or large enough to overflow and show a scrollbar. A
// callback ref sidesteps this: React invokes it directly at commit time
// with the outgoing node and then the incoming one on every swap, so
// storing that in state and keying the ResizeObserver effect off it
// reacts correctly every time, not just on first mount.
// `reservedRight` is the same idea on the other axis: the width of anything
// sitting *beside* the digit rather than under it (Battle Mode's penalty
// controls, once a solve is stopped). It defaults to 0, so callers with a
// digit that spans the full container are unaffected — without it, a digit
// fitted to the whole width would grow into whatever shares its row.
//
// `chars` is how many characters that width has to hold. It used to be baked
// into the width cap as a single factor of 0.34, which is 1/(0.6 × 5): the
// advance of a monospace glyph, times a label of five, as in "12.09". Labels
// are not always five — "12.09+" is six and a stacked "12.09+16" is eight —
// and the cap went on sizing all of them as five, so the text ran 20-60% wider
// than the room it was fitted to and, in Battle Mode, straight over the
// penalty buttons beside it. Passing the real count is the whole fix; the
// default of 5 keeps every existing caller exactly where it was.
const MONO_ADVANCE_EM = 0.6; // one glyph's width in a monospace font, in em

export function useFittedFontSize(
  reservedBelow: number,
  reservedRight = 0,
  chars = 5,
): [RefCallback<HTMLDivElement>, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState(144); // 9rem, matches the old max
  const ref = useCallback((el: HTMLDivElement | null) => setNode(el), []);

  useLayoutEffect(() => {
    if (!node) return;
    const recompute = () => {
      // clientWidth/clientHeight include the container's own padding, and the
      // text only gets the content box. Battle Mode's card is px-6, so the
      // width cap was fitting the digit to 48px it never had — a stacked
      // "17.99+16" overflowed by exactly that and ran over the buttons beside
      // it. Subtracting the padding is what makes these caps mean what they
      // say; it costs nothing on a container without any.
      const cs = getComputedStyle(node);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const heightCap = node.clientHeight - padY - reservedBelow;
      const widthCap = (node.clientWidth - padX - reservedRight) / (MONO_ADVANCE_EM * Math.max(1, chars));
      setSize(Math.max(40, Math.min(heightCap, widthCap, 144)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, reservedBelow, reservedRight, chars]);

  return [ref, size];
}
