import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const MIN_DIAGRAM = 90;
// Diagram size never grows past this per-event ceiling even if there's more
// room — sq1's 3D render doesn't need to be large to be legible, so it stays
// capped noticeably smaller than events whose 2D net benefits from filling
// the available space.
const MAX_DIAGRAM: Record<string, number> = { sq1: 220 };
const DEFAULT_MAX_DIAGRAM = 420;
// Diagram-size commits are debounced on resize (not on the initial/deliberate
// recompute) since they recreate the <twisty-player> widget (see
// ScrambleImage's spawnPlayer) — the text size is a fixed value per render,
// so it never needs debouncing.
const RESIZE_DEBOUNCE_MS = 150;

// Text size is a static, predictable tier based on how much the scramble
// actually has — not a measurement-driven fit. This is deliberate: fitting
// the text to leftover space (as an earlier version of this hook did) meant
// short scrambles like sq1 got an oversized font while the diagram sat at a
// small fixed size, and longer scrambles could leave dead space once the
// text hit its own cap. A fixed, sensible tier avoids both failure modes;
// the diagram is what adapts to fill whatever room is actually available.
function textSize(scramble: string, eventId: string): number {
  if (eventId === 'minx') return 19;
  if (eventId === 'sq1') return 16;
  const n = scramble.length;
  if (n <= 30) return 36;
  if (n <= 50) return 30;
  if (n <= 80) return 24;
  if (n <= 140) return 20;
  return 18;
}

// Sizes the scramble diagram to fill whatever vertical space is left over
// after the (fixed-size) text and button, against the card's *own* height —
// clamped to a per-event maximum and to the card's width, so it grows to use
// available room without ever looking oversized or getting cut off
// horizontally.
//
// This measurement is only correct when the card's height is determined by
// CSS layout independent of its content — e.g. a flex-grow item with
// flex-basis 0 and min-height 0, the same technique the timer digit's own
// sizing has always relied on. It is NOT correct for a content-sized
// (shrink-0) card, since then the card's height is itself a function of the
// sizes being measured: a circular reference that produces wrong (usually
// collapsing) results — this is what caused every sizing bug earlier in
// this card's history. Callers must pass `enabled: false` for any context
// where the card isn't a flex-grow item (e.g. Battle Mode's card, or the
// Timer page below the md: breakpoint where the whole page scrolls instead
// and the card is naturally content-sized) — a static fallback is used
// there instead.
//
// The diagram is never distorted or cropped to hit a size — only ever this
// plain numeric `size` value, which ScrambleImage renders undistorted.
export function useScrambleTextFit(
  cardRef: RefObject<HTMLDivElement>,
  textRef: RefObject<HTMLDivElement>,
  btnRef: RefObject<HTMLElement>,
  enabled: boolean,
  scramble: string,
  eventId: string,
  preferredDiagram: number,
  deps: readonly unknown[],
): { diagramSize: number; fontPx: number } {
  const [diagramSize, setDiagramSize] = useState(preferredDiagram);
  const [fontPx, setFontPx] = useState(() => textSize(scramble, eventId));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const text = textRef.current;
    const font = textSize(scramble, eventId);
    setFontPx(font);

    if (!enabled || !card || !text) {
      setDiagramSize(preferredDiagram);
      return;
    }

    const maxDiagram = MAX_DIAGRAM[eventId] ?? DEFAULT_MAX_DIAGRAM;

    const recompute = (immediate: boolean) => {
      const cs = getComputedStyle(card);
      const paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const paddingH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.rowGap || cs.gap || '0');
      const btn = btnRef.current;
      const gapPx = gap * (btn ? 2 : 1);
      const btnH = btn?.offsetHeight ?? 0;
      const availableH = card.clientHeight - paddingV - gapPx - btnH;
      const availableW = card.clientWidth - paddingH;

      const prevFont = text.style.fontSize;
      text.style.fontSize = `${font}px`;
      const textHeight = text.scrollHeight;
      text.style.fontSize = prevFont;

      const diagram = Math.max(MIN_DIAGRAM, Math.min(availableH - textHeight, availableW, maxDiagram));

      if (immediate) {
        setDiagramSize(diagram);
      } else {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setDiagramSize(diagram), RESIZE_DEBOUNCE_MS);
      }
    };

    recompute(true);
    const ro = new ResizeObserver(() => recompute(false));
    ro.observe(card);
    return () => {
      ro.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, preferredDiagram, ...deps]);

  return { diagramSize, fontPx };
}
