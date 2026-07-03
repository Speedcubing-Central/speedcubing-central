// Move-counting metrics, matching cubing.js's own definitions (see
// TwizzleLink's METRIC_EXPLANATIONS in the `cubing/twisty` package):
//
// HTM  (OBTM)  — outer block moves (R, Rw, 4r) = 1 turn; inner block moves
//                (M, 2-5r) = 2 turns; rotations (x/y/z) = 0.
// QTM  (OBQTM) — outer block = 1 per quantum (R2 = 2); inner block = 2 per
//                quantum (M2 = 4); rotations = 0.
// STM  (RBTM)  — outer block = 1; inner block = 1; rotations = 0.
// QSTM (RBQTM) — outer block = 1 per quantum (R2 = 2); inner block = 1 per
//                quantum (M2 = 2); rotations = 0.
// ETM          — every executed move (including rotations) = 1.

export interface MoveMetrics {
  qtm: number;
  htm: number;
  stm: number;
  qstm: number;
  etm: number;
  moveCount: number;
}

interface ClassifiedMove {
  amount: 1 | 2;
  rotation: boolean;
  inner: boolean;
}

function classifyMove(token: string): ClassifiedMove {
  let base = token;
  let amount: 1 | 2 = 1;
  if (base.endsWith('2')) {
    amount = 2;
    base = base.slice(0, -1);
  } else if (base.endsWith("'")) {
    base = base.slice(0, -1);
  }

  if (/^[xyz]$/i.test(base)) return { amount, rotation: true, inner: false };
  if (/^[mes]$/i.test(base)) return { amount, rotation: false, inner: true };
  // Numbered slice range, e.g. "2-5r" — inner block only if it excludes the
  // outermost layer (starting layer > 1); "1-3r" still touches the surface.
  const range = base.match(/^(\d+)-\d+[a-z]w?$/i);
  if (range) return { amount, rotation: false, inner: Number(range[1]) > 1 };
  return { amount, rotation: false, inner: false };
}

export function parseMoves(solution: string): string[] {
  return solution.trim().split(/\s+/).filter(Boolean);
}

export interface MoveToken {
  text: string;
  start: number;
  end: number;
}

// Tokenizes on whitespace like parseMoves, but keeps each token's character
// offsets in the original (untrimmed) string — needed to map a textarea
// cursor position back to the move it's sitting in.
export function tokenizeMoves(input: string): MoveToken[] {
  const tokens: MoveToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

// Maps a cursor offset (e.g. a textarea's selectionStart) to a "moves
// completed" count, for jumping a player to match: every move that ends at or
// before the cursor counts as done (so a cursor right after "R2" counts R2
// itself as done), and a move the cursor is still inside of does not.
export function moveIndexAtCursor(input: string, cursorPos: number): number {
  const tokens = tokenizeMoves(input);
  let completed = 0;
  for (const token of tokens) {
    if (token.end > cursorPos) break;
    completed++;
  }
  return completed;
}

export function countMoveMetrics(solution: string): MoveMetrics {
  const moves = parseMoves(solution);
  let qtm = 0;
  let htm = 0;
  let stm = 0;
  let qstm = 0;
  for (const token of moves) {
    const { amount, rotation, inner } = classifyMove(token);
    if (rotation) continue;
    htm += inner ? 2 : 1;
    qtm += (inner ? 2 : 1) * amount;
    stm += 1;
    qstm += amount;
  }
  return { qtm, htm, stm, qstm, etm: moves.length, moveCount: moves.length };
}

// TPS is conventionally reported using HTM turns.
export function calculateTps(htm: number, seconds: number): number | null {
  if (!isFinite(seconds) || seconds <= 0) return null;
  return htm / seconds;
}
