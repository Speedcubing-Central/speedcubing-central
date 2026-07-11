import { Scrambow } from 'scrambow';
import { getEvent, normalizeScramble } from '@scc/shared';
import { api } from './api';

// Synchronous client-side fallback for when the server API is unreachable —
// scrambow-quality (i.e. genuinely random-state, same standard as
// TNoodle/cubing.js) for the events it actually supports. There is
// deliberately no fallback of any kind for events scrambow doesn't support
// (kilominx, fto, redi_cube — see shared's WcaEvent.scrambowType, empty for
// these three): this file used to carry a hand-rolled random-*move*
// generator for exactly those three as a last resort, which produced
// materially worse scrambles (verified: adjacent cancelling moves like
// "R R'", and — because its move lists were also incomplete — some faces
// never turning at all, "solving" whatever was only reachable through
// them). Per explicit product decision, a scramble for these events must
// always be genuinely random-state or the app must keep trying — never
// something lower-quality, even temporarily. See getScramble below for the
// retry loop this feeds into.
export function generateScramble(eventId: string): string {
  const type = getEvent(eventId)?.scrambowType;
  if (!type) return '';
  try {
    const s = new Scrambow().setType(type).get(1);
    let scramble = normalizeScramble(s[0]?.scramble_string ?? '');
    if (eventId === 'clock') scramble = scramble.replace(/(\s+(UR|DR|DL|UL))+$/, '');
    return scramble;
  } catch {
    return '';
  }
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
