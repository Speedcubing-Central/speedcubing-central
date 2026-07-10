import { Scrambow } from 'scrambow';
import { getEvent, normalizeScramble } from '@scc/shared';
import { api } from './api';

// Move sets for unofficial events as an emergency client-side fallback.
const UNOFFICIAL_MOVES: Record<string, string[]> = {
  kilominx: ["U", "U'", "R", "R'", "D", "D'", "L", "L'", "F", "F'", "BR", "BR'", "BL", "BL'"],
  fto: ["U", "U'", "F", "F'", "R", "R'", "L", "L'", "BL", "BL'", "BR", "BR'", "D", "D'"],
  redi_cube: ["U", "U'", "R", "R'", "F", "F'", "L", "L'", "B", "B'", "D", "D'"],
};

function randomMoveScramble(moves: string[], length: number): string {
  const out: string[] = [];
  for (let i = 0; i < length; i++) out.push(moves[Math.floor(Math.random() * moves.length)]);
  return out.join(' ');
}

// Synchronous client-side fallback — used only if the server API is unreachable.
export function generateScramble(eventId: string): string {
  const unofficial = UNOFFICIAL_MOVES[eventId];
  if (unofficial) return randomMoveScramble(unofficial, 20);
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
// If the server doesn't respond within 5 s, fall back to client-side scrambow.
export async function getScramble(eventId: string): Promise<string> {
  try {
    const { data } = await api.get<{ scramble: string }>(`/scramble/${eventId}`, { timeout: 5000 });
    if (data.scramble) return data.scramble;
  } catch (e) {
    console.warn('Server scramble failed, falling back:', e);
  }
  return generateScramble(eventId);
}
