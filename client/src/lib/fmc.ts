// FMC solution verification — given the scramble a solve was attempted
// against and the solver's full move-by-move solution, determines whether
// it actually solves the cube and, if so, how many moves it counts as.
//
// Uses cubing.js's real KPuzzle/Alg simulator (the same dependency already
// used for scrambles and diagrams elsewhere in the app) rather than a
// hand-rolled cube-state/notation parser — WCA notation has enough real
// edge cases (lowercase wide moves, slice moves, cosmetic rotations mid- or
// end-of-solution) that reimplementing it would be a lot of surface area to
// get subtly wrong. Both Alg parsing and KPuzzle move application throw on
// genuinely invalid notation (verified directly: unknown tokens like "Q2"
// or unparseable text both throw cleanly), so this only needs to catch
// those rather than pre-validating with its own regex.
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import type { KPuzzle } from 'cubing/kpuzzle';

// Cached across calls — building the KPuzzle definition isn't free, and
// every FMC attempt on the Timer page needs one.
let kpuzzlePromise: Promise<KPuzzle> | null = null;
function getKPuzzle(): Promise<KPuzzle> {
  if (!kpuzzlePromise) kpuzzlePromise = cube3x3x3.kpuzzle();
  return kpuzzlePromise;
}

// Pure cube rotations (x/y/z, with any modifier) don't count toward an FMC
// move count under WCA regulations — a solver can reorient mid-solution or
// tack on a cosmetic final rotation for free. Move `family` is always
// exactly 'x', 'y', or 'z' for these (never ambiguous with a face-turn
// family, which is always an uppercase face letter or its lowercase/'w'
// wide-move variant) — confirmed directly against cubing.js's Alg parser.
const ROTATION_FAMILIES = new Set(['x', 'y', 'z']);

export interface FmcVerifyResult {
  ok: boolean;
  // Always the real scored-move count when parsing/application succeeded,
  // even if the solution didn't actually solve the cube — so the UI can
  // show "37 moves — doesn't solve the cube" instead of just a bare error.
  // 0 whenever the solution couldn't be parsed/applied at all.
  moveCount: number;
  error?: string;
}

export async function verifyFmcSolution(scramble: string, solutionText: string): Promise<FmcVerifyResult> {
  const trimmed = solutionText.trim();
  if (!trimmed) return { ok: false, moveCount: 0, error: 'Enter your solution' };

  let solutionAlg: Alg;
  try {
    solutionAlg = new Alg(trimmed);
  } catch (e) {
    return { ok: false, moveCount: 0, error: e instanceof Error ? e.message : 'Could not parse that solution' };
  }

  const moveCount = [...solutionAlg.experimentalLeafMoves()].filter((m) => !ROTATION_FAMILIES.has(m.family)).length;
  if (moveCount === 0) return { ok: false, moveCount: 0, error: 'Solution has no scoring moves' };

  const kpuzzle = await getKPuzzle();
  let solved: boolean;
  try {
    const pattern = kpuzzle.defaultPattern().applyAlg(scramble).applyAlg(solutionAlg);
    solved = pattern.experimentalIsSolved({ ignoreCenterOrientation: true, ignorePuzzleOrientation: true });
  } catch (e) {
    return { ok: false, moveCount: 0, error: e instanceof Error ? e.message : 'Invalid move in solution' };
  }

  if (!solved) return { ok: false, moveCount, error: "That solution doesn't solve the cube" };

  // Closes the trivial "just type the scramble backwards" non-solve: that
  // mathematically always solves the cube (every scramble has a unique
  // group inverse), so the solved-check above can't tell it apart from a
  // real solution on its own. This only catches an EXACT structural match
  // against the scramble's own literal inverse (same non-rotation moves, in
  // the same order, same family+amount at every position) — a genuinely
  // different solution someone actually worked out, even one that happens
  // to be the same length, won't match this and is scored normally.
  let scrambleAlg: Alg | null;
  try {
    scrambleAlg = new Alg(scramble);
  } catch {
    scrambleAlg = null; // scrambles are always well-formed (we generate them) — defensive only
  }
  if (scrambleAlg) {
    // A half turn (amount ±2) is its own inverse — there's no "direction" to
    // a 180° turn, so D2 and D2' are the identical physical move. cubing.js's
    // own invert() doesn't normalize this: inverting a freshly-parsed "D2"
    // (amount 2) yields amount -2, even though nothing about the move
    // actually changed (verified directly). Without collapsing the sign
    // here, comparing against a human-typed "D2" (which always parses to
    // +2) would silently never match on any scramble containing a double
    // move — i.e. nearly every real scramble — defeating this whole check.
    // Quarter turns (±1) keep their sign: R and R' are genuinely different.
    const canonicalAmount = (amount: number) => (Math.abs(amount) === 2 ? 2 : amount);
    const leafKey = (m: { family: string; amount: number }) => `${m.family}:${canonicalAmount(m.amount)}`;
    const scrambleInverseMoves = [...scrambleAlg.invert().experimentalLeafMoves()]
      .filter((m) => !ROTATION_FAMILIES.has(m.family))
      .map(leafKey);
    const userMoves = [...solutionAlg.experimentalLeafMoves()]
      .filter((m) => !ROTATION_FAMILIES.has(m.family))
      .map(leafKey);
    const isLiteralInverse =
      scrambleInverseMoves.length === userMoves.length && scrambleInverseMoves.every((k, i) => k === userMoves[i]);
    if (isLiteralInverse) {
      return { ok: false, moveCount, error: 'That solution is just the scramble reversed. Work out your own solution instead.' };
    }
  }

  return { ok: true, moveCount };
}
