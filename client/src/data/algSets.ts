import { OLL_SET } from './oll';
import { PLL_SET } from './pll';
import { F2L_SET } from './f2l';
import { COLL_SET } from './coll';
import { ORTEGA_OLL_SET } from './ortegaOll';
import { ORTEGA_PBL_SET } from './ortegaPbl';
import { CLL_SET } from './cll';
import { EG1_SET } from './eg1';
import { EG2_SET } from './eg2';
import { SQ1_CUBE_SHAPE_SET } from './sq1CubeShape';
import { SQ1_CO_SET } from './sq1CO';
import { SQ1_EO_SET } from './sq1EO';
import { SQ1_CP_SET } from './sq1CP';
import { SQ1_EP_SET } from './sq1EP';
import type { AlgSet } from './algTypes';

export const ALG_SETS: AlgSet[] = [
  OLL_SET, PLL_SET, F2L_SET, COLL_SET, ORTEGA_OLL_SET, ORTEGA_PBL_SET, CLL_SET, EG1_SET, EG2_SET,
  SQ1_CUBE_SHAPE_SET, SQ1_CO_SET, SQ1_EO_SET, SQ1_CP_SET, SQ1_EP_SET,
];

export function getSet(id: string): AlgSet | undefined {
  return ALG_SETS.find((s) => s.id === id);
}

// Normalize a WCA-notation algorithm string for comparison in drill mode.
export function normalizeAlg(alg: string): string {
  return alg
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/’/g, "'")
    .trim();
}

export type { AlgSet, AlgCase } from './algTypes';
