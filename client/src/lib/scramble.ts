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
// sq1:  line break after each " /" separator so lines always start at a new "(a,b)" pair.
// minx: line break after each U/U' move (one megaminx row per line).
// All other events: returned unchanged.
export function formatScramble(scramble: string, eventId: string): string {
  if (!scramble) return scramble;

  if (eventId === 'sq1') {
    const pairs = scramble.split(' / ');
    const LINE = 5;
    const lines: string[] = [];
    for (let i = 0; i < pairs.length; i += LINE) {
      const chunk = pairs.slice(i, i + LINE);
      const isLast = i + LINE >= pairs.length;
      lines.push(chunk.join(' / ') + (isLast ? '' : ' /'));
    }
    return lines.join('\n');
  }

  if (eventId === 'minx') {
    // Each row ends with U or U'; insert a newline after every such move
    // that is followed by more moves.
    return scramble.replace(/(U'?) (?=[RD])/g, '$1\n');
  }

  return scramble;
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
