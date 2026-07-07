import { useLayoutEffect, useState, type RefObject } from 'react';

const MIN_DIAGRAM = 90;
// Fixed p-4 padding (32px) + two gap-4 gaps (32px) around the diagram/text/
// button stack — matches ScramblePanel's own className, so this must be
// updated if that spacing ever changes.
const FIXED_OVERHEAD = 64;

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
export function useDiagramFit(
  textRef: RefObject<HTMLElement>,
  btnRef: RefObject<HTMLElement>,
  maxHeight: number | undefined,
  preferredDiagram: number,
  deps: readonly unknown[],
): number {
  const [diagramSize, setDiagramSize] = useState(preferredDiagram);

  useLayoutEffect(() => {
    if (maxHeight === undefined) {
      setDiagramSize(preferredDiagram);
      return;
    }
    const text = textRef.current;
    if (!text) return;
    const textHeight = text.scrollHeight;
    const btnHeight = btnRef.current?.offsetHeight ?? 0;
    const available = maxHeight - FIXED_OVERHEAD - textHeight - btnHeight;
    setDiagramSize(Math.max(MIN_DIAGRAM, Math.min(preferredDiagram, available)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxHeight, preferredDiagram, ...deps]);

  return diagramSize;
}
