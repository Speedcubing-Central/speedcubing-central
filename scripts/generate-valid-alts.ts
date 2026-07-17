// Regenerate client/src/data/validAlts.generated.ts AND
// shared/src/algData.generated.ts (a minimal server-safe mirror of the same
// case data, used by Battle Mode's algorithm-set rounds — see
// shared/src/algScramble.ts) after editing any alg data file
// (client/src/data/*.ts) by running, from the repo root:
//
//   node_modules/.bin/esbuild client/src/data/algSets.ts --bundle --format=esm --platform=node --outfile=scripts/_algSets_bundle.generated.mjs
//   node --experimental-strip-types scripts/generate-valid-alts.ts
//
// (The bundle step exists because Node's native TS loader needs fully
// resolved imports and there's no reason to add a runtime dependency on
// esbuild just for that — it's a one-line dev-time step instead.)
//
// Both files are written from this one run rather than two separate
// scripts: by the end of main() below, every case's id/moves/kind and the
// validated-alts map are already computed in memory, so there's exactly one
// source of truth per generation run instead of two independently-invoked
// scripts that could drift from each other.
import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { ALG_SETS } from './_algSets_bundle.generated.mjs';

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
function cleanAlgForDisplay(alg: string, is2x2: boolean): string {
  const { output, pending } = is2x2
    ? restrictToFacesCoreLocal(alg, new Set(['U', 'D', 'L', 'R', 'F', 'B']))
    : eliminateWideMovesCoreLocal(alg);
  // Only safe when the rotation fully cancels — see the real
  // cleanAlgForDisplay's doc comment in CubeDiagram.tsx for why a single
  // uncancelled rotation can't just be relabeled-and-dropped for an
  // algorithm meant to be executed directly, unlike a scramble. `pending` is
  // never merged as it accumulates, so a genuinely cancelling pair (e.g. a
  // leading x ... trailing x') still leaves two raw entries — simplifying
  // the joined content is what actually detects full cancellation.
  return simplifyAlg(pending.join(' ')) === '' ? simplifyAlg(output.join(' ')) : alg;
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

// ---- Masked case-matching (the key fix over the previous, too-strict isIdentical check) ----

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
  // f2l or unknown: no alts exist for f2l in this data, so this path is unused.
  return pattern.isIdentical((pattern as any).kpuzzle.defaultPattern());
}

function matchesAny(pattern: any, kind: string, rotationList: string[]): string | null {
  for (const r of rotationList) {
    const pr = r ? pattern.applyAlg(Alg.fromString(r)) : pattern;
    if (caseSolved(pr, kind)) return r || '(identity)';
  }
  return null;
}

const yOnly = ['', 'y', "y'", 'y2'];
const yPlusUDSwap = ['', 'y', "y'", 'y2', 'x2', 'x2 y', "x2 y'", 'x2 y2'];

async function main() {
  const kp2 = await cube2x2x2.kpuzzle();
  const kp3 = await cube3x3x3.kpuzzle();
  const solved2 = kp2.defaultPattern();
  const solved3 = kp3.defaultPattern();

  const result: Record<string, Record<string, { validAlts: string[]; totalAlts: number }>> = {};

  for (const set of ALG_SETS) {
    const is2x2 = IS_2x2(set.kind);
    const isEG = IS_EG(set.kind);
    const solved = is2x2 ? solved2 : solved3;
    const safeRotations = isEG ? yPlusUDSwap : yOnly;
    result[set.id] = {};

    for (const c of set.cases) {
      const preferredAlg = c.moves;
      // Matches the upgraded solution-cleanup (issue 3's fix): only fully
      // resolve embedded/leading/trailing rotations when doing so is safe
      // (keeps U, or U-or-D for EG, mapped to itself) — otherwise keep the
      // original text (e.g. a real A-perm written with a grip-changing x
      // rotation) rather than silently displaying the wrong face.
      const solutionMoves = cleanAlgForDisplay(preferredAlg, is2x2);
      const validAlts: string[] = [];

      for (const alt of c.alts ?? []) {
        try {
          // Checked across all 4 AUFs, not just none — the scramble build
          // no longer does a separate leading-rotation strip (that could
          // disagree with cleanAlgForDisplay's proper relabeling in edge
          // cases involving non-empty AUF); eliminateWideMoves/
          // restrictToFaces on the final combined+inverted text handles any
          // rotation uniformly, so this needs to check what that actually
          // produces for every AUF the Trainer might pick.
          let allAufsOk = true;
          for (const auf of ['', 'U', "U'", 'U2']) {
            const solvingAlg = simplifyAlg(auf ? `${auf} ${alt}` : alt);
            const raw = invertAlg(solvingAlg);
            const scramble = is2x2 ? restrictToFaces(raw, new Set(['R', 'U', 'F'])) : eliminateWideMoves(raw);
            const fullSolution = simplifyAlg(auf ? `${auf} ${solutionMoves}` : solutionMoves);

            const pScrambled = solved.applyAlg(Alg.fromString(scramble));
            const pAfterSolution = pScrambled.applyAlg(Alg.fromString(fullSolution));
            if (!matchesAny(pAfterSolution, set.kind, safeRotations)) { allAufsOk = false; break; }
          }
          if (allAufsOk) validAlts.push(alt);
        } catch (e) {
          // invalid token / parse error -> not valid
        }
      }
      result[set.id][c.id] = { validAlts, totalAlts: (c.alts ?? []).length };
    }
  }

  // Flatten to caseId -> validAlts (case ids are unique across sets).
  const flat: Record<string, string[]> = {};
  for (const setId of Object.keys(result)) {
    for (const caseId of Object.keys(result[setId])) {
      flat[caseId] = result[setId][caseId].validAlts;
    }
  }

  const commentLines = [
    '// GENERATED FILE — do not edit by hand.',
    '// Regenerate with: see the comment atop scripts/generate-valid-alts.ts',
    '//',
    "// Maps each case id to the subset of its alts that are verified to",
    "// actually solve the same case as its own moves field (same LL",
    '// orientation/permutation, up to whichever whole-cube rotation is legitimate',
    '// for that case type — y-axis only, or y-axis plus a U/D swap for EG-style',
    "// sets that don't distinguish top/bottom). Used by the Trainer to only pick",
    '// alts that produce a correct, correctly-oriented scramble — most alts in',
    '// the source data turn out NOT to satisfy this (see the script for how this',
    "// was discovered), so falling back to using just moves when a case's",
    '// list here is empty is the norm, not an edge case.',
  ];
  const header = commentLines.join('\n') + '\nexport const VALID_ALTS: Record<string, string[]> = '
    + JSON.stringify(flat, null, 2) + ';\n';

  const fs = await import('fs');
  fs.writeFileSync(new URL('../client/src/data/validAlts.generated.ts', import.meta.url), header);
  console.error('Wrote client/src/data/validAlts.generated.ts');

  // Minimal, server-safe mirror of the same case data — used by Battle
  // Mode's algorithm-set rounds (see shared/src/algScramble.ts). Only what
  // a server needs to pick a random case + build its scramble: no
  // diagram-only fields (name/group/oll/pll/slotAlts). Written from this
  // same run (not a separate script) so there's one source of truth per
  // generation rather than two independently-invoked bundle+validate passes
  // that could drift from each other.
  const setIndex = ALG_SETS.map((set: any) => ({
    id: set.id,
    puzzle: IS_2x2(set.kind) ? '222' : '333',
    caseIds: set.cases.map((c: any) => c.id),
  }));
  const caseMoves: Record<string, string> = {};
  for (const set of ALG_SETS as any[]) for (const c of set.cases) caseMoves[c.id] = c.moves;

  const sharedHeader = [
    '// GENERATED FILE — do not edit by hand.',
    '// Regenerate together with client/src/data/validAlts.generated.ts — see',
    '// the comment atop scripts/generate-valid-alts.ts for the exact command.',
    '//',
    '// Minimal, server-safe mirror of client/src/data/algSets.ts: just enough',
    "// (id/puzzle/caseIds, case moves, and the same validated alts as the",
    '// client Trainer uses) for the server to build an algorithm-set Battle',
    '// round scramble without depending on client-only code.',
  ].join('\n') + '\n\n'
    + `export const ALG_SET_INDEX = ${JSON.stringify(setIndex, null, 2)} as const;\n\n`
    + `export const ALG_CASE_MOVES: Record<string, string> = ${JSON.stringify(caseMoves, null, 2)};\n\n`
    + `export const ALG_VALID_ALTS: Record<string, string[]> = ${JSON.stringify(flat, null, 2)};\n`;

  fs.writeFileSync(new URL('../shared/src/algData.generated.ts', import.meta.url), sharedHeader);
  console.error('Wrote shared/src/algData.generated.ts');
}

main();
