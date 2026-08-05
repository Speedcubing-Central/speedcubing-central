import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SvgAst } from 'react-native-svg';
import { usePalette } from '../store/settings';
import { hasScrambleImage } from '../lib/cubingSvg';
import { prepareScrambleDrawing, preparedScrambleDrawing, type ScrambleDrawing } from '../lib/scrambleDrawing';
import { mark } from '../lib/perfTrace';

// The scramble image: the state the scramble produces, so you can check your
// cube matches before starting.
//
// The drawing itself comes from cubing.js (see lib/cubingSvg.ts), which is what
// the web client renders these with, so the two platforms show the same picture.
// This used to be a hand-written NxN facelet net, which meant every side event
// (megaminx, pyraminx, skewb, square-1, clock, FTO, kilominx, redi) had no image
// at all; all of them are covered now.
//
// Preparing a drawing (rendering the SVG and parsing it into elements) is the
// expensive part and does not happen here: lib/scrambleDrawing does it ahead of
// time for the scramble the Timer is about to show. This component asks for the
// prepared answer during render, so a prewarmed scramble appears in the same
// commit as the text it belongs to, with no spinner and no intermediate frame
// showing the previous cube.
//
// Memoised because it is a child of the Timer screen, which re-renders several
// times in the moment a solve is recorded. Every one of those renders used to
// rebuild a few hundred SVG elements for a picture that had not changed.
export const ScrambleNet = memo(function ScrambleNet({
  eventId,
  scramble,
  size,
  maxHeight,
}: {
  eventId: string;
  scramble: string;
  /** Width budget in px. */
  size: number;
  /**
   * Height budget in px, if the caller has one. Each puzzle's artwork has its
   * own proportions, so a drawing given only a width can be far taller than the
   * space available; fitting to whichever budget binds first keeps it inside
   * both.
   */
  maxHeight?: number;
}) {
  const p = usePalette();

  // undefined means "not prepared yet", which is why this is not simply falsy
  // tested: null is the settled answer for an event with no artwork.
  const prepared = preparedScrambleDrawing(eventId, scramble);

  // The last drawing that was actually on screen. Its only job is to stay up
  // while an unprepared scramble is being prepared, rather than blanking the
  // tile: between solves the puzzle is already loaded and the replacement lands
  // in a frame or two, so blanking would flash an empty box for no reason. It
  // is dropped when the *event* changes, since a different puzzle has different
  // proportions and the old cube at the new one's size is visibly wrong.
  const [held, setHeld] = useState<{ event: string; drawing: ScrambleDrawing | null }>(() => ({
    event: eventId,
    drawing: prepared ?? null,
  }));

  const shown = prepared !== undefined ? prepared : held.event === eventId ? held.drawing : null;

  useEffect(() => {
    // Temporary: was the drawing already prepared when the scramble changed, or
    // did this scramble have to build one on demand?
    mark(prepared !== undefined ? 'cube-was-prewarmed' : 'cube-MISS-preparing');
    if (prepared !== undefined) {
      // Already on screen; just record it as what to fall back to next time.
      setHeld((prev) =>
        prev.drawing === prepared && prev.event === eventId ? prev : { event: eventId, drawing: prepared },
      );
      return;
    }
    // A miss: the scramble arrived faster than its prewarm, or there was never
    // one (a custom scramble, or going back to the previous one). `cancelled`
    // keeps a slow preparation from painting over a newer scramble that got
    // ahead of it.
    let cancelled = false;
    prepareScrambleDrawing(eventId, scramble).then((drawing) => {
      mark('cube-prepared');
      if (!cancelled) setHeld({ event: eventId, drawing });
    });
    return () => {
      cancelled = true;
    };
  }, [prepared, eventId, scramble]);

  // Before the first drawing for a puzzle arrives, show a spinner in the space
  // the image will occupy. The caller fixes the tile's width, so nothing moves
  // when the drawing lands; this just avoids an empty tile in the meantime.
  if (!shown || !shown.ast) {
    return (
      <View style={{ width: size, height: maxHeight ?? size, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={p.textMuted} />
      </View>
    );
  }

  // Fit inside both budgets, preserving the drawing's own aspect ratio.
  let width = size;
  let height = width / shown.aspect;
  if (maxHeight !== undefined && height > maxHeight) {
    height = maxHeight;
    width = height * shown.aspect;
  }

  return <SvgAst ast={shown.ast} override={{ width, height }} />;
});

/** Whether an image can be drawn at all, so callers can lay out without a hole. */
export function hasScrambleNet(eventId: string): boolean {
  return hasScrambleImage(eventId);
}
