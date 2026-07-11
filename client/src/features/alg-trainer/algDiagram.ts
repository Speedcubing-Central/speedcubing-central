import type { AlgCase, AlgSet } from '../../data/algSets';
import { invertAlg, cleanAlgForDisplay, type StickeringKind } from '../../components/CubeDiagram';
import { SETUP_ALGS } from '../../data/setupAlgs.generated';

// Shared between the trainer session view and the solve-detail/stats modals
// so they resolve puzzle/stickering identically.
export const IS_2x2 = (kind: AlgSet['kind']) => ['2x2-oll', '2x2-pbl', 'cll', 'eg1', 'eg2'].includes(kind);

// The setup to scramble a solved cube into a case, for use as a diagram's
// `experimentalSetupAlg` (see CubeDiagram.tsx's resolveSetupMoves, which
// still needs to clean whatever this returns before combining it with the
// camera-framing prefix). SpeedCubeDB's authoritative text is used when
// available (see setupAlgs.generated.ts); otherwise falls back to inverting
// the case's own default `moves` — deliberately NOT whichever alt a user
// may have set as their preferred algorithm, so switching preferred algs
// never changes what the case's setup looks like.
export function resolveCaseSetup(c: AlgCase): string {
  return SETUP_ALGS[c.id] ?? invertAlg(c.moves);
}

// Same as resolveCaseSetup, but for displaying as text: SpeedCubeDB's own
// wording is shown verbatim (including any grip-changing rotation — see
// resolveSetupMoves' doc comment for why that's fine for a human to read
// but not for the diagram), while the computed fallback is cleaned first so
// there's no stray rotation to explain when there's no authoritative source
// to defer to.
export function resolveCaseSetupText(c: AlgCase, puzzle: string): string {
  return SETUP_ALGS[c.id] ?? cleanAlgForDisplay(invertAlg(c.moves), puzzle);
}

export function twoByTwoStickering(kind: AlgSet['kind']): StickeringKind {
  return kind === '2x2-oll' ? '2x2-oll' : 'full';
}

export function rotatingStickering(kind: AlgSet['kind']): StickeringKind {
  if (kind === 'oll') return 'oll';
  if (kind === 'pll') return 'pll';
  if (kind === 'coll') return 'coll';
  if (kind === 'f2l') return 'f2l';
  if (kind === '2x2-oll') return '2x2-oll';
  return 'full';
}
