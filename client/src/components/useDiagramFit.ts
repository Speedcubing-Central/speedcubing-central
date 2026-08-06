import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

const MIN_DIAGRAM = 90;
// Fixed p-6 padding (48px) + two gap-4 gaps (32px) around the diagram/text/
// button stack — matches ScramblePanel's own className, so this must be
// updated if that spacing ever changes.
const FIXED_OVERHEAD = 80;

// Closed-form (not search) sizing of the scramble diagram to fit within an
// externally-supplied height budget (`maxHeight`), capped at
// `preferredDiagram` — it only ever shrinks the diagram, never crops it, so
// the whole puzzle is always visible just at a smaller size when space is
// tight.
//
// `maxHeight` MUST come from measurements independent of this panel's own
// rendered size (e.g. the column's height minus the timer card's protected
// minimum and the last-solve card, computed by the caller) — using this
// panel's own height here would be circular (the classic bug from this
// card's sizing history: you can't size a box by measuring the box).
// Pass `maxHeight: undefined` where there's no such budget (Battle Mode, or
// the Timer page on mobile where the whole page scrolls instead) — the
// diagram just renders at its preferred size there.
// The returned number is the diagram's HEIGHT. `aspect` (width / height, from
// ScrambleImage's DIAGRAM_ASPECT) is 1 for the square nets, where height and
// width are the same thing; for the wide ones it's what turns the height this
// returns into a width, so this hook has to know it in order to keep that
// width inside the panel.
export function useDiagramFit(
  textRef: RefObject<HTMLElement>,
  btnRef: RefObject<HTMLElement>,
  maxHeight: number | undefined,
  preferredDiagram: number,
  deps: readonly unknown[],
  extraOverhead = 0,
  aspect = 1,
): number {
  const [diagramSize, setDiagramSize] = useState(preferredDiagram);

  const measure = useCallback(() => {
    const text = textRef.current;
    // Horizontal budget. The text row is `w-full`, so its width IS the panel's
    // content width, and — the part that matters — it does not depend on the
    // diagram, so reading it here doesn't reintroduce the circularity this
    // hook's header warns about the way measuring the diagram's own container
    // would. Infinity when it isn't mounted yet: Math.min then just ignores it,
    // and the effect re-runs on the deps once it is.
    //
    // A width cap didn't exist before because the box was square and always
    // smaller than the panel. A 1.6-wide megaminx box is not: at the preferred
    // 320 height it wants 512px, which is wider than the panel on a phone, so
    // without this it would overflow (the card clips) instead of shrinking.
    const maxWidth = text?.clientWidth ?? Infinity;
    const widthCapped = maxWidth / aspect;

    if (maxHeight === undefined) {
      setDiagramSize(Math.min(preferredDiagram, widthCapped));
      return;
    }
    if (!text) return;
    const textHeight = text.scrollHeight;
    const btnHeight = btnRef.current?.offsetHeight ?? 0;
    const available = maxHeight - FIXED_OVERHEAD - extraOverhead - textHeight - btnHeight;
    setDiagramSize(Math.max(MIN_DIAGRAM, Math.min(preferredDiagram, available, widthCapped)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxHeight, preferredDiagram, extraOverhead, aspect, ...deps]);

  useLayoutEffect(measure, [measure]);

  // The height budget arrives as a prop, so it re-runs the effect on its own,
  // but the width budget is measured here — and a window resize that changes
  // the panel's width without changing `maxHeight` (any purely horizontal
  // resize) would otherwise leave the diagram sized against a stale width.
  // Observing the element that budget comes from covers it directly, rather
  // than hoping something else re-renders. Setting the same number is a no-op
  // in React, so a resize that doesn't move the answer costs nothing and this
  // can't feed back on itself.
  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(text);
    return () => ro.disconnect();
  }, [textRef, measure]);

  return diagramSize;
}
