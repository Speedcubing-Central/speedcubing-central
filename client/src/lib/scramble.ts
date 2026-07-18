import { Scrambow } from 'scrambow';
import { getEvent, normalizeScramble } from '@scc/shared';
import { api } from './api';

// Synchronous client-side fallback for when the server API is unreachable —
// scrambow-quality for the events it actually supports. There is
// deliberately no fallback of any kind for events scrambow doesn't support
// (kilominx, fto, redi_cube, and — as of the fix below — 4x4 too: see
// shared's WcaEvent.scrambowType, empty for these): this file used to carry
// a hand-rolled random-*move* generator for kilominx/fto/redi_cube as a last
// resort, which produced materially worse scrambles (verified: adjacent
// cancelling moves like "R R'", and — because its move lists were also
// incomplete — some faces never turning at all, "solving" whatever was only
// reachable through them). Per explicit product decision, a scramble for
// these events must always be genuinely random-state or the app must keep
// trying — never something lower-quality, even temporarily. See getScramble
// below for the retry loop this feeds into.
//
// Note scrambow itself is only genuinely random-state (a real solver) for
// 222/333 — its 444/555/666/777 generator is a random-*move* picker with a
// known defect (see hasRedundantWideRotation below), which is exactly why
// 4x4 no longer has a scrambowType at all. 6x6 is the one NxN event that
// still routes through scrambow (server-side it's scrambow-primary; here
// it's the same last-resort-when-server-unreachable fallback as everything
// else), so it gets the same regenerate-on-detection treatment as the
// server's copy of this logic (server/src/scramble.ts) rather than being
// exempted.
const OPPOSITE_FACE: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', L: 'R', R: 'L' };
const AXIS_REFERENCE_FACE = new Set(['U', 'F', 'R']);
const WIDE_MOVE_RE = /^(\d*)([UDFBLR])(w?)(2|')?$/;

interface ParsedWideMove {
  face: string;
  depth: number;
  turns: 1 | 2 | -1;
}

function parseWideMove(token: string): ParsedWideMove | null {
  const m = WIDE_MOVE_RE.exec(token);
  if (!m) return null;
  const [, digits, face, wide, suffix] = m;
  const depth = digits ? parseInt(digits, 10) : wide ? 2 : 1;
  const turns = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
  return { face, depth, turns };
}

// See server/src/scramble.ts's fuller doc comment on the identical function
// for the derivation: two adjacent wide moves on opposite faces whose
// depths together span the whole cube collapse to a pure whole-cube
// rotation (a wasted, non-scrambling move) whenever they're both half-turns,
// or both quarter-turns with opposite sign on the axis's reference/opposite
// face pair.
function isRedundantRotationPair(a: ParsedWideMove, b: ParsedWideMove, layers: number): boolean {
  if (OPPOSITE_FACE[a.face] !== b.face) return false;
  if (a.depth + b.depth !== layers) return false;
  if (a.turns === 2 && b.turns === 2) return true;
  if (Math.abs(a.turns) !== 1 || Math.abs(b.turns) !== 1) return false;
  const refTurn = AXIS_REFERENCE_FACE.has(a.face) ? a.turns : b.turns;
  const oppTurn = AXIS_REFERENCE_FACE.has(a.face) ? b.turns : a.turns;
  return refTurn !== oppTurn;
}

function hasRedundantWideRotation(scramble: string, layers: number): boolean {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = parseWideMove(tokens[i]);
    const b = parseWideMove(tokens[i + 1]);
    if (a && b && isRedundantRotationPair(a, b, layers)) return true;
  }
  return false;
}

const NXN_LAYERS: Record<string, number> = { '666': 6 };

export function generateScramble(eventId: string): string {
  const type = getEvent(eventId)?.scrambowType;
  if (!type) return '';
  const layers = NXN_LAYERS[eventId];
  let last = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const s = new Scrambow().setType(type).get(1);
      let scramble = normalizeScramble(s[0]?.scramble_string ?? '');
      if (eventId === 'clock') scramble = scramble.replace(/(\s+(UR|DR|DL|UL))+$/, '');
      last = scramble;
      if (!layers || !hasRedundantWideRotation(scramble, layers)) return scramble;
    } catch {
      return '';
    }
  }
  return last;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Formats a scramble for multi-line display.
// minx: line break after each U/U' move (one megaminx row per line).
// All other events: returned unchanged.
// (sq1 line-wrapping isn't done here — see sq1Pairs below — because how many
// pairs fit per line depends on the rendered width, which a plain string
// can't express.)
export function formatScramble(scramble: string, eventId: string): string {
  if (!scramble) return scramble;

  if (eventId === 'minx') {
    // Each row ends with U or U'; insert a newline after every such move
    // that is followed by more moves.
    return scramble.replace(/(U'?) (?=[RD])/g, '$1\n');
  }

  return scramble;
}

// Each megaminx row (as split out by formatScramble above) is a sequence of
// R++/R--/D++/D-- pairs followed by a trailing U/U' row-turn. Carrot
// notation collapses every pair down to just its two signs — e.g.
// "R++ D-- R-- D++" -> "+- -+" — since a megaminx move only ever needs its
// direction (+ or -), not which of R/D it was; that's implied by position.
// The trailing U/U' is kept as-is.
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

// Converts an already row-broken megaminx scramble (formatScramble's
// output — one row per line) to carrot notation, a line at a time.
export function carrotScramble(formatted: string): string {
  return formatted.split('\n').map(carrotLine).join('\n');
}

// Formats a scramble for copying to the clipboard: single-line (no
// newlines, unlike formatScramble), but with a comma inserted after each
// megaminx row-ending move so rows are still visually separated once pasted
// somewhere that won't render the multi-line display.
export function formatScrambleForCopy(scramble: string, eventId: string): string {
  const normalized = normalizeScramble(scramble);
  if (!normalized) return normalized;

  if (eventId === 'minx') {
    return normalized.replace(/(U'?) (?=[RD])/g, '$1, ');
  }

  return normalized;
}

// Splits a Square-1 scramble into its "(a,b)" pairs, appending a trailing
// " /" to every pair except the last — UNLESS the raw scramble itself ends
// with a slash, in which case the last pair keeps it too. Whether a sq1
// scramble ends in "/" is genuinely meaningful (it means the final move
// needs a slice turn to reach that state) and varies from scramble to
// scramble — it is not a formatting artifact to discard. <ScrambleImage>
// feeds this same raw string, unmodified, straight into the 3D
// visualization, so dropping a trailing slash here would silently make the
// displayed text one slice short of what the diagram actually shows.
// Rendered as individually non-wrapping items in a flex-wrap container (see
// <ScrambleText>), so the browser's own layout decides how many pairs fit
// per line — every line still starts with a pair and ends with a slash (if
// there is one), at any screen size.
export function sq1Pairs(scramble: string): string[] {
  if (!scramble) return [];
  const trimmed = scramble.trim();
  const endsWithSlash = /\/\s*$/.test(trimmed);
  const pairs = trimmed.replace(/\/\s*$/, '').trim().split(' / ');
  return pairs.map((p, i) => (i < pairs.length - 1 || endsWithSlash ? `${p} /` : p));
}

// Fetch a WCA-quality random-state scramble from the server (cubing.js runs
// server-side via Node.js worker_threads, avoiding browser Web Worker issues).
// If the server doesn't respond in time, fall back to client-side scrambow
// for events it supports — but for the events it doesn't (kilominx, fto,
// redi_cube), there is no lower-quality option to drop into (see
// generateScramble's doc comment): this keeps retrying the server,
// forever, with capped exponential backoff, rather than ever hand back a
// scramble that isn't genuinely random-state. `useScrambler`'s `loading`
// state stays true — and touch/manual entry stays blocked — for exactly as
// long as this takes, the same way it already does for any other
// slow-to-generate event.
//
// The 20s timeout here is deliberately longer than the server's own 15s
// internal cubing.js timeout (server/src/scramble.ts) — not arbitrary.
// Aborting an axios request client-side doesn't cancel the in-flight
// computation server-side; retrying *before* the server has given up on the
// previous attempt just piles another concurrent computation on top of an
// abandoned one still running. Verified live: with a shorter client timeout,
// repeated retries against a struggling server compounded into every
// request eventually timing out. Waiting slightly past the server's own
// timeout means each retry only ever starts after the previous attempt has
// actually finished (successfully or not), so retries can't pile up.
export async function getScramble(eventId: string): Promise<string> {
  let delayMs = 500;
  for (;;) {
    try {
      const { data } = await api.get<{ scramble: string }>(`/scramble/${eventId}`, { timeout: 20_000 });
      if (data.scramble) return data.scramble;
    } catch (e) {
      console.warn('Server scramble failed, retrying:', e);
    }
    const fallback = generateScramble(eventId);
    if (fallback) return fallback;
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 8000);
  }
}
