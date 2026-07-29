// GENERATED FILE from scripts/scdb-raw/sq1eo.txt, do not edit by hand.
// Regenerate with: node --experimental-strip-types scripts/generate-sq1-eo.ts
import type { AlgSet } from './algTypes';

export const SQ1_EO_SET: AlgSet = {
  id: 'SQ1EO',
  name: 'EO',
  kind: 'sq1-co',
  description: 'Edge Orientation',
  cases: [
    {
      "id": "sq1-eo-1-1",
      "name": "1-1",
      "group": "",
      "moves": "(1, 0) / (3, 0) / (3, 0) / (-1, -1) / (-2, 1) / (-3, 0) / (-1, 0)"
    },
    {
      "id": "sq1-eo-i-i",
      "name": "I-I",
      "group": "",
      "moves": "(1, 0) / (-1, -1) / (0, 1)",
      "alts": [
        "(0, -1) / (1, 1) / (-1, 0)"
      ]
    },
    {
      "id": "sq1-eo-l-l",
      "name": "L-L",
      "group": "",
      "moves": "(1, 0) / (-4, -1) / (1, 1) / (3, 0) / (-1, 0)"
    },
    {
      "id": "sq1-eo-l-i",
      "name": "L-I",
      "group": "",
      "moves": "(1, 0) / (3, 0) / (3, 0) / (-1, -1) / (-2, 1) / (-4, -1) / (0, 1)"
    },
    {
      "id": "sq1-eo-3-3",
      "name": "3-3",
      "group": "",
      "moves": "(1, 0) / (3, 0) / (3, 0) / (-1, -1) / (-3, 0) / (-3, 0) / (0, 1)"
    },
    {
      "id": "sq1-eo-4-4",
      "name": "4-4",
      "group": "",
      "moves": "(1, 0) / (-1, -1) / (3, 3) / (1, 1) / (-1, 0)"
    },
    {
      "id": "sq1-eo-i-l",
      "name": "I-L",
      "group": "",
      "moves": "(1, 0) / (-3, 0) / (3, 0) / (-1, -1) / (-3, 0) / (3, 0) / (0, 1)"
    }
  ],
};
