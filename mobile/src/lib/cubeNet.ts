// Scramble -> cube state, for the Timer's scramble image.
//
// The web client renders its scramble image with cubing.js's <twisty-player>
// (client/src/components/ScrambleImage.tsx), a DOM custom element with no React
// Native equivalent, so mobile can't share that path and needs its own. This is
// that: a facelet simulator that applies a scramble to a solved NxN cube and
// hands the resulting sticker colors to a renderer (components/ScrambleNet.tsx).
//
// Deliberately NOT in shared/: the web client computes nothing from this (it
// hands the scramble string straight to cubing.js and lets that do the work), so
// putting it in shared/ would be a module with exactly one consumer sitting in
// the package meant for things both clients compute.
//
// Turns are derived from 3D rotations rather than hand-written per-face sticker
// cycles. Hand-written cycles are the usual approach and are famously easy to
// get subtly wrong (one face mirrored, or correct on 3x3 but wrong on 5x5), and
// they have to be re-derived for every cube size. Rotating sticker coordinates
// is one code path that is automatically right for every N and every face.

export type FaceKey = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export const FACE_ORDER: readonly FaceKey[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export interface CubeState {
  n: number;
  /** Per face, n*n face keys in reading order (row 0 first), naming each sticker's color. */
  faces: Record<FaceKey, FaceKey[]>;
}

// Which cube size an event scrambles, or undefined for a puzzle this cannot
// model. Everything non-NxN (megaminx, pyraminx, skewb, square-1, clock, fto,
// kilominx, redi) deliberately has no entry: the renderer shows nothing at all
// for those rather than a confidently-wrong picture.
const EVENT_CUBE_SIZE: Record<string, number> = {
  '222': 2,
  '222bf': 2,
  '333': 3,
  '333oh': 3,
  '333bf': 3,
  '333fm': 3,
  '333ft': 3,
  '333mbf': 3,
  '444': 4,
  '444bf': 4,
  '555': 5,
  '555bf': 5,
  '666': 6,
  '666bf': 6,
  '777': 7,
  '777bf': 7,
};

export function cubeSizeForEvent(eventId: string): number | undefined {
  return EVENT_CUBE_SIZE[eventId];
}

// ── Geometry ───────────────────────────────────────────────────────────────
//
// Integer coordinates on a cube of half-width n, so rotations are exact integer
// permutations with no floating-point comparison anywhere. A sticker's own face
// plane sits at +/-n; its two in-plane coordinates are strictly inside
// (-n, n), which is what makes "which coordinate is +/-n" a unique face test.
//
// Axes: +x right, +y up, +z toward the viewer (out of the F face).
type Coord = readonly [number, number, number];

function stickerCoord(n: number, face: FaceKey, i: number, j: number): Coord {
  switch (face) {
    // Row 0 borders B, column 0 borders L.
    case 'U':
      return [-n + 2 * j + 1, n, -n + 2 * i + 1];
    // Row 0 borders F, column 0 borders L.
    case 'D':
      return [-n + 2 * j + 1, -n, n - (2 * i + 1)];
    // Row 0 borders U, column 0 borders L.
    case 'F':
      return [-n + 2 * j + 1, n - (2 * i + 1), n];
    // Row 0 borders U. Seen from outside the cube, B's column 0 is on the R side.
    case 'B':
      return [n - (2 * j + 1), n - (2 * i + 1), -n];
    // Row 0 borders U, column 0 borders F.
    case 'R':
      return [n, n - (2 * i + 1), n - (2 * j + 1)];
    // Row 0 borders U, column 0 borders B.
    case 'L':
      return [-n, n - (2 * i + 1), -n + 2 * j + 1];
  }
}

function coordToSticker(n: number, c: Coord): { face: FaceKey; i: number; j: number } {
  const [X, Y, Z] = c;
  if (Y === n) return { face: 'U', i: (Z + n - 1) / 2, j: (X + n - 1) / 2 };
  if (Y === -n) return { face: 'D', i: (n - 1 - Z) / 2, j: (X + n - 1) / 2 };
  if (Z === n) return { face: 'F', i: (n - 1 - Y) / 2, j: (X + n - 1) / 2 };
  if (Z === -n) return { face: 'B', i: (n - 1 - Y) / 2, j: (n - 1 - X) / 2 };
  if (X === n) return { face: 'R', i: (n - 1 - Y) / 2, j: (n - 1 - Z) / 2 };
  return { face: 'L', i: (n - 1 - Y) / 2, j: (Z + n - 1) / 2 };
}

// One quarter turn clockwise as seen from *outside* the named face, which for a
// face with outward normal n-hat is a -90 degree rotation about n-hat.
const ROTATE: Record<FaceKey, (c: Coord) => Coord> = {
  U: ([X, Y, Z]) => [-Z, Y, X],
  D: ([X, Y, Z]) => [Z, Y, -X],
  R: ([X, Y, Z]) => [X, Z, -Y],
  L: ([X, Y, Z]) => [X, -Z, Y],
  F: ([X, Y, Z]) => [Y, -X, Z],
  B: ([X, Y, Z]) => [-Y, X, Z],
};

// Is this sticker inside the outermost `depth` layers measured from `face`?
function inTurnedLayers(n: number, face: FaceKey, c: Coord, depth: number): boolean {
  const [X, Y, Z] = c;
  const threshold = n - 2 * depth;
  switch (face) {
    case 'U':
      return Y > threshold;
    case 'D':
      return Y < -threshold;
    case 'R':
      return X > threshold;
    case 'L':
      return X < -threshold;
    case 'F':
      return Z > threshold;
    case 'B':
      return Z < -threshold;
  }
}

export function solvedCube(n: number): CubeState {
  const faces = {} as Record<FaceKey, FaceKey[]>;
  for (const f of FACE_ORDER) faces[f] = new Array<FaceKey>(n * n).fill(f);
  return { n, faces };
}

function cloneState(st: CubeState): CubeState {
  const faces = {} as Record<FaceKey, FaceKey[]>;
  for (const f of FACE_ORDER) faces[f] = st.faces[f].slice();
  return { n: st.n, faces };
}

export function applyMove(st: CubeState, face: FaceKey, depth: number, turns: number): CubeState {
  const n = st.n;
  const quarterTurns = ((turns % 4) + 4) % 4;
  if (quarterTurns === 0) return st;
  const next = cloneState(st);
  for (const from of FACE_ORDER) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = stickerCoord(n, from, i, j);
        if (!inTurnedLayers(n, face, c, depth)) continue;
        let moved: Coord = c;
        for (let k = 0; k < quarterTurns; k++) moved = ROTATE[face](moved);
        const dst = coordToSticker(n, moved);
        next.faces[dst.face][dst.i * n + dst.j] = st.faces[from][i * n + j];
      }
    }
  }
  return next;
}

// Face turns, including wide turns in every notation TNoodle and the fallback
// generator emit: `U`, `U'`, `U2`, `Uw`, `Uw2`, `3Uw`, and the lowercase `u`
// shorthand for a 2-layer turn.
const MOVE_RE = /^(\d*)([UDLRFBudlrfb])(w?)(['’]?)(\d*)('?)$/;

// Whole-cube rotations. Not present in NxN scrambles from either generator, but
// parsed rather than ignored so a hand-entered scramble containing one still
// produces a correct picture instead of a silently wrong one.
const ROTATION_AXIS: Record<string, FaceKey> = { x: 'R', y: 'U', z: 'F' };

interface ParsedMove {
  face: FaceKey;
  depth: number;
  turns: number;
}

export function parseMove(token: string, n: number): ParsedMove | null {
  const rotation = ROTATION_AXIS[token[0]?.toLowerCase() ?? ''];
  if (rotation && /^[xyz](['’]?2?|2?['’]?)$/.test(token)) {
    return { face: rotation, depth: n, turns: turnsFromSuffix(token.slice(1)) };
  }

  const m = MOVE_RE.exec(token);
  if (!m) return null;
  const [, prefix, letter, w, prime1, count, prime2] = m;
  const upper = letter.toUpperCase() as FaceKey;
  const isLowercase = letter !== letter.toUpperCase();

  // Depth: an explicit numeric prefix wins ("3Uw"), then `w`/lowercase mean two
  // layers, otherwise a single outer layer.
  let depth = 1;
  if (prefix) depth = parseInt(prefix, 10);
  else if (w || isLowercase) depth = 2;
  if (depth < 1 || depth > n) return null;

  return { face: upper, depth, turns: turnsFromSuffix(`${prime1}${count}${prime2}`) };
}

function turnsFromSuffix(suffix: string): number {
  const prime = /['’]/.test(suffix);
  const doubled = /2/.test(suffix);
  const base = doubled ? 2 : 1;
  return prime ? -base : base;
}

/**
 * Apply a scramble to a solved cube of size `n`.
 *
 * Returns null if any token fails to parse, rather than a partially-scrambled
 * cube: a picture that silently drops a move is worse than no picture, because
 * someone would set up their cube from it.
 */
export function scrambledCube(n: number, scramble: string): CubeState | null {
  let st = solvedCube(n);
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    // Square-1 scrambles legitimately contain a bare "/" (see CLAUDE.md), and
    // slash-bearing tokens generally aren't NxN moves. Nothing to do here but
    // bail, which the caller renders as "no image".
    const parsed = parseMove(token, n);
    if (!parsed) return null;
    st = applyMove(st, parsed.face, parsed.depth, parsed.turns);
  }
  return st;
}

/** True when every color still appears exactly n*n times, i.e. the state is a permutation of a real cube. */
export function isPlausibleState(st: CubeState): boolean {
  const counts = new Map<FaceKey, number>();
  for (const f of FACE_ORDER) {
    for (const sticker of st.faces[f]) counts.set(sticker, (counts.get(sticker) ?? 0) + 1);
  }
  if (counts.size !== 6) return false;
  for (const f of FACE_ORDER) if (counts.get(f) !== st.n * st.n) return false;
  return true;
}

export function statesEqual(a: CubeState, b: CubeState): boolean {
  if (a.n !== b.n) return false;
  for (const f of FACE_ORDER) {
    for (let k = 0; k < a.faces[f].length; k++) {
      if (a.faces[f][k] !== b.faces[f][k]) return false;
    }
  }
  return true;
}
