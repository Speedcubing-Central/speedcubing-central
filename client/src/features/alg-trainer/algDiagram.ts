import type { AlgSet } from '../../data/algSets';
import type { StickeringKind } from '../../components/CubeDiagram';

// Shared between the trainer session view and the solve-detail/stats modals
// so they resolve puzzle/stickering identically.
export const IS_2x2 = (kind: AlgSet['kind']) => ['2x2-oll', '2x2-pbl', 'cll', 'eg1', 'eg2'].includes(kind);

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
