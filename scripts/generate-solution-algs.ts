// Regenerate client/src/data/solutionAlgs.generated.ts after editing any alg
// data file, or after regenerating validAlts.generated.ts, by running, from
// the repo root:
//
//   node_modules/.bin/esbuild client/src/data/algSets.ts --bundle --format=esm --platform=node --outfile=scripts/_algSets_bundle.generated.mjs
//   node --experimental-strip-types scripts/generate-valid-alts.ts
//   node --experimental-strip-types scripts/generate-solution-algs.ts
//
// Precomputes, for every case and every AUF the Trainer can pick (none, U,
// U', U2), the shortest verified algorithm that solves "this case, scrambled
// with this AUF" — used as the Trainer's revealed solution whenever the
// user hasn't set a custom preferred algorithm for the case (see
// AlgTrainerPage.tsx).
//
// Two real bugs motivated this rather than just prepending the AUF at
// runtime (as the app used to):
//   1. A leading rotation belongs *before* the AUF, not after it (a solver
//      does the regrip, then the AUF turn — not the reverse) — e.g. "U2 y2
//      R ..." should read "y2 U2 R ...". attachAuf handles this: a y-axis
//      rotation always commutes with a U-axis AUF (verified — y-axis
//      rotations don't change which physical layer is U/D), so reordering
//      it is an exact, notation-only change.
//   2. Reordering alone can still leave moves that are individually
//      pointless for *this specific case* — reported live: an EG-2 case
//      whose only defining pattern is a bottom-layer swap that's rotationally
//      symmetric (looks identical from any angle around the vertical axis).
//      For that case, neither a U turn (doesn't touch the bottom layer) nor
//      a y rotation (the bottom pattern doesn't change under it) contributes
//      anything to solving it, yet the naive "AUF + solution" construction
//      still displayed both. This can't be predicted from notation alone —
//      it depends on whether the specific case has that symmetry — so this
//      script instead *tries* stripping the leading moves one at a time and
//      keeps whichever prefix-stripped version is shortest while still
//      verified (via cubing.js) to solve the case for every alt in
//      VALID_ALTS[id] (or `moves` alone when that list is empty), for this
//      AUF specifically. A move only gets dropped when doing so is proven
//      safe for this exact case, never assumed from the move's notation.
import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { ALG_SETS } from './_algSets_bundle.generated.mjs';
import { VALID_ALTS } from '../client/src/data/validAlts.generated.ts';

// ---- Duplicated pure helpers (mirrors client/src/components/CubeDiagram.tsx) ----

function invertAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map((move) => {
    if (move.endsWith("'")) return move.slice(0, -1);
    if (move.endsWith('2')) return move;
    return move + "'";
  }).join(' ');
}
function quarterTurns(move: string): number {
  if (move.endsWith('2')) return 2;
  if (move.endsWith("'")) return 3;
  return 1;
}
function faceOf(move: string): string { return move.replace(/2$|'$/, ''); }
function moveFromQuarterTurns(face: string, qt: number): string | null {
  const n = ((qt % 4) + 4) % 4;
  if (n === 0) return null;
  if (n === 1) return face;
  if (n === 2) return `${face}2`;
  return `${face}'`;
}
function simplifyAlg(alg: string): string {
  const stack: string[] = [];
  for (const move of alg.trim().split(/\s+/).filter(Boolean)) {
    const face = faceOf(move);
    const top = stack[stack.length - 1];
    if (top !== undefined && faceOf(top) === face) {
      stack.pop();
      const combined = moveFromQuarterTurns(face, quarterTurns(top) + quarterTurns(move));
      if (combined) stack.push(combined);
    } else {
      stack.push(move);
    }
  }
  return stack.join(' ');
}
function isRotationToken(t: string): boolean { return ['x', 'y', 'z'].includes(faceOf(t)); }
function isYAxisRotationToken(t: string): boolean { return faceOf(t) === 'y'; }
function attachAuf(auf: string, alg: string): string {
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
function restrictToFaces(alg: string, allowedFaces: Set<string>): string {
  const pending: string[] = [];
  const output: string[] = [];
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(token)) { pending.push(token); continue; }
    const face = faceOf(token);
    const mag = token.slice(face.length);
    if (!/^[UDLRFB]$/.test(face)) { output.push(token); continue; }
    const relabeled = relabelThroughPending(face, pending);
    if (allowedFaces.has(relabeled)) { output.push(relabeled + mag); continue; }
    const [subFace, rot] = FACE_SUBSTITUTE[relabeled + mag];
    output.push(subFace);
    pending.unshift(rot);
  }
  return simplifyAlg(output.join(' '));
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
function invertMag(mag: string): string { if (mag === '') return "'"; if (mag === "'") return ''; return mag; }
function relabelSliceThroughPending(letter: string, mag: string, pending: string[]): [string, string] {
  let l = letter, m = mag;
  for (let i = pending.length - 1; i >= 0; i--) {
    const [newL, flip] = SLICE_RELABEL[pending[i]][l];
    l = newL;
    if (flip) m = invertMag(m);
  }
  return [l, m];
}
function eliminateWideMoves(alg: string): string {
  const pending: string[] = [];
  const output: string[] = [];
  for (const rawToken of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(rawToken)) { pending.push(rawToken); continue; }
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
  return simplifyAlg(output.join(' '));
}
function restrictToFacesCoreLocal(alg: string, allowedFaces: Set<string>): { output: string[]; pending: string[] } {
  const pending: string[] = [];
  const output: string[] = [];
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(token)) { pending.push(token); continue; }
    const face = faceOf(token);
    const mag = token.slice(face.length);
    if (!/^[UDLRFB]$/.test(face)) { output.push(token); continue; }
    const relabeled = relabelThroughPending(face, pending);
    if (allowedFaces.has(relabeled)) { output.push(relabeled + mag); continue; }
    const [subFace, rot] = FACE_SUBSTITUTE[relabeled + mag];
    output.push(subFace);
    pending.unshift(rot);
  }
  return { output, pending };
}
function eliminateWideMovesCoreLocal(alg: string): { output: string[]; pending: string[] } {
  const pending: string[] = [];
  const output: string[] = [];
  for (const rawToken of alg.trim().split(/\s+/).filter(Boolean)) {
    if (isRotationToken(rawToken)) { pending.push(rawToken); continue; }
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
function cleanAlgForDisplay(alg: string, is2x2: boolean): string {
  const { output, pending } = is2x2
    ? restrictToFacesCoreLocal(alg, new Set(['U', 'D', 'L', 'R', 'F', 'B']))
    : eliminateWideMovesCoreLocal(alg);
  return simplifyAlg(pending.join(' ')) === '' ? simplifyAlg(output.join(' ')) : alg;
}

// ---- Masked case-matching (mirrors generate-valid-alts.ts) ----

const IS_2x2 = (kind: string) => ['2x2-oll', '2x2-pbl', 'cll', 'eg1', 'eg2'].includes(kind);
const IS_EG = (kind: string) => ['eg1', 'eg2'].includes(kind);
const ORIENTATION_ONLY = new Set(['oll', '2x2-oll']);
const PERMUTATION_ONLY = new Set(['pll']);
const PERMUTATION_ONLY_BOTH_LAYERS = new Set(['2x2-pbl']);
const FULL_CORNERS_TOP = new Set(['coll', 'cll', 'eg1', 'eg2']);
const LL = [0, 1, 2, 3];
const BOTTOM = [4, 5, 6, 7];

function caseSolved(pattern: any, kind: string): boolean {
  const pd = pattern.patternData;
  if (ORIENTATION_ONLY.has(kind)) {
    const cornersOK = LL.every((i) => pd.CORNERS.orientation[i] === 0);
    const edgesOK = pd.EDGES ? LL.every((i) => pd.EDGES.orientation[i] === 0) : true;
    return cornersOK && edgesOK;
  }
  if (PERMUTATION_ONLY.has(kind)) {
    const cornersOK = LL.every((i) => pd.CORNERS.pieces[i] === i);
    const edgesOK = pd.EDGES ? LL.every((i) => pd.EDGES.pieces[i] === i) : true;
    return cornersOK && edgesOK;
  }
  if (PERMUTATION_ONLY_BOTH_LAYERS.has(kind)) {
    return [...LL, ...BOTTOM].every((i) => pd.CORNERS.pieces[i] === i);
  }
  if (FULL_CORNERS_TOP.has(kind)) {
    return LL.every((i) => pd.CORNERS.pieces[i] === i && pd.CORNERS.orientation[i] === 0);
  }
  return pattern.isIdentical((pattern as any).kpuzzle.defaultPattern());
}
function matchesAny(pattern: any, kind: string, rotationList: string[]): boolean {
  for (const r of rotationList) {
    const pr = r ? pattern.applyAlg(Alg.fromString(r)) : pattern;
    if (caseSolved(pr, kind)) return true;
  }
  return false;
}
const yOnly = ['', 'y', "y'", 'y2'];
const yPlusUDSwap = ['', 'y', "y'", 'y2', 'x2', 'x2 y', "x2 y'", 'x2 y2'];
const AUF_MOVES = ['', 'U', "U'", 'U2'];

// Builds the exact scramble the app would build for `alt` scrambled with
// `auf` — mirrors buildTrainerScrambleAndSolution's scramble half.
function buildScramble(alt: string, auf: string, is2x2: boolean): string {
  const solvingAlg = attachAuf(auf, alt);
  const raw = invertAlg(solvingAlg);
  return is2x2 ? restrictToFaces(raw, new Set(['R', 'U', 'F'])) : eliminateWideMoves(raw);
}

// Mirrors buildTrainerScrambleAndSolution's solution half: the exact
// (not just "up to rotation") algorithm that solves the scramble built from
// `solvingAlg` — necessary, not optional, whenever `solvingAlg`'s own
// leading/embedded rotation gets dropped as trailing pending during
// scramble-building (see that function's doc comment in CubeDiagram.tsx).
// This matters here specifically for the fallback case (no verified alt,
// c.moves used as both scramble- and solution-source): naively starting the
// strip search from `attachAuf(auf, cleanedMoves)` — correct for the
// verified-alt path, where generate-valid-alts.ts already checked that
// exact text against every alt — is NOT provably correct here, since it
// skips this pairing correction entirely. Caught by exhaustively
// re-verifying every generated entry against cubing.js after generation
// (see the doc comment at the top of this file).
function exactPairingSolution(solvingAlg: string, is2x2: boolean): string {
  const raw = invertAlg(solvingAlg);
  const { pending } = is2x2
    ? restrictToFacesCoreLocal(raw, new Set(['R', 'U', 'F']))
    : eliminateWideMovesCoreLocal(raw);
  return simplifyAlg(pending.length > 0 ? `${pending.join(' ')} ${solvingAlg}` : solvingAlg);
}

async function main() {
  const kp2 = await cube2x2x2.kpuzzle();
  const kp3 = await cube3x3x3.kpuzzle();
  const solved2 = kp2.defaultPattern();
  const solved3 = kp3.defaultPattern();

  const result: Record<string, Record<string, string>> = {};
  let strippedCount = 0;
  let caseCount = 0;

  for (const set of ALG_SETS) {
    const is2x2 = IS_2x2(set.kind);
    const isEG = IS_EG(set.kind);
    const solved = is2x2 ? solved2 : solved3;
    const safeRotations = isEG ? yPlusUDSwap : yOnly;

    for (const c of set.cases) {
      caseCount++;
      const usingValidatedAlt = (VALID_ALTS[c.id] ?? []).length > 0;
      const pool = usingValidatedAlt ? VALID_ALTS[c.id] : [c.moves];
      const cleanedMoves = cleanAlgForDisplay(c.moves, is2x2);
      result[c.id] = {};

      const validatesForEveryAlt = (text: string, auf: string): boolean => {
        for (const alt of pool) {
          try {
            const scramble = buildScramble(alt, auf, is2x2);
            const pAfter = solved.applyAlg(Alg.fromString(scramble)).applyAlg(Alg.fromString(text));
            if (!matchesAny(pAfter, set.kind, safeRotations)) return false;
          } catch (e) {
            return false;
          }
        }
        return true;
      };

      for (const auf of AUF_MOVES) {
        // See exactPairingSolution's doc comment for why the fallback case
        // needs a different (and non-optional) starting point than the
        // verified-alt case.
        const candidate = usingValidatedAlt
          ? attachAuf(auf, cleanedMoves)
          : exactPairingSolution(attachAuf(auf, c.moves), is2x2);

        // The starting candidate must itself be correct before any
        // stripping is attempted — verified here rather than assumed, so a
        // wrong starting point (like the one this check originally caught:
        // the fallback path silently reusing the verified-alt formula)
        // fails the build loudly instead of shipping a broken solution.
        if (!validatesForEveryAlt(candidate, auf)) {
          throw new Error(`Starting candidate does not solve ${c.id} (auf="${auf}"): "${candidate}"`);
        }

        let tokens = candidate.trim().split(/\s+/).filter(Boolean);
        while (tokens.length > 1) {
          const strippedText = simplifyAlg(tokens.slice(1).join(' '));
          if (validatesForEveryAlt(strippedText, auf)) {
            tokens = strippedText.split(/\s+/).filter(Boolean);
          } else {
            break;
          }
        }

        const finalText = tokens.join(' ');
        if (finalText !== candidate) strippedCount++;
        result[c.id][auf] = finalText;
      }
    }
  }

  console.error(JSON.stringify({ caseCount, entriesStripped: strippedCount }, null, 2));

  const commentLines = [
    '// GENERATED FILE — do not edit by hand.',
    '// Regenerate with: see the comment atop scripts/generate-solution-algs.ts',
    '//',
    '// Maps each case id to, for every AUF the Trainer can pick ("" / "U" /',
    "// \"U'\" / \"U2\"), the shortest algorithm verified (at build time) to",
    '// solve that case scrambled with that AUF — used as the Trainer\'s',
    "// revealed solution when the user hasn't set a custom preferred alg for",
    '// the case (see AlgTrainerPage.tsx and this script\'s header comment for',
    '// why this needs to be precomputed rather than built at runtime).',
  ];
  const header = commentLines.join('\n') + '\nexport const SOLUTION_ALGS: Record<string, Record<string, string>> = '
    + JSON.stringify(result, null, 2) + ';\n';

  const fs = await import('fs');
  fs.writeFileSync(new URL('../client/src/data/solutionAlgs.generated.ts', import.meta.url), header);
  console.error('Wrote client/src/data/solutionAlgs.generated.ts');
}

main();
