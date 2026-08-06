import { useEffect, useRef } from 'react';
import 'cubing/twisty';

const PUZZLE_MAP: Record<string, string> = {
  '222': '2x2x2', '222bf': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333ft': '3x3x3', '333mbf': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6', '666bf': '6x6x6',
  '777': '7x7x7', '777bf': '7x7x7',
  minx: 'megaminx', pyram: 'pyraminx', skewb: 'skewb', clock: 'clock', sq1: 'square1',
  kilominx: 'kilominx', fto: 'fto', redi_cube: 'redi_cube',
};

// Aspect ratio (width / height) of the SVG canvas cubing.js draws each 2D net
// on — its viewBox, read straight out of `puzzles[name].svg()` rather than
// eyeballed. A <twisty-player> scales that canvas into its host element with
// the default preserveAspectRatio (xMidYMid meet), so a host box that isn't
// the canvas's shape letterboxes it and throws the difference away as padding
// nobody asked for.
//
// The big cubes, megaminx, kilominx and skewb all draw on an 800x500 canvas,
// so a square box rendered them at 62.5% of its own height: a 300px box put a
// 5x5 net 175px tall on screen and padded the remaining 125px. Matching the
// box to the canvas turns the same vertical budget into a 280px-tall net
// (+60% height, +156% area), measured in a browser against the real SVGs.
//
// Only puzzles whose canvas is meaningfully wider than tall are listed;
// anything absent keeps the square box it has always had. 2x2 (1.35), 3x3
// (1.18), pyraminx (1.14) and redi cube (1.31) are close enough to square
// that they're left alone.
export const DIAGRAM_ASPECT: Record<string, number> = {
  '444': 1.6, '444bf': 1.6,
  '555': 1.6, '555bf': 1.6,
  '666': 1.6, '666bf': 1.6,
  '777': 1.6, '777bf': 1.6,
  minx: 1.6,
  kilominx: 1.6,
  skewb: 1.6,
  fto: 2368 / 1216,
};

const SIZE_MAP: Record<string, number> = {
  '222': 220, '222bf': 220,
  '333': 250, '333oh': 250, '333bf': 250, '333fm': 250, '333ft': 250, '333mbf': 250,
  '444': 270, '444bf': 270,
  '555': 270, '555bf': 270,
  '666': 270, '666bf': 270,
  '777': 270, '777bf': 270,

  minx: 270, kilominx: 270,
  pyram: 250, skewb: 250, fto: 250, redi_cube: 250,
  sq1: 280,
};

type TwistyEl = HTMLElement & {
  experimentalSetupAlg: string;
  alg: string;
  puzzle: string;
  visualization: string;
};

function spawnPlayer(
  container: HTMLDivElement,
  puzzle: string,
  scramble: string,
  w: number,
  h: number,
  viz = '2D',
  cameraLatitude?: number,
  cameraLongitude?: number,
) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const el = document.createElement('twisty-player') as TwistyEl;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.setAttribute('background', 'none');
  el.setAttribute('control-panel', 'none');
  el.setAttribute('hint-facelets', 'none');
  // Set visualization as an HTML attribute before connecting so connectedCallback reads it.
  el.setAttribute('visualization', viz);
  if (cameraLatitude !== undefined) el.setAttribute('camera-latitude', String(cameraLatitude));
  if (cameraLongitude !== undefined) el.setAttribute('camera-longitude', String(cameraLongitude));
  container.appendChild(el);
  el.puzzle = puzzle;
  el.visualization = viz;
  el.alg = '';
  el.experimentalSetupAlg = scramble || '';
}

function ClockImage({ scramble }: { scramble: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const RENDER_W = 430;
  const RENDER_H = 260;

  useEffect(() => {
    if (containerRef.current) spawnPlayer(containerRef.current, 'clock', scramble, RENDER_W, RENDER_H);
  }, [scramble]);

  return <div ref={containerRef} style={{ width: RENDER_W, height: RENDER_H }} />;
}

// `size` is the diagram's HEIGHT. For everything not in DIAGRAM_ASPECT the
// width matches it, exactly as when this box was always square; for the wide
// nets the width follows from the aspect, so callers keep budgeting the one
// dimension that's actually scarce (see ScramblePanel/useDiagramFit, where the
// vertical space is what has to be shared with the timer).
export function ScrambleImage({
  eventId,
  scramble,
  size,
}: {
  eventId: string;
  scramble: string;
  size?: number;
}) {
  if (eventId === 'clock') {
    return <ClockImage scramble={scramble} />;
  }

  const height = size ?? SIZE_MAP[eventId] ?? 160;
  const width = Math.round(height * (DIAGRAM_ASPECT[eventId] ?? 1));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viz = eventId === 'sq1' ? 'PG3D' : '2D';
    const lat = eventId === 'sq1' ? 25 : undefined;
    const lon = eventId === 'sq1' ? 30 : undefined;
    spawnPlayer(container, PUZZLE_MAP[eventId] ?? '3x3x3', scramble, width, height, viz, lat, lon);
  }, [eventId, scramble, width, height]);

  return <div ref={containerRef} style={{ width, height }} />;
}
