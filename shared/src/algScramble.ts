// Portable scramble-construction for Battle Mode's algorithm-set rounds.
// This is a verbatim port of the pure helpers in
// client/src/components/CubeDiagram.tsx (that file can't be imported
// server-side — it does `import 'cubing/twisty'` at module scope, a
// DOM-only side effect that registers a custom element). This mirrors the
// same duplication pattern scripts/generate-valid-alts.ts already uses for
// the identical reason — see that script for a second independently-proven
// copy of this same logic. Keep in sync by inspection if CubeDiagram.tsx's
// versions of these functions ever change; that logic is stable and has
// been exhaustively verified there (every substitution/relabeling fact was
// checked empirically against cubing.js, not hand-derived), so drift is
// expected to be rare.
import { ALG_SET_INDEX, ALG_CASE_MOVES, ALG_VALID_ALTS } from './algData.generated.js';

export interface AlgSetInfo {
  id: string;
  puzzle: '333' | '222';
  caseIds: string[];
}

const ALG_SET_INDEX_LIST: AlgSetInfo[] = ALG_SET_INDEX as unknown as AlgSetInfo[];

export function getAlgSet(id: string): AlgSetInfo | undefined {
  return ALG_SET_INDEX_LIST.find((s) => s.id === id);
}
export const ALG_SET_IDS: string[] = ALG_SET_INDEX_LIST.map((s) => s.id);

// ---------------------------------------------------------------------------
// Ported verbatim from CubeDiagram.tsx — see that file for the doc comments
// explaining each of these; trimmed here since they're unchanged.
// ---------------------------------------------------------------------------

function quarterTurns(move: string): number {
  const hasPrime = move.endsWith("'");
  const body = hasPrime ? move.slice(0, -1) : move;
  const amount = body.endsWith('3') ? 3 : body.endsWith('2') ? 2 : 1;
  return hasPrime ? (4 - amount) % 4 : amount;
}
function faceOf(move: string): string {
  const hasPrime = move.endsWith("'");
  const body = hasPrime ? move.slice(0, -1) : move;
  return body.endsWith('3') || body.endsWith('2') ? body.slice(0, -1) : body;
}
function moveFromQuarterTurns(face: string, qt: number): string | null {
  const n = ((qt % 4) + 4) % 4;
  if (n === 0) return null;
  if (n === 1) return face;
  if (n === 2) return `${face}2`;
  return `${face}'`;
}

export function invertAlg(alg: string): string {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((move) => moveFromQuarterTurns(faceOf(move), -quarterTurns(move)))
    .filter((move): move is string => move !== null)
    .join(' ');
}

export function simplifyAlg(alg: string): string {
  const stack: string[] = [];
  for (const move of alg.trim().split(/\s+/).filter(Boolean)) {
    const face = faceOf(move);
    const top = stack[stack.length - 1];
    if (top !== undefined && faceOf(top) === face) {
      stack.pop();
      const combined = moveFromQuarterTurns(face, quarterTurns(top) + quarterTurns(move));
      if (combined) stack.push(combined);
    } else {
      const normalized = moveFromQuarterTurns(face, quarterTurns(move));
      if (normalized) stack.push(normalized);
    }
  }
  return stack.join(' ');
}

function isRotationToken(t: string): boolean {
  return ['x', 'y', 'z'].includes(faceOf(t));
}
function isYAxisRotationToken(t: string): boolean {
  return faceOf(t) === 'y';
}

export function attachAuf(auf: string, alg: string): string {
  if (!auf) return simplifyAlg(alg);
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0];
  if (first && isYAxisRotationToken(first)) {
    return simplifyAlg([first, auf, ...tokens.slice(1)].join(' '));
  }
  return simplifyAlg(`${auf} ${alg}`);
}

const FACE_RELABEL: Record<string, Record<string, string>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
  "x'": { U: 'B', B: 'D', D: 'F', F: 'U', R: 'R', L: 'L' },
  x2: { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
  y: { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' },
  "y'": { F: 'L', L: 'B', B: 'R', R: 'F', U: 'U', D: 'D' },
  y2: { F: 'B', B: 'F', R: 'L', L: 'R', U: 'U', D: 'D' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U', F: 'F', B: 'B' },
  "z'": { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
  z2: { U: 'D', D: 'U', L: 'R', R: 'L', F: 'F', B: 'B' },
};
const FACE_SUBSTITUTE: Record<string, [face: string, rotation: string]> = {
  L: ['R', "x'"], "L'": ["R'", 'x'], L2: ['R2', 'x2'],
  D: ['U', "y'"], "D'": ["U'", 'y'], D2: ['U2', 'y2'],
  B: ['F', "z'"], "B'": ["F'", 'z'], B2: ['F2', 'z2'],
};
const WIDE_SUBSTITUTE: Record<string, [face: string, rotation: string]> = {
  r: ['L', 'x'], "r'": ["L'", "x'"], r2: ['L2', 'x2'],
  l: ['R', "x'"], "l'": ["R'", 'x'], l2: ['R2', 'x2'],
  u: ['D', 'y'], "u'": ["D'", "y'"], u2: ['D2', 'y2'],
  d: ['U', "y'"], "d'": ["U'", 'y'], d2: ['U2', 'y2'],
  f: ['B', 'z'], "f'": ["B'", "z'"], f2: ['B2', 'z2'],
  b: ['F', "z'"], "b'": ["F'", 'z'], b2: ['F2', 'z2'],
};
function relabelThroughPending(face: string, pending: string[]): string {
  let f = face;
  for (let i = pending.length - 1; i >= 0; i--) f = FACE_RELABEL[pending[i]][f];
  return f;
}

const SLICE_RELABEL: Record<string, Record<string, [letter: string, flip: boolean]>> = {
  x: { M: ['M', false], E: ['S', true], S: ['E', false] },
  "x'": { M: ['M', false], E: ['S', false], S: ['E', true] },
  x2: { M: ['M', false], E: ['E', true], S: ['S', true] },
  y: { M: ['S', false], E: ['E', false], S: ['M', true] },
  "y'": { M: ['S', true], E: ['E', false], S: ['M', false] },
  y2: { M: ['M', true], E: ['E', false], S: ['S', true] },
  z: { M: ['E', false], E: ['M', true], S: ['S', false] },
  "z'": { M: ['E', true], E: ['M', false], S: ['S', false] },
  z2: { M: ['M', true], E: ['E', true], S: ['S', false] },
};
function invertMag(mag: string): string {
  if (mag === '') return "'";
  if (mag === "'") return '';
  return mag;
}
function relabelSliceThroughPending(letter: string, mag: string, pending: string[]): [string, string] {
  let l = letter;
  let m = mag;
  for (let i = pending.length - 1; i >= 0; i--) {
    const [newL, flip] = SLICE_RELABEL[pending[i]][l];
    l = newL;
    if (flip) m = invertMag(m);
  }
  return [l, m];
}

function restrictToFacesCore(alg: string, allowedFaces: Set<string>): { output: string[]; pending: string[] } {
  const pending: string[] = [];
  const output: string[] = [];
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(token)) {
      pending.push(token);
      continue;
    }
    const face = faceOf(token);
    const mag = token.slice(face.length);
    if (!/^[UDLRFB]$/.test(face)) {
      output.push(token);
      continue;
    }
    const relabeled = relabelThroughPending(face, pending);
    if (allowedFaces.has(relabeled)) {
      output.push(relabeled + mag);
      continue;
    }
    const [subFace, rot] = FACE_SUBSTITUTE[relabeled + mag];
    output.push(subFace);
    pending.unshift(rot);
  }
  return { output, pending };
}

function eliminateWideMovesCore(alg: string): { output: string[]; pending: string[] } {
  const pending: string[] = [];
  const output: string[] = [];
  for (const rawToken of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(rawToken)) {
      pending.push(rawToken);
      continue;
    }
    const wideMatch = rawToken.match(/^([UDLRFB])w(['2]?)$/);
    const lowerMatch = rawToken.match(/^([udlrfb])(['2]?)$/);
    if (!wideMatch && !lowerMatch) {
      const face = faceOf(rawToken);
      const mag = rawToken.slice(face.length);
      if (/^[UDLRFB]$/.test(face)) {
        output.push(relabelThroughPending(face, pending) + mag);
      } else if (/^[MES]$/.test(face)) {
        const [l, m] = relabelSliceThroughPending(face, mag, pending);
        output.push(l + m);
      } else {
        output.push(rawToken);
      }
      continue;
    }
    const base = (wideMatch ? wideMatch[1] : lowerMatch![1]).toLowerCase();
    const mag = wideMatch ? wideMatch[2] : lowerMatch![2];
    const relabeledBase = relabelThroughPending(base.toUpperCase(), pending).toLowerCase();
    const [subFace, rot] = WIDE_SUBSTITUTE[relabeledBase + mag];
    output.push(subFace);
    pending.unshift(rot);
  }
  return { output, pending };
}

export function buildTrainerScrambleAndSolution(
  solvingAlg: string,
  puzzle: '3x3x3' | '2x2x2',
): { scramble: string; solution: string } {
  const is2x2 = puzzle === '2x2x2';
  const raw = invertAlg(solvingAlg);
  const { output, pending } = is2x2
    ? restrictToFacesCore(raw, new Set(['R', 'U', 'F']))
    : eliminateWideMovesCore(raw);
  const scramble = simplifyAlg(output.join(' '));
  const solution = simplifyAlg(pending.length > 0 ? `${pending.join(' ')} ${solvingAlg}` : solvingAlg);
  return { scramble, solution };
}

// ---------------------------------------------------------------------------
// Random case + alt + AUF selection — ported from
// client/src/features/alg-trainer/AlgTrainerPage.tsx's TrainingSession
// (pure data-picking logic there, minus the React state/memoization).
// ---------------------------------------------------------------------------

const AUF_MOVES = ['', 'U', "U'", 'U2'];

function startsOrEndsWithRotation(alg: string): boolean {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const isRotation = (t: string) => /^[xyz]['2]?$/.test(t);
  return tokens.length > 0 && (isRotation(tokens[0]) || isRotation(tokens[tokens.length - 1]));
}

// Draws a brand-new random case + random valid alt + random AUF from
// `algSetId`, exactly mirroring the solo Trainer's own per-round pick — see
// AlgTrainerPage.tsx's TrainingSession. Returns null only if `algSetId`
// isn't a known set, or (defensively) the set/case data is empty.
export function generateAlgSetScramble(algSetId: string): { scramble: string; caseId: string } | null {
  const set = getAlgSet(algSetId);
  if (!set || set.caseIds.length === 0) return null;
  const caseId = set.caseIds[Math.floor(Math.random() * set.caseIds.length)];
  const moves = ALG_CASE_MOVES[caseId];
  if (!moves) return null;

  const verified = ALG_VALID_ALTS[caseId] ?? [];
  const pool = verified.length > 0 ? verified : [moves];
  const clean = pool.filter((alg) => !startsOrEndsWithRotation(alg));
  const candidates = clean.length > 0 ? clean : pool;
  const alg = candidates[Math.floor(Math.random() * candidates.length)];
  const auf = AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)];
  const solvingAlg = attachAuf(auf, alg);
  const puzzleKind = set.puzzle === '222' ? '2x2x2' : '3x3x3';
  const { scramble } = buildTrainerScrambleAndSolution(solvingAlg, puzzleKind);
  return { scramble, caseId };
}
