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
// So the height scales with how many sticker rows the drawing has to fit down
// it (3 faces stacked, so 3N for an NxN), targeting roughly 8pt per sticker or
// better on a baseline phone.
//
// Height, not width, because a puzzle's `aspect` is only known after cubing.js
// resolves the drawing. Reserving the box by the dimension known up front is
// what keeps the column from reflowing when the image finally lands; the width
// is then whatever the aspect makes it, which on a phone always fits.
const IMAGE_BASE_H: Record<string, number> = {
  '222': 100,
  '333': 116,
  '333oh': 116,
  '333bf': 116,
  '333ft': 116,
  '333fm': 116,
  lsll: 116,
  ll: 116,
  cls: 116,
  '444': 150,
  '444bf': 150,
  '555': 150,
  '555bf': 150,
  // 18 and 21 sticker rows: the two that most need the room.
  '666': 168,
  '777': 168,
  minx: 150,
  // Aspect 0.652, the one puzzle taller than it is wide, so a height budget is
  // the *only* thing that decides how big it gets.
  sq1: 150,
  // Aspect 2.000 and only four dial rows, so it reads fine short and would
  // otherwise be drawn absurdly wide.
  clock: 100,
  pyram: 116,
  skewb: 116,
  kilominx: 150,
  fto: 150,
  redi_cube: 116,
};

// The tightest tier still shows the image. An earlier pass hid it there, and
// the arithmetic showed an iPhone SE at large text reaching `minimal` with over
// 200pt of timer height going spare, so hiding bought nothing and cost the one
// thing the image exists for.
const IMAGE_DENSITY_FACTOR: Record<Density, number> = {
  comfortable: 1,
  compact: 0.85,
  minimal: 0.7,
};

/**
 * Height to give the scramble image for this event, in points.
 *
 * @param s The screen-scale helper from `useScreenScale`.
 */
export function scrambleImageHeight(eventId: string, density: Density, s: (n: number) => number): number {
  const base = IMAGE_BASE_H[eventId] ?? IMAGE_BASE_H['333'];
  return Math.round(s(base) * IMAGE_DENSITY_FACTOR[density]);
}
