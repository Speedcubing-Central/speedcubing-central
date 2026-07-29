// GENERATED FILE from scripts/scdb-raw/sq1cp.txt, do not edit by hand.
// Regenerate with: node --experimental-strip-types scripts/generate-sq1-cp.ts
import type { AlgSet } from './algTypes';

export const SQ1_CP_SET: AlgSet = {
  id: 'SQ1CP',
  name: 'CP',
  kind: 'sq1-co',
  description: 'Corner Permutation',
  cases: [
    {
      "id": "sq1-cp-adj-solved",
      "name": "Adj / Solved",
      "group": "",
      "moves": "/ (3, -3) / (-3, 0) / (0, 3) / (0, -3) / (0, 3) /"
    },
    {
      "id": "sq1-cp-opp-solved",
      "name": "Opp / Solved",
      "group": "",
      "moves": "/ (3, 3) / (-3, 0) / (3, 3) / (-3, 0) / (3, 3) /",
      "alts": [
        "/ (-3, -3) / (3, 0) / (-3, -3) / (3, 0) / (-3, -3) /",
        "/ (3, 3) / (-3, 0) / (3, 3) / (-3, 0) / (3, 3) /"
      ]
    },
    {
      "id": "sq1-cp-solved-adj",
      "name": "Solved / Adj",
      "group": "",
      "moves": "/ (3, -3) / (0, 3) / (-3, 0) / (3, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cp-solved-opp",
      "name": "Solved / Opp",
      "group": "",
      "moves": "/ (3, 3) / (0, 3) / (3, 3) / (0, 3) / (3, 3) /",
      "alts": [
        "/ (-3, -3) / (0, -3) / (-3, -3) / (0, -3) / (-3, -3) /"
      ]
    },
    {
      "id": "sq1-cp-adj-adj",
      "name": "Adj / Adj",
      "group": "",
      "moves": "/ (0, -3) / (3, 3) / (-3, 0) /"
    },
    {
      "id": "sq1-cp-opp-adj",
      "name": "Opp / Adj",
      "group": "",
      "moves": "/ (3, 0) / (-3, 0) / (3, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cp-adj-opp",
      "name": "Adj / Opp",
      "group": "",
      "moves": "/ (0, 3) / (0, -3) / (0, 3) / (0, -3) /"
    },
    {
      "id": "sq1-cp-opp-opp",
      "name": "Opp / Opp",
      "group": "",
      "moves": "/ (3, -3) / (-3, 3) /"
    }
  ],
};
