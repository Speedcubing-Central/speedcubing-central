import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { usePalette } from '../store/settings';
import { hasScrambleImage, renderScrambleImage, type ScrambleImage } from '../lib/cubingSvg';

// The scramble image: the state the scramble produces, so you can check your
// cube matches before starting.
//
// The drawing itself comes from cubing.js (see lib/cubingSvg.ts), which is what
// the web client renders these with, so the two platforms show the same picture.
// This used to be a hand-written NxN facelet net, which meant every side event
// (megaminx, pyraminx, skewb, square-1, clock, FTO, kilominx, redi) had no image
// at all; all of them are covered now.
export function ScrambleNet({
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
  const [image, setImage] = useState<ScrambleImage | null>(null);

  useEffect(() => {
    // Loading a puzzle's artwork is async (it pulls a dynamic chunk the first
    // time). `cancelled` keeps a slow first load from painting over a newer
    // scramble that resolved ahead of it.
    let cancelled = false;
    if (!scramble || !hasScrambleImage(eventId)) {
      setImage(null);
      return;
    }
    renderScrambleImage(eventId, scramble).then((img) => {
      if (!cancelled) setImage(img);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately not clearing the previous image first. Between solves the
    // puzzle is already loaded and the next drawing arrives in a frame or two,
    // so blanking would only flash the tile empty and jog the layout; holding
    // the old one until the new one is ready is steadier. It IS cleared when the
    // event changes, since a different puzzle has a different aspect ratio and
    // showing the old cube at the new one's size would be visibly wrong.
  }, [eventId, scramble]);

  useEffect(() => {
    setImage(null);
  }, [eventId]);

  // Before the first drawing for a puzzle arrives, show a spinner in the space
  // the image will occupy. The caller fixes the tile's width, so nothing moves
  // when the drawing lands; this just avoids an empty tile in the meantime.
  if (!image) {
    return (
      <View style={{ width: size, height: maxHeight ?? size, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={p.textMuted} />
      </View>
    );
  }

  // Fit inside both budgets, preserving the drawing's own aspect ratio.
  let width = size;
  let height = width / image.aspect;
  if (maxHeight !== undefined && height > maxHeight) {
    height = maxHeight;
    width = height * image.aspect;
  }

  return <SvgXml xml={image.xml} width={width} height={height} />;
}

/** Whether an image can be drawn at all, so callers can lay out without a hole. */
export function hasScrambleNet(eventId: string): boolean {
  return hasScrambleImage(eventId);
}
