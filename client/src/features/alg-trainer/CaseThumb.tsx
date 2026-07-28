import {
  OllDiagram, PllDiagram, CollDiagram, F2LDiagram, TwoByTwoDiagram, Sq1CaseDiagram,
} from '../../components/CubeDiagram';
import type { AlgCase, AlgSet } from '../../data/algSets';
import { IS_2x2, twoByTwoStickering, resolveCaseSetup } from './algDiagram';

// Small static case thumbnail — used wherever a case needs a quick visual
// reference (stats table rows, solve history) without the personalized
// preferred-alg resolution the live trainer/library views use.
export function CaseThumb({ c, set, size = 48 }: { c: AlgCase; set: AlgSet; size?: number }) {
  const setup = resolveCaseSetup(c);
  if (set.kind === 'sq1-cs') return <Sq1CaseDiagram setup={setup} size={size} />;
  if (set.kind === 'pll') return <PllDiagram alg={c.moves} size={size} setup={setup} />;
  if (set.kind === 'oll') return <OllDiagram alg={c.moves} size={size} setup={setup} />;
  if (set.kind === 'coll') return <CollDiagram alg={c.moves} size={size} setup={setup} />;
  if (IS_2x2(set.kind)) {
    return <TwoByTwoDiagram alg={c.moves} size={size} diagramPrefix={c.diagramPrefix} stickering={twoByTwoStickering(set.kind)} />;
  }
  return <F2LDiagram alg={c.moves} size={size} />;
}
