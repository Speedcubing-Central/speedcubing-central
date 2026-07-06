import { useLayoutEffect, useState, type RefObject } from 'react';

// Binary-searches the largest font size (px) at which `textRef`'s rendered
// content still fits the vertical space left over in `cardRef` after its
// other children (`aboveRef` — the cube diagram, `belowRef` — the refresh
// button) and padding/gaps. This guarantees the scramble card never needs to
// scroll internally: instead of a fixed text size that can overflow on a
// long scramble or a narrow screen, the size itself shrinks to fit.
export function useFitScrambleFontSize(
  cardRef: RefObject<HTMLDivElement>,
  aboveRef: RefObject<HTMLElement>,
  textRef: RefObject<HTMLDivElement>,
  belowRef: RefObject<HTMLElement>,
  deps: readonly unknown[],
  { min = 10, max = 40 }: { min?: number; max?: number } = {},
): number {
  const [fontPx, setFontPx] = useState(max);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const above = aboveRef.current;
    const text = textRef.current;
    const below = belowRef.current;
    if (!card || !above || !text || !below) return;

    const recompute = () => {
      const cs = getComputedStyle(card);
      const paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gapPx = parseFloat(cs.rowGap || cs.gap || '0') * 2; // two gaps among the three stacked children
      const available = card.clientHeight - paddingV - above.offsetHeight - below.offsetHeight - gapPx;

      const prevFont = text.style.fontSize;
      let lo = min;
      let hi = max;
      let best = min;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        text.style.fontSize = `${mid}px`;
        if (text.scrollHeight <= Math.max(available, 0)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      text.style.fontSize = prevFont;
      setFontPx(best);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(card);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return fontPx;
}
