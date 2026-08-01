import { getEvent, normalizeScramble } from '@scc/shared';
import { api } from './api';
import type { Density } from './scale';

// Scramble sourcing for mobile.
//
// Same server endpoint the web client uses (`GET /api/scramble/:eventId`), so
// scrambles are the same cubing.js random-state (TNoodle-quality) generations
// on both platforms. That's the whole reason generation is server-side in the
// first place.
//
// The one deliberate difference from client/src/lib/scramble.ts: there is no
// local `scrambow` fallback. On web, scrambow is a synchronous CommonJS bundle
// that's already in the page, so falling back to it when the server is
// unreachable costs nothing. Shipping it into a React Native bundle is a
// different trade, and per this project's existing rule (see that file's long
// comment on kilominx/fto/redi_cube), a scramble must be genuinely
// random-state or the app keeps trying rather than hand back something
// lower-quality. Mobile applies that rule to every event: retry the server with
// capped exponential backoff, forever, and leave `loading` true meanwhile so
// the timer stays blocked and a solve can't be recorded against a stale
// scramble. Same user-visible guarantee, just without a second-best tier.
//
// The 20s per-attempt timeout is the same value and for the same reason as on
// web: it's deliberately longer than the server's own 15s internal cubing.js
// timeout, so a retry can never start while the previous attempt is still
// computing server-side and pile concurrent work on top of abandoned work.
const REQUEST_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getScramble(eventId: string): Promise<string> {
  let delayMs = 500;
  for (;;) {
    try {
      const { data } = await api.get<{ scramble: string }>(`/scramble/${eventId}`, {
        timeout: REQUEST_TIMEOUT_MS,
      });
      if (data.scramble) return normalizeScramble(data.scramble);
    } catch (e) {
      console.warn('Server scramble failed, retrying:', e);
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 8000);
  }
}

// ── Display formatting (ported from client/src/lib/scramble.ts) ────────────

// Megaminx: one row per line, each row ending in a U/U' turn.
export function formatScramble(scramble: string, eventId: string): string {
  if (!scramble) return scramble;
  if (eventId === 'minx') return scramble.replace(/(U'?) (?=[RD])/g, '$1\n');
  return scramble;
}

function carrotSign(move: string): '+' | '-' {
  return move.endsWith('+') ? '+' : '-';
}

function carrotLine(line: string): string {
  const moves = line.split(' ');
  const pairs: string[] = [];
  for (let i = 0; i < moves.length - 1; i += 2) {
    pairs.push(carrotSign(moves[i]) + carrotSign(moves[i + 1]));
  }
  const turn = moves[moves.length - 1];
  return pairs.length ? `${pairs.join(' ')} ${turn}` : turn;
}

// Converts an already row-broken megaminx scramble (formatScramble's output)
// to carrot notation, a line at a time.
export function carrotScramble(formatted: string): string {
  return formatted.split('\n').map(carrotLine).join('\n');
}

// Splits a Square-1 scramble into its "(a,b)" pairs, appending a trailing " /"
// to every pair except the last, UNLESS the raw scramble itself ends with a
// slash, in which case the last pair keeps it too. Whether a sq1 scramble ends
// in "/" is genuinely meaningful and varies per scramble; it is not a
// formatting artifact to discard. Rendered as individually non-wrapping items
// in a wrapping row, so layout decides how many pairs fit per line.
export function sq1Pairs(scramble: string): string[] {
  if (!scramble) return [];
  const trimmed = scramble.trim();
  const endsWithSlash = /\/\s*$/.test(trimmed);
  const pairs = trimmed.replace(/\/\s*$/, '').trim().split(' / ');
  return pairs.map((p, i) => (i < pairs.length - 1 || endsWithSlash ? `${p} /` : p));
}

// Whether an event's scramble should render in a monospace grid-ish way with
// wrapping pairs (sq1) or as plain wrapped text.
export function isSquareOne(eventId: string): boolean {
  return eventId === 'sq1';
}

export function eventName(eventId: string): string {
  return getEvent(eventId)?.name ?? eventId;
}

// A compact badge for the event, for places that show *which* event is selected
// rather than offering a choice between them.
//
// The web client uses @cubing/icons, a webfont, for this. It ships only .woff2,
// which React Native's font loader cannot use (it wants TTF or OTF), so a
// faithful icon isn't available here without a conversion step and a bundled
// binary. The short forms below are what cubers actually write, so they read as
// fast as a glyph and, unlike a generic cube icon, still say which event it is.
//
// The full name is never far: the picker this opens lists every event by name.
const EVENT_BADGE: Record<string, string> = {
  '222': '2x2',
  '333': '3x3',
  '444': '4x4',
  '555': '5x5',
  '666': '6x6',
  '777': '7x7',
  '333oh': 'OH',
  '333bf': '3BLD',
  '444bf': '4BLD',
  '555bf': '5BLD',
  '333fm': 'FMC',
  minx: 'Minx',
  pyram: 'Pyra',
  clock: 'Clock',
  skewb: 'Skewb',
  sq1: 'SQ1',
  kilominx: 'Kilo',
  fto: 'FTO',
  redi_cube: 'Redi',
};

export function eventBadge(eventId: string): string {
  // Falls back to the full name rather than the raw id, so an event added to
  // shared/ without a badge here degrades to something readable.
  return EVENT_BADGE[eventId] ?? eventName(eventId);
}

// ── Scramble image size ───────────────────────────────────────────────────
//
// One constant cannot serve every puzzle, which is what the previous version of
// this got wrong. cubing.js draws every NxN from 4x4 up into the same viewBox
// (800x500, aspect 1.600), so a 7x7 net is exactly the same *shape* as a 4x4
// and differs only in how many stickers are packed into it. In a fixed box that
// means a 7x7's stickers are 4/7 the size of a 4x4's and 3/7 of a 3x3's; at the
// 50pt box this replaces, a 7x7 sticker was 2.4pt, which is not a picture of
// anything.
//
// The knob is WIDTH, expressed as a fraction of the screen.
//
// Sizing by height was the second mistake. Height alone does not say how big a
// drawing looks, because each puzzle has its own proportions: FTO is nearly
// twice as wide as it is tall (1.947), so the height that suited a 3x3 made FTO
// span the display, while square-1 at 0.652 is taller than it is wide and came
// out a sliver. "How much of the screen does this take" is the question that
// was actually being got wrong, and a width fraction answers it directly.
//
// The heights below are then derived, not guessed, because `aspect` is fixed
// cubing.js geometry rather than something that varies at runtime. Reserving
// the box by a computed height keeps the column from reflowing when the drawing
// finally resolves, which is what the async load would otherwise cause.
const IMAGE_WIDTH_FRACTION: Record<string, number> = {
  '222': 0.38,
  '333': 0.4,
  '333oh': 0.4,
  '333bf': 0.4,
  '333ft': 0.4,
  '333fm': 0.4,
  lsll: 0.4,
  ll: 0.4,
  cls: 0.4,
  '444': 0.55,
  '444bf': 0.55,
  '555': 0.6,
  '555bf': 0.6,
  // The big cubes are wider on purpose: 18 and 21 sticker rows need the linear
  // size or the stickers stop being distinguishable. Held at the point where
  // the timer still clears its own floor on the tightest device, which is what
  // caps them rather than taste.
  '666': 0.62,
  '777': 0.65,
  minx: 0.62,
  // Taller than it is wide, so a modest width still makes a tall drawing.
  sq1: 0.3,
  // Only four dial rows and the widest aspect of the set, so it reads clearly
  // at half the screen and would look enormous at more.
  clock: 0.5,
  pyram: 0.42,
  skewb: 0.45,
  kilominx: 0.58,
  fto: 0.52,
  redi_cube: 0.42,
};

// Aspect ratios (width / height) taken from the viewBox cubing.js emits for
// each puzzle. Duplicated here rather than read from the rendered drawing
// because the layout needs the height BEFORE the drawing loads, and these are
// fixed geometry: the artwork's proportions do not depend on the scramble.
// lib/cubingSvg.ts still reads the real value at render time, so a change
// upstream shows up as a slightly wrong box rather than a wrong picture.
const IMAGE_ASPECT: Record<string, number> = {
  '222': 1.345,
  '333': 1.177,
  '333oh': 1.177,
  '333bf': 1.177,
  '333ft': 1.177,
  '333fm': 1.177,
  lsll: 1.177,
  ll: 1.177,
  cls: 1.177,
  '444': 1.6,
  '444bf': 1.6,
  '555': 1.6,
  '555bf': 1.6,
  '666': 1.6,
  '777': 1.6,
  minx: 1.6,
  sq1: 0.652,
  clock: 2.0,
  pyram: 1.137,
  skewb: 1.6,
  kilominx: 1.6,
  fto: 1.947,
  redi_cube: 1.306,
};

const DEFAULT_WIDTH_FRACTION = 0.42;
const DEFAULT_ASPECT = 1.177;

// The tightest tier still shows the image. An earlier pass hid it there, and
// the arithmetic showed an iPhone SE at large text reaching `minimal` with over
// 200pt of timer height going spare, so hiding bought nothing and cost the one
// thing the image exists for.
const IMAGE_DENSITY_FACTOR: Record<Density, number> = {
  comfortable: 1,
  compact: 0.85,
  minimal: 0.7,
};

/** Width budget for this event's drawing, in points. */
export function scrambleImageWidth(eventId: string, screenWidth: number): number {
  return Math.round(screenWidth * (IMAGE_WIDTH_FRACTION[eventId] ?? DEFAULT_WIDTH_FRACTION));
}

/**
 * Height to reserve for this event's scramble image, in points.
 *
 * Derived from the width budget and the puzzle's own aspect, so the box is the
 * shape the drawing will actually be and there is no empty band left over. A
 * single height for every puzzle left FTO in a box twice the height of the
 * picture inside it.
 */
export function scrambleImageHeight(eventId: string, density: Density, screenWidth: number): number {
  const width = scrambleImageWidth(eventId, screenWidth);
  const aspect = IMAGE_ASPECT[eventId] ?? DEFAULT_ASPECT;
  return Math.round((width / aspect) * IMAGE_DENSITY_FACTOR[density]);
}
