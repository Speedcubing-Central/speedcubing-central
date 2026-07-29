// GENERATED FILE from scripts/scdb-raw/sq1co.txt, do not edit by hand.
// Regenerate with: node --experimental-strip-types scripts/generate-sq1-co.ts
import type { AlgSet } from './algTypes';

export const SQ1_CO_SET: AlgSet = {
  id: 'SQ1CO',
  name: 'CO',
  kind: 'sq1-co',
  description: 'Corner Orientation',
  cases: [
    {
      "id": "sq1-co-2-2",
      "name": "2-2",
      "group": "",
      "moves": "(1, 0) / (-1, 0)"
    },
    {
      "id": "sq1-co-3-1",
      "name": "3-1",
      "group": "",
      "moves": "(1, 0) / (3, 0) / (-1, 0)"
    },
    {
      "id": "sq1-co-opp-opp",
      "name": "Opp / Opp",
      "group": "",
      "moves": "(1, 0) / (3, 3) / (-1, 0)"
    },
    {
      "id": "sq1-co-adj-opp",
      "name": "Adj / Opp",
      "group": "",
      "moves": "(1, 0) / (0, 3) / (0, 3) / (-1, 0)"
    },
    {
      "id": "sq1-co-opp-adj",
      "name": "Opp / Adj",
      "group": "",
      "moves": "(1, 0) / (3, 0) / (3, 0) / (-1, 0)"
    },
    {
      "id": "sq1-co-1-3",
      "name": "1-3",
      "group": "",
      "moves": "(1, 0) / (3, 6) / (-1, 0)"
    },
    {
      "id": "sq1-co-0-4",
      "name": "0-4",
      "group": "",
      "moves": "/ (6, 6) / (-1, 1)"
    }
  ],
};
