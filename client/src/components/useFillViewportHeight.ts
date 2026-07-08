import { useEffect, useState, type RefObject } from 'react';

// Walk up from `el` to find the nearest ancestor with real bottom padding —
// on this app's page shell that's the Layout content wrapper (`p-4` /
// `md:p-8`), regardless of what other chrome (tab bars, breadcrumbs) sits
// between it and `el`. Only its *computed padding* is read, never its
// bounding rect — none of this app's page-shell elements are actually
// pinned to the viewport height (they're all content-sized, relying on
// individual pages to size themselves), so anchoring to an ancestor's rect
// is circular: that rect is only as tall as whatever we render inside it,
// which is exactly what we're trying to compute.
function findPaddedAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    if (parseFloat(getComputedStyle(node).paddingBottom) > 0) return node;
    node = node.parentElement;
  }
  return null;
}

// Fills the exact remaining space between `ref`'s element and the bottom of
// the page's content area. Unlike a fixed `calc(100dvh - Nrem)`, this stays
// correct no matter what sits above the element (a tab bar, breadcrumb,
// banner, ...): it measures the element's real top offset against the true
// viewport height, then subtracts the page wrapper's own bottom padding (a
// stable CSS value) so the element's computed bottom edge lands exactly
// where that padding would end. Returns undefined below the md breakpoint,
// where the page scrolls naturally instead of being height-constrained.
export function useFillViewportHeight(ref: RefObject<HTMLElement>): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => {
      if (window.innerWidth < 768) {
        setHeight(undefined);
        return;
      }
      const paddedWrapper = findPaddedAncestor(el);
      const paddingBottom = paddedWrapper ? parseFloat(getComputedStyle(paddedWrapper).paddingBottom) : 0;
      const top = el.getBoundingClientRect().top;
      setHeight(Math.max(300, window.innerHeight - top - paddingBottom));
    };
    recompute();
    window.addEventListener('resize', recompute);
    const ro = new ResizeObserver(recompute);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('resize', recompute);
      ro.disconnect();
    };
  }, [ref]);
  return height;
}
