// Last-layer and F2L case diagrams using cubing.js twisty-player.
// Each component takes the algorithm that SOLVES the case; we display the
// inverse (the unsolved state). OLL/PLL/COLL use 2D flat view; F2L uses 3D.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import 'cubing/twisty';

// Legacy types kept so existing data files compile without changes.
export interface OllPattern { u: boolean[]; top: boolean[]; right: boolean[]; bottom: boolean[]; left: boolean[]; }
export interface PllArrow { from: number; to: number; kind?: 'corner' | 'edge'; }

type TwistyEl = HTMLElement & {
  experimentalSetupAlg: string;
  experimentalStickeringMaskOrbits: unknown;
  alg: string;
  puzzle: string;
  visualization: string;
};

export type StickeringKind = 'oll' | 'pll' | 'f2l' | 'coll' | '2x2-oll' | 'full';

// Net quarter-turns for one move (mod 4). Handles the standard plain/2/'
// suffixes, PLUS a literal '3' amount (e.g. "R3", "y3") that a few imported
// algorithms use to mean "three quarter turns" — the same net rotation as
// R' — since some source data represents moves this way instead of using
// prime notation. Also tolerates the "2'"/"3'" combinations that show up in
// a couple of entries (e.g. "R2'", "M3'") by computing the net amount the
// same way an actual cube would, rather than treating the trailing "'" and
// digit as mutually exclusive.
function quarterTurns(move: string): number {
  const hasPrime = move.endsWith("'");
  const body = hasPrime ? move.slice(0, -1) : move;
  const amount = body.endsWith('3') ? 3 : body.endsWith('2') ? 2 : 1;
  return hasPrime ? (4 - amount) % 4 : amount;
}
// The face/axis a move acts on, e.g. "U'" -> "U", "Rw2" -> "Rw", "y'" -> "y",
// "R3" -> "R". Two moves only ever combine if this matches exactly, so a
// rotation (y) never gets combined with a face turn (U) even though both
// are "U-ish".
function faceOf(move: string): string {
  const hasPrime = move.endsWith("'");
  const body = hasPrime ? move.slice(0, -1) : move;
  return body.endsWith('3') || body.endsWith('2') ? body.slice(0, -1) : body;
}
function moveFromQuarterTurns(face: string, qt: number): string | null {
  const n = ((qt % 4) + 4) % 4;
  if (n === 0) return null; // net identity — cancels out entirely
  if (n === 1) return face;
  if (n === 2) return `${face}2`;
  return `${face}'`;
}

// Inverts an algorithm. Goes through quarterTurns/faceOf/moveFromQuarterTurns
// (rather than a naive per-token suffix flip) so it's correct for — and
// always re-renders in standard notation out of — any "3"-amount or
// prime-combination tokens (see quarterTurns above), instead of e.g. turning
// "R3" into the meaningless "R3'".
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

// Combines adjacent same-face moves into their net turn (or drops them
// entirely if they cancel out), e.g. "U' U" -> "" and "U U" -> "U2". Used
// wherever an AUF or setup move gets prepended to an existing algorithm —
// blindly concatenating can otherwise land right next to that algorithm's
// own first move on the same face, producing a redundant pair that's
// mathematically a no-op but visibly confusing (e.g. "U' U R2 ...").
// A simple left-to-right stack pass handles cascading cancellations
// correctly (e.g. "U R R' U'" fully collapses: R/R' cancel, exposing the
// now-adjacent U/U' pair, which then also cancels). Every move — not just
// ones that end up combining with a neighbor — gets re-rendered through
// moveFromQuarterTurns, so this also normalizes any non-standard "3"-amount
// token (see quarterTurns) into standard notation even when it has no
// adjacent same-face move to combine with.
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

// Combines an AUF (a plain U-face move, possibly empty) with an algorithm
// meant for display/execution, placing a leading whole-cube rotation on
// `alg` *before* the AUF rather than after it: a y-axis rotation (y/y'/y2)
// always commutes with a U-axis move (verified — y-axis rotations don't
// change which physical layer is U/D), so "auf y ..." and "y auf ..." are
// the exact same operation, just differently ordered. The latter reads far
// more naturally — a solver does the regrip/rotation first, then the AUF,
// rather than turning U and only then re-gripping through what they just
// turned. An x/z-axis leading rotation doesn't commute with a U move in
// general, so it's left in place (auf still goes in front) rather than
// risk reordering into a different operation.
export function attachAuf(auf: string, alg: string): string {
  if (!auf) return simplifyAlg(alg);
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0];
  if (first && isYAxisRotationToken(first)) {
    return simplifyAlg([first, auf, ...tokens.slice(1)].join(' '));
  }
  return simplifyAlg(`${auf} ${alg}`);
}

// Strips a trailing whole-cube rotation. Always safe regardless of axis or
// what precedes it: it's the literal last move of the sequence, so dropping
// it only changes the final viewing orientation, never the solved-ness (up
// to rotation) of what comes before it.
export function stripTrailingRotation(alg: string): string {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last || !isRotationToken(last)) return alg;
  return tokens.slice(0, -1).join(' ');
}

// ---------------------------------------------------------------------------
// Move-set restriction (Trainer scrambles) — restrictToFaces/eliminateWideMoves
// ---------------------------------------------------------------------------
// Rewrites a *scramble* (a terminal sequence — meant to be executed as-is,
// nothing computed from it further) so it only uses a target set of
// outer-layer faces (2x2 restricted to R/U/F) or has its wide moves
// eliminated (3x3), by substituting each disallowed move with an allowed
// one on the same axis plus a compensating whole-cube rotation, then
// pushing that rotation rightward through the rest of the scramble
// (relabeling every later move it passes, so nothing is silently left
// inconsistent) instead of leaving it sitting in the middle of the output.
//
// Only a rotation left pending at the very end — after every token has been
// processed, with nothing left to relabel — gets dropped, since it's then
// the literal last move of a sequence meant to be executed as terminal
// instructions: dropping it only changes the final viewing angle, not the
// case being scrambled. Dropping a *leading* rotation without relabeling
// everything after it is NOT generally safe (verified — it's a materially
// different case), which is exactly why this only ever discards pending
// rotation content once nothing remains for it to interact with, never
// partway through. All of the relabeling/substitution facts below were
// verified empirically against cubing.js rather than hand-derived, since a
// handedness/sign mistake here would silently corrupt every scramble.

// relabel(face, rotation) = the face a plain quarter-turn of `face` becomes
// once a *later* move needs to be pushed in front of `rotation` instead of
// after it, i.e. `rotation face = relabel(face,rotation) rotation`.
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

// Substitutes a disallowed outer-face turn for an allowed one on the same
// axis, plus the rotation needed to compensate (e.g. L2 = R2 x2, verified),
// keyed by the disallowed face+magnitude ("L", "L'", "L2", ...).
const FACE_SUBSTITUTE: Record<string, [face: string, rotation: string]> = {
  L: ['R', "x'"], "L'": ["R'", 'x'], L2: ['R2', 'x2'],
  D: ['U', "y'"], "D'": ["U'", 'y'], D2: ['U2', 'y2'],
  B: ['F', "z'"], "B'": ["F'", 'z'], B2: ['F2', 'z2'],
};

// Wide-move elimination (Rw/r etc. -> the opposite outer face + rotation,
// e.g. r = L x, verified). "Xw" and lowercase "x" (e.g. "Rw"/"r") are the
// same move; both funnel through this table once normalized to lowercase.
const WIDE_SUBSTITUTE: Record<string, [face: string, rotation: string]> = {
  r: ['L', 'x'], "r'": ["L'", "x'"], r2: ['L2', 'x2'],
  l: ['R', "x'"], "l'": ["R'", 'x'], l2: ['R2', 'x2'],
  u: ['D', 'y'], "u'": ["D'", "y'"], u2: ['D2', 'y2'],
  d: ['U', "y'"], "d'": ["U'", 'y'], d2: ['U2', 'y2'],
  f: ['B', 'z'], "f'": ["B'", "z'"], f2: ['B2', 'z2'],
  b: ['F', "z'"], "b'": ["F'", 'z'], b2: ['F2', 'z2'],
};

// Relabels a face letter through a run of pending rotation tokens, applying
// the most-recently-pending rotation first (equivalent to pushing that
// whole run rightward past the move, one rotation at a time).
function relabelThroughPending(face: string, pending: string[]): string {
  let f = face;
  for (let i = pending.length - 1; i >= 0; i--) f = FACE_RELABEL[pending[i]][f];
  return f;
}

// Slice moves (M/E/S) relabel differently from outer faces: conjugating one
// by a rotation can flip its sign as well as change its letter (e.g.
// `y2 M = M' y2`, verified — unlike an outer face, which only ever changes
// which letter it is, never its sign). [newLetter, signFlips].
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
  return mag; // '2' is its own inverse
}
// Same idea as relabelThroughPending, but for a slice move's (letter,
// magnitude) pair, since a sign flip can accumulate across multiple pending
// rotations.
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

// Shared core of restrictToFaces: also returns the leftover `pending`
// rotation content, since callers that need to know whether dropping it was
// actually *safe* (see cleanAlgForDisplay below) can't tell from the output
// string alone.
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
      // Unrecognized token (malformed data, etc.) — leave it as-is rather
      // than risk mangling something this function doesn't understand.
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
    // The compensating rotation is inserted right where the substitution
    // happened — i.e. *before* whatever was already pending (that content
    // came from earlier in the stream and still needs to end up after this
    // one), so it's prepended, not appended.
    pending.unshift(rot);
  }
  return { output, pending };
}

// Restricts a scramble to only use moves on `allowedFaces` (a subset of
// R/U/D/L/F/B) — used to keep 2x2 Trainer scrambles to R/U/F. See file
// header for why this must run on the final scramble text, not an
// algorithm that's still going to be inverted afterward.
export function restrictToFaces(alg: string, allowedFaces: Set<string>): string {
  const { output } = restrictToFacesCore(alg, allowedFaces);
  return simplifyAlg(output.join(' '));
}

// Shared core of eliminateWideMoves — see restrictToFacesCore.
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
      // Plain face turn, slice move, or unrecognized token — none of these
      // get eliminated, but still need relabeling through any pending
      // rotation (a slice move's meaning changes under a rotation just like
      // any other move's does — skipping this was a real bug, caught by
      // exhaustive verification: an M/E/S appearing after an earlier
      // substitution had accumulated a pending rotation was silently left
      // un-relabeled, producing a scramble for the wrong case).
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
    // See restrictToFaces — the compensation is prepended, not appended.
    pending.unshift(rot);
  }
  return { output, pending };
}

// Eliminates wide moves (Rw/r, Fw/f, ...) from a scramble, replacing each
// with the opposite outer-layer face plus a compensating rotation pushed
// through the rest of the scramble the same way restrictToFaces does.
// Slice moves (M/E/S) aren't reducible to a single outer-layer turn the way
// a wide move is, so they're never substituted away — but they still get
// relabeled through any pending rotation, same as everything else.
export function eliminateWideMoves(alg: string): string {
  const { output } = eliminateWideMovesCore(alg);
  return simplifyAlg(output.join(' '));
}

// Cleans up an algorithm meant to be *displayed and executed directly*
// (a Trainer solution, or a Library case's diagram-setup source) rather
// than inverted into a scramble — e.g. resolves "x R2 D2 R U R' D2 R U' R x'"
// (a real, standard A-perm written with a grip-changing x rotation) down to
// the equivalent pure-outer-face "R2 B2 R F R' B2 R F' R", so it doesn't
// display a confusing mid-algorithm rotation.
//
// Unlike restrictToFaces/eliminateWideMoves (used for scrambles, where ANY
// leftover rotation can be safely dropped because the scramble's own
// resulting pattern — not some other algorithm's ability to solve it — is
// all that's being judged), relabeling a *solution* through a rotation and
// then dropping that rotation only reconstructs the *exact same* operation
// when the rotation fully cancels out (pending ends up empty) — e.g. a
// leading and trailing rotation on the same axis, like the A-perm example.
// A single *uncancelled* leading rotation looks harmless by the same
// "keeps U mapped to U" test, but relabeling-and-dropping it actually
// produces alg · rotation⁻¹ as an operation — a genuinely different
// algorithm, verified to solve a different (if related) state — so this
// only cleans up when pending is fully empty, and returns the alg
// completely unchanged otherwise rather than silently displaying something
// that doesn't actually solve the scrambled case shown.
//
// `pending` accumulates every rotation token encountered (each `x`/`y`/`z`
// hit while scanning gets pushed, regardless of what's between it and any
// later one) — it is never merged as it's built, so a genuinely cancelling
// pair like the A-perm's leading `x` ... trailing `x'` still leaves two
// entries in the raw array. Checking `pending.length === 0` therefore missed
// exactly the paired-rotation case this function's own doc comment above
// uses as its motivating example — simplifying the joined pending content
// first (adjacent-move cancellation, same as any other alg) is what actually
// detects "fully cancels out".
export function cleanAlgForDisplay(alg: string, puzzle: string): string {
  const is2x2 = puzzle === '2x2x2';
  const { output, pending } = is2x2
    ? restrictToFacesCore(alg, new Set(['U', 'D', 'L', 'R', 'F', 'B']))
    : eliminateWideMovesCore(alg);
  return simplifyAlg(pending.join(' ')) === '' ? simplifyAlg(output.join(' ')) : alg;
}

// Builds an *exactly*-paired {scramble, solution} for a Trainer round from
// the algorithm actually chosen to scramble with (`solvingAlg` — the picked
// alt, or `moves` as a fallback, with AUF already prepended). This is the
// one case where the solution shown must be provably exact (not just "up to
// an allowed rotation" — see VALID_ALTS) because there's no other, distinct
// algorithm to fall back on validating against.
//
// scramble = eliminateWideMoves(invertAlg(solvingAlg)) drops whatever
// rotation content is left "pending" once nothing remains to relabel it
// through (see eliminateWideMoves' doc comment — safe for a scramble, since
// only the resulting *pattern* is judged). But dropping that pending content
// changes *which* operation the scramble text represents: writing raw's
// tokens as scramble ++ pending (pending applied last) means
// solved.applyAlg(scramble) == solved.applyAlg(raw).applyAlg(invertAlg(pending)),
// and since raw == invertAlg(solvingAlg) by construction, solvingAlg *alone*
// is provably NOT the exact inverse of `scramble` whenever pending is
// non-empty — verified directly against cubing.js (a leading "y" in
// solvingAlg reliably ends up as trailing "y'" pending, and applying
// solvingAlg on top of the pending-dropped scramble reaches a conjugate of
// that rotation, not solved).
//
// Solving algebraically for the exact solution X (pending * X == solvingAlg,
// as operations) gives X = pending ++ solvingAlg — i.e. re-prepending the
// exact rotation content the scramble step dropped, *not* inverted, cancels
// it out again (e.g. leading "y" + dropped-pending "y'" -> "y' y ..." ->
// simplifies away entirely). When pending is empty this reduces to
// solvingAlg unchanged, so this subsumes the simple case too.
export function buildTrainerScrambleAndSolution(
  solvingAlg: string,
  puzzle: string,
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

// After x2 in experimentalSetupAlg, the cube is visually flipped:
//   Visual TOP  (yellow face) = D-layer pieces: CORNERS/EDGES indices 4-7, CENTER 5
//   Visual BOT  (white face)  = U-layer pieces: CORNERS/EDGES indices 0-3, CENTER 0
//   Middle edges              = EDGES indices 8-11
// Each piece has 5 facelet slots; facelet 0 is the primary (U/D face).
const F = (a: string, b: string): { facelets: string[] } => ({ facelets: [a, b, b, b, b] });
const REG  = F('regular', 'regular');  // all facelets shown
const DIM  = F('ignored', 'ignored');  // all facelets grayed out
const TOP  = F('regular', 'ignored'); // primary (yellow) shown, sides grayed out

function buildStickeringMask(kind: StickeringKind, puzzle: string): unknown {
  if (kind === 'full' || kind === 'pll') return null;

  if (puzzle === '3x3x3') {
    if (kind === 'oll') {
      // Bottom 2 layers: regular. Top layer: yellow sticker only.
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
    if (kind === 'f2l') {
      // F2L pieces + side centers: regular. Top layer + yellow center: dimmed.
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, DIM,  DIM,  DIM,  DIM,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, DIM,  DIM,  DIM,  DIM] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
    if (kind === 'coll') {
      // Everything regular except side stickers of visual-top edges (indices 4-7).
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, REG,  REG,  REG,  REG] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
  }

  if (puzzle === '2x2x2') {
    if (kind === '2x2-oll') {
      // Bottom layer: regular. Top layer: yellow sticker only.
      return {
        orbits: {
          CORNERS: { pieces: [null, null, null, null, TOP, TOP, TOP, TOP] },
        },
      };
    }
  }

  return null;
}

// Resolves the moves to hand to `experimentalSetupAlg` for a case: starts
// from an authoritative `setup` (from SETUP_ALGS, sourced from SpeedCubeDB
// and verified against our own `moves` at build time — see
// scripts/generate-setup-algs.ts) when the caller has one, since it's real
// data rather than something derived by inverting `alg`; otherwise falls
// back to invertAlg(alg).
//
// Either way, the result is run through cleanAlgForDisplay before use here
// — this is NOT optional even for the authoritative setup, which routinely
// includes a real, grip-changing rotation (e.g. Ab Perm's setup is
// literally "x R' U' R' D2 R U' R' D2 R2 x'", matching how SpeedCubeDB
// itself writes it, and how a solver would actually type it in with a
// regrip). That's completely valid notation for a *person* to execute — the
// leading/trailing x cancels out through their own physical regrip — but
// composed with the `'x2 ' + ...` prefix this function's callers add for
// camera framing, the embedded rotation does NOT cancel the same way for a
// *fixed camera*: verified directly against cubing.js that leaving it
// unresolved renders a case with twisted (not just permuted) corners and
// pieces split across the wrong position groups. cleanAlgForDisplay
// resolves it to the equivalent pure-outer-face form first, which composes
// correctly with the camera-framing prefix.
function resolveSetupMoves(alg: string, puzzle: string, setup?: string): string {
  return cleanAlgForDisplay(setup ?? invertAlg(alg), puzzle);
}

function spawn3D(
  container: HTMLDivElement,
  alg: string,
  size: number,
  lat: number,
  lon: number,
  puzzle = '3x3x3',
  diagramPrefix = '',
  stickering: StickeringKind = 'full',
  setup?: string,
) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!alg) return;
  const el = document.createElement('twisty-player') as TwistyEl;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.setAttribute('background', 'none');
  el.setAttribute('control-panel', 'none');
  el.setAttribute('hint-facelets', 'none');
  el.setAttribute('visualization', 'PG3D');
  el.setAttribute('camera-latitude', String(lat));
  el.setAttribute('camera-longitude', String(lon));
  container.appendChild(el);
  el.puzzle = puzzle;
  el.visualization = 'PG3D';
  el.alg = '';
  el.experimentalSetupAlg = (diagramPrefix ? diagramPrefix + ' ' : '') + 'x2 ' + resolveSetupMoves(alg, puzzle, setup);
  const mask = buildStickeringMask(stickering, puzzle);
  if (mask) el.experimentalStickeringMaskOrbits = mask;
}

export function OllDiagram({ alg, size = 80, setup }: { alg: string; size?: number; setup?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'oll', setup); }, [alg, size, setup]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function PllDiagram({ alg, size = 80, setup }: { alg: string; size?: number; setup?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'pll', setup); }, [alg, size, setup]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function CollDiagram({ alg, size = 80, setup }: { alg: string; size?: number; setup?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'coll', setup); }, [alg, size, setup]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function F2LDiagram({ alg, size = 80 }: { alg: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'f2l'); }, [alg, size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function TwoByTwoDiagram({ alg, size = 80, diagramPrefix = '', stickering = 'full' as StickeringKind }: { alg: string; size?: number; diagramPrefix?: string; stickering?: StickeringKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '2x2x2', diagramPrefix, stickering); }, [alg, size, diagramPrefix, stickering]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function RotatingCaseDiagram({
  alg, size = 280, defaultLat = 30, puzzle = '3x3x3', diagramPrefix = '', stickering = 'full' as StickeringKind, resetSignal = 0, setup,
}: {
  alg: string; size?: number; defaultLat?: number; puzzle?: string; diagramPrefix?: string; stickering?: StickeringKind;
  // Bumping this (e.g. from a "Reset Perspective" button elsewhere on the
  // page) snaps the camera back to its default angle without remounting the
  // twisty-player element.
  resetSignal?: number;
  // Authoritative setup override — see resolveSetupMoves.
  setup?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<TwistyEl | null>(null);
  const lon = useRef(25);
  const lat = useRef(defaultLat);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const snapRaf = useRef<number | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const el = document.createElement('twisty-player') as TwistyEl;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.pointerEvents = 'none';
    el.setAttribute('background', 'none');
    el.setAttribute('control-panel', 'none');
    el.setAttribute('hint-facelets', 'none');
    el.setAttribute('visualization', 'PG3D');
    el.setAttribute('camera-latitude', String(lat.current));
    el.setAttribute('camera-longitude', String(lon.current));
    wrap.appendChild(el);
    elRef.current = el;
    el.puzzle = puzzle;
    el.visualization = 'PG3D';
    el.alg = '';
    el.experimentalSetupAlg = (diagramPrefix ? diagramPrefix + ' ' : '') + 'x2 ' + resolveSetupMoves(alg, puzzle, setup);
    const mask = buildStickeringMask(stickering, puzzle);
    if (mask) el.experimentalStickeringMaskOrbits = mask;

    return () => {
      if (snapRaf.current) cancelAnimationFrame(snapRaf.current);
      wrap.innerHTML = '';
      elRef.current = null;
    };
  }, [alg, size, stickering, setup]);

  // Camera stays wherever the user last dragged it (no idle auto-spin) until
  // this resets it — either on mount, or when the caller bumps resetSignal.
  useEffect(() => {
    if (snapRaf.current) { cancelAnimationFrame(snapRaf.current); snapRaf.current = null; }
    lon.current = 25;
    lat.current = defaultLat;
    elRef.current?.setAttribute('camera-longitude', String(lon.current));
    elRef.current?.setAttribute('camera-latitude', String(lat.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setGrabbing(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (snapRaf.current) { cancelAnimationFrame(snapRaf.current); snapRaf.current = null; }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !elRef.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    lon.current -= dx * 0.5;
    lat.current = Math.max(-89, Math.min(89, lat.current + dy * 0.5));
    elRef.current.setAttribute('camera-longitude', String(lon.current));
    elRef.current.setAttribute('camera-latitude', String(lat.current));
  };

  const onPointerUp = () => {
    dragging.current = false;
    setGrabbing(false);
    const startLat = lat.current;
    const startTime = performance.now();
    const snap = (now: number) => {
      const t = Math.min((now - startTime) / 600, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      lat.current = startLat + (defaultLat - startLat) * eased;
      elRef.current?.setAttribute('camera-latitude', String(lat.current));
      if (t < 1) snapRaf.current = requestAnimationFrame(snap);
      else snapRaf.current = null;
    };
    snapRaf.current = requestAnimationFrame(snap);
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div ref={wrapRef} />
      <div
        style={{ position: 'absolute', inset: 0, cursor: grabbing ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full scramble + solution playback (Reconstruction tab)
// ---------------------------------------------------------------------------

// Minimal shape of cubing.js's AlgIndexer that we rely on for scrubbing —
// see node_modules/cubing/dist/lib/cubing/PuzzleLoader-*.d.ts (`AlgIndexer`).
// Index/timestamp values are plain numbers at runtime (TS-branded upstream).
interface AlgIndexerLike {
  numAnimatedLeaves(): number;
  algDuration(): number;
  indexToMoveStartTimestamp(index: number): number;
  timestampToIndex(timestamp: number): number;
}

// timestampToIndex(indexToMoveStartTimestamp(N)) resolves to N-1 exactly at a
// move's start boundary (that instant is the tail of the previous move), so a
// tiny forward nudge is needed to read back the move we actually landed on.
function currentIndexAt(idx: AlgIndexerLike, timestamp: number): number {
  return idx.timestampToIndex(timestamp + 1);
}
interface TwistyPropLike<T> {
  get(): Promise<T>;
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}
type ReconstructionEl = TwistyEl & {
  tempoScale: number;
  timestamp: number;
  play(): void;
  pause(): void;
  togglePlay(playing?: boolean): void;
  jumpToStart(): void;
  jumpToEnd(): void;
  experimentalGet: { timestamp(): Promise<number> };
  experimentalModel: {
    indexer: TwistyPropLike<AlgIndexerLike>;
    playingInfo: TwistyPropLike<{ playing: boolean }>;
  };
};

export interface ReconstructionHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToMoveIndex: (index: number) => void;
  seekFraction: (fraction: number) => void;
  setTempo: (scale: number) => void;
  rotate: (dLon: number, dLat: number) => void;
}

export interface ReconstructionProgress {
  index: number;
  total: number;
  playing: boolean;
  fraction: number;
}

export const ReconstructionPlayer = forwardRef<
  ReconstructionHandle,
  {
    scramble: string;
    solution: string;
    puzzle?: string;
    size?: number;
    onProgress?: (p: ReconstructionProgress) => void;
  }
>(function ReconstructionPlayer({ scramble, solution, puzzle = '3x3x3', size = 320, onProgress }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<ReconstructionEl | null>(null);
  const indexerRef = useRef<AlgIndexerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  // The move index we last navigated to (or last polled while playing).
  // Navigation actions read/update this directly instead of re-querying the
  // player's async timestamp getter, so stepping never depends on an await.
  const currentIndexRef = useRef(0);
  const lon = useRef(35);
  const lat = useRef(22);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const el = document.createElement('twisty-player') as ReconstructionEl;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.setAttribute('background', 'none');
    el.setAttribute('control-panel', 'none');
    el.setAttribute('visualization', 'PG3D');
    el.setAttribute('camera-latitude', String(lat.current));
    el.setAttribute('camera-longitude', String(lon.current));
    wrap.appendChild(el);
    elRef.current = el;
    el.puzzle = puzzle;
    el.visualization = 'PG3D';
    el.experimentalSetupAlg = scramble;
    el.alg = solution;

    indexerRef.current = null;
    playingRef.current = false;
    currentIndexRef.current = 0;
    el.experimentalModel.indexer.get().then((idx) => {
      indexerRef.current = idx;
      onProgress?.({ index: 0, total: idx.numAnimatedLeaves(), playing: false, fraction: 0 });
    });
    const onPlaying = (info: { playing: boolean }) => {
      playingRef.current = info.playing;
    };
    el.experimentalModel.playingInfo.addFreshListener(onPlaying);

    // Only poll the player's async timestamp getter while it's actually
    // animating. While paused, cubing.js has no reason to re-derive that prop
    // (nothing is driving its internal frame loop), so an in-flight await here
    // can sit unresolved indefinitely — which would otherwise wedge this whole
    // recursive rAF chain permanently, freezing the UI. Every explicit
    // navigation action (step/seek/jump) reports progress synchronously
    // instead, so paused-state accuracy never depends on this loop.
    const tick = async () => {
      if (playingRef.current && onProgress) {
        const idx = indexerRef.current;
        if (idx) {
          try {
            const ts = await el.experimentalGet.timestamp();
            const total = idx.numAnimatedLeaves();
            const duration = idx.algDuration();
            const index = Math.min(total, Math.max(0, currentIndexAt(idx, ts)));
            const fraction = duration > 0 ? Math.min(1, Math.max(0, ts / duration)) : 0;
            currentIndexRef.current = index;
            onProgress({ index, total, playing: playingRef.current, fraction });
          } catch {
            /* element may be mid-teardown */
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.experimentalModel.playingInfo.removeFreshListener(onPlaying);
      wrap.innerHTML = '';
      elRef.current = null;
      indexerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, solution, puzzle, size]);

  useImperativeHandle(
    ref,
    (): ReconstructionHandle => ({
      play: () => elRef.current?.play(),
      pause: () => elRef.current?.pause(),
      togglePlay: () => elRef.current?.togglePlay(),
      jumpToStart: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        el.jumpToStart();
        currentIndexRef.current = 0;
        onProgress?.({ index: 0, total: idx.numAnimatedLeaves(), playing: false, fraction: 0 });
      },
      jumpToEnd: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        el.jumpToEnd();
        const total = idx.numAnimatedLeaves();
        currentIndexRef.current = total;
        onProgress?.({ index: total, total, playing: false, fraction: 1 });
      },
      setTempo: (scale) => {
        if (elRef.current) elRef.current.tempoScale = scale;
      },
      // Every navigation action below reads/updates currentIndexRef directly and
      // reports progress synchronously — it never awaits the player's async
      // timestamp getter. That getter is driven by cubing.js's own internal
      // frame loop, which has no reason to resolve promptly (or at all) while
      // paused, and stepping/scrubbing always pauses first (see below).
      stepForward: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = currentIndexRef.current + 1;
        currentIndexRef.current = Math.min(target, total);
        if (target >= total) el.jumpToEnd();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({
          index: currentIndexRef.current,
          total,
          playing: false,
          fraction: total > 0 ? currentIndexRef.current / total : 0,
        });
      },
      stepBackward: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = Math.max(currentIndexRef.current - 1, 0);
        currentIndexRef.current = target;
        if (target <= 0) el.jumpToStart();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({ index: target, total, playing: false, fraction: total > 0 ? target / total : 0 });
      },
      jumpToMoveIndex: (index) => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = Math.max(0, Math.min(index, total));
        currentIndexRef.current = target;
        if (target <= 0) el.jumpToStart();
        else if (target >= total) el.jumpToEnd();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({ index: target, total, playing: false, fraction: total > 0 ? target / total : 0 });
      },
      seekFraction: (fraction) => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const clamped = Math.min(1, Math.max(0, fraction));
        const total = idx.numAnimatedLeaves();
        const target = Math.round(total * clamped);
        currentIndexRef.current = target;
        if (clamped <= 0) el.jumpToStart();
        else if (clamped >= 1) el.jumpToEnd();
        else el.timestamp = idx.algDuration() * clamped;
        onProgress?.({ index: target, total, playing: false, fraction: clamped });
      },
      rotate: (dLon, dLat) => {
        lon.current += dLon;
        lat.current = Math.max(-89, Math.min(89, lat.current + dLat));
        elRef.current?.setAttribute('camera-longitude', String(lon.current));
        elRef.current?.setAttribute('camera-latitude', String(lat.current));
      },
    }),
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setGrabbing(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !elRef.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    lon.current -= dx * 0.5;
    lat.current = Math.max(-89, Math.min(89, lat.current + dy * 0.5));
    elRef.current.setAttribute('camera-longitude', String(lon.current));
    elRef.current.setAttribute('camera-latitude', String(lat.current));
  };
  const onPointerUp = () => {
    dragging.current = false;
    setGrabbing(false);
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div ref={wrapRef} />
      <div
        style={{ position: 'absolute', inset: 0, cursor: grabbing ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
});
