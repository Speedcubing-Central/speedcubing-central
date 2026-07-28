// GENERATED FILE from scripts/scdb-raw/sq1cs.txt, do not edit by hand.
// Regenerate with: see the comment atop scripts/generate-sq1-cube-shape.ts
import type { AlgSet } from './algTypes';

export const SQ1_CUBE_SHAPE_SET: AlgSet = {
  id: 'SQ1CubeShape',
  name: 'Cube Shape',
  kind: 'sq1-cs',
  description: 'Square-1 Cube Shape, restore a physical cube shape before EO/CO/permutation',
  cases: [
    {
      "id": "sq1-cs-kite-kite",
      "name": "Kite / Kite",
      "group": "1 Slice",
      "moves": "/"
    },
    {
      "id": "sq1-cs-left-fist-right-fist",
      "name": "Left fist / Right fist",
      "group": "2 Slices",
      "moves": "/ (3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-right-fist-left-fist",
      "name": "Right fist / Left fist",
      "group": "2 Slices",
      "moves": "/ (3, 0) /",
      "alts": [
        "/ (-3, 0) /"
      ]
    },
    {
      "id": "sq1-cs-barrel-barrel",
      "name": "Barrel / Barrel",
      "group": "2 Slices",
      "moves": "/ (3, 3) /",
      "alts": [
        "/ (-3, -3) /"
      ]
    },
    {
      "id": "sq1-cs-muffin-square",
      "name": "Muffin / Square",
      "group": "3 Slices",
      "moves": "/ (2, 0) / (3, 0) /"
    },
    {
      "id": "sq1-cs-square-muffin",
      "name": "Square / Muffin",
      "group": "3 Slices",
      "moves": "/ (0, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-shield-square",
      "name": "Shield / Square",
      "group": "3 Slices",
      "moves": "/ (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-square-shield",
      "name": "Square / Shield",
      "group": "3 Slices",
      "moves": "/ (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-paw-left-paw",
      "name": "Right paw / Left paw",
      "group": "3 Slices",
      "moves": "/ (-4, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-left-paw-right-paw",
      "name": "Left paw / Right paw",
      "group": "3 Slices",
      "moves": "/ (-1, 4) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-muffin-muffin",
      "name": "Muffin / Muffin",
      "group": "3 Slices",
      "moves": "/ (-2, 0) / (3, 3) /"
    },
    {
      "id": "sq1-cs-shield-shield",
      "name": "Shield / Shield",
      "group": "3 Slices",
      "moves": "/ (1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-scallop-scallop",
      "name": "Scallop / Scallop",
      "group": "3 Slices",
      "moves": "/ (1, 2) / (-3, -3) /",
      "alts": [
        "/ (-2, -1) / (3, 3) /"
      ]
    },
    {
      "id": "sq1-cs-barrel-kite",
      "name": "Barrel / Kite",
      "group": "3 Slices",
      "moves": "/ (-3, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-barrel",
      "name": "Kite / Barrel",
      "group": "3 Slices",
      "moves": "/ (0, 3) / (0, 3) /"
    },
    {
      "id": "sq1-cs-scallop-kite",
      "name": "Scallop / Kite",
      "group": "3 Slices",
      "moves": "/ (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-scallop",
      "name": "Kite / Scallop",
      "group": "3 Slices",
      "moves": "/ (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-star-6-2",
      "name": "Star / 6-2",
      "group": "4 Slices",
      "moves": "/ (2, 4) / (-4, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-6-2-star",
      "name": "6-2 / Star",
      "group": "4 Slices",
      "moves": "/ (-4, -2) / (-1, 4) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-star-8",
      "name": "Star / 8",
      "group": "4 Slices",
      "moves": "/ (-4, -2) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-8-star",
      "name": "8 / Star",
      "group": "4 Slices",
      "moves": "/ (2, 4) / (-2, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-star-4-4",
      "name": "Star / 4-4",
      "group": "4 Slices",
      "moves": "/ (-2, -2) / (1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-4-4-star",
      "name": "4-4 / Star",
      "group": "4 Slices",
      "moves": "/ (2, 2) / (0, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-left-4-2-parallel-edges",
      "name": "Left 4-2 / Parallel Edges",
      "group": "4 Slices",
      "moves": "/ (2, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-parallel-edges-left-4-2",
      "name": "Parallel Edges / Left 4-2",
      "group": "4 Slices",
      "moves": "/ (3, 2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-right-4-2-parallel-edges",
      "name": "Right 4-2 / Parallel Edges",
      "group": "4 Slices",
      "moves": "/ (-2, -3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-parallel-edges-right-4-2",
      "name": "Parallel Edges / Right 4-2 ",
      "group": "4 Slices",
      "moves": "/ (4, 0) / (2, -3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-5-1-perpendicular-edges",
      "name": "Right 5-1 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (0, -4) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-right-5-1",
      "name": "Perpendicular Edges / Right 5-1",
      "group": "4 Slices",
      "moves": "/ (-4, 0) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-5-1-perpendicular-edges",
      "name": "Left 5-1 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (0, 4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-perpendicular-edges-left-5-1",
      "name": "Perpendicular Edges / Left 5-1",
      "group": "4 Slices",
      "moves": "/ (4, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-4-1-1-perpendicular-edges",
      "name": "4-1-1 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-4-1-1",
      "name": "Perpendicular Edges / 4-1-1",
      "group": "4 Slices",
      "moves": "/ (0, -2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-3-2-1-perpendicular-edges",
      "name": "3-2-1 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (0, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-3-2-1",
      "name": "Perpendicular Edges / 3-2-1",
      "group": "4 Slices",
      "moves": "/ (2, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-3-1-2-perpendicular-edges",
      "name": "3-1-2 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (-1, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-3-1-2",
      "name": "Perpendicular Edges / 3-1-2",
      "group": "4 Slices",
      "moves": "/ (2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-3-3-perpendicular-edges",
      "name": "3-3 / Perpendicular Edges",
      "group": "4 Slices",
      "moves": "/ (0, -2) / (-1, 4) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-3-3",
      "name": "Perpendicular Edges / 3-3",
      "group": "4 Slices",
      "moves": "/ (-2, 0) / (-5, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-right-5-1-pair",
      "name": "Right 5-1 / Pair",
      "group": "4 Slices",
      "moves": "/ (3, -2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-pair-right-5-1",
      "name": "Pair / Right 5-1",
      "group": "4 Slices",
      "moves": "/ (-2, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-5-1-pair",
      "name": "Left 5-1 / Pair",
      "group": "4 Slices",
      "moves": "/ (-3, 2) / (-2, -1) / (0, -3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-pair-left-5-1",
      "name": "Pair / Left 5-1",
      "group": "4 Slices",
      "moves": "/ (-2, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-4-1-1-pair",
      "name": "4-1-1 / Pair",
      "group": "4 Slices",
      "moves": "/ (0, 4) / (4, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-pair-4-1-1",
      "name": "Pair / 4-1-1",
      "group": "4 Slices",
      "moves": "/ (-4, 0) / (4, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-2-2-2-pair",
      "name": "2-2-2 / Pair",
      "group": "4 Slices",
      "moves": "/ (-2, 0) / (0, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-pair-2-2-2",
      "name": "Pair / 2-2-2",
      "group": "4 Slices",
      "moves": "/ (0, 2) / (-1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-left-4-2-pair",
      "name": "Left 4-2 / Pair",
      "group": "4 Slices",
      "moves": "/ (2, 0) / (-2, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-pair-left-4-2",
      "name": "Pair / Left 4-2",
      "group": "4 Slices",
      "moves": "/ (0, 2) / (2, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-right-4-2-pair",
      "name": "Right 4-2 / Pair",
      "group": "4 Slices",
      "moves": "/ (0, 4) / (1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-pair-right-4-2",
      "name": "Pair / Right 4-2",
      "group": "4 Slices",
      "moves": "/ (-2, 0) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-6-pair",
      "name": "6 / Pair",
      "group": "4 Slices",
      "moves": "/ (0, 4) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-pair-6",
      "name": "Pair / 6",
      "group": "4 Slices",
      "moves": "/ (-4, 0) / (-2, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-left-paw",
      "name": "Right fist / Left paw",
      "group": "4 Slices",
      "moves": "/ (0, -4) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-left-paw-right-fist",
      "name": "Left paw / Right fist",
      "group": "4 Slices",
      "moves": "/ (4, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-left-fist-right-paw",
      "name": "Left fist / Right paw",
      "group": "4 Slices",
      "moves": "/ (-1, 0) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-paw-left-fist",
      "name": "Right paw / Left fist",
      "group": "4 Slices",
      "moves": "/ (0, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-paw-right-paw",
      "name": "Right paw / Right paw",
      "group": "4 Slices",
      "moves": "/ (-1, 2) / (2, 2) / (0, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-muffin-shield",
      "name": "Muffin / Shield",
      "group": "4 Slices",
      "moves": "/ (3, 0) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-shield-muffin",
      "name": "Shield / Muffin",
      "group": "4 Slices",
      "moves": "/ (0, -3) / (2, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-scallop-barrel",
      "name": "Scallop / Barrel",
      "group": "4 Slices",
      "moves": "/ (4, 0) / (-1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-barrel-scallop",
      "name": "Barrel / Scallop",
      "group": "4 Slices",
      "moves": "/ (0, -4) / (0, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-right-paw-square",
      "name": "Right paw / Square",
      "group": "5 Slices",
      "moves": "(0, -1) / (1, 0) / (-2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-square-right-paw",
      "name": "Square / Right paw",
      "group": "5 Slices",
      "moves": "(1, 0) / (0, -1) / (0, 2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-left-paw-square",
      "name": "Left paw / Square",
      "group": "5 Slices",
      "moves": "/ (2, -3) / (-2, 0) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-square-left-paw",
      "name": "Square / Left paw",
      "group": "5 Slices",
      "moves": "/ (3, -2) / (0, 2) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-scallop-square",
      "name": "Scallop / Square",
      "group": "5 Slices",
      "moves": "/ (2, 0) / (-4, 0) / (1, 2) / (3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-square-scallop",
      "name": "Square / Scallop",
      "group": "5 Slices",
      "moves": "/ (0, -2) / (0, 4) / (-2, -1) / (0, -3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-4-1-1-parallel-edges",
      "name": "4-1-1 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (3, -2) / (0, 4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-parallel-edges-4-1-1",
      "name": "Parallel Edges / 4-1-1",
      "group": "5 Slices",
      "moves": "/ (-2, 3) / (4, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-6-parallel-edges",
      "name": "6 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (3, 2) / (2, 4) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-parallel-edges-6",
      "name": "Parallel Edges / 6",
      "group": "5 Slices",
      "moves": "/ (3, 2) / (2, 4) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-3-2-1-parallel-edges",
      "name": "3-2-1 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (-2, -3) / (4, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-parallel-edges-3-2-1",
      "name": "Parallel Edges / 3-2-1",
      "group": "5 Slices",
      "moves": "/ (4, -1) / (2, 0) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-3-1-2-parallel-edges",
      "name": "3-1-2 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (-4, 1) / (-2, 0) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-parallel-edges-3-1-2",
      "name": "Parallel Edges / 3-1-2",
      "group": "5 Slices",
      "moves": "/ (2, 3) / (0, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-3-3-parallel-edges",
      "name": "3-3 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (-2, 1) / (-2, 0) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-parallel-edges-3-3",
      "name": "Parallel Edges / 3-3",
      "group": "5 Slices",
      "moves": "/ (1, -2) / (0, -2) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-left-5-1-parallel-edges",
      "name": "Left 5-1 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (-3, 0) / (0, -4) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-parallel-edges-left-5-1",
      "name": "Parallel Edges / Left 5-1",
      "group": "5 Slices",
      "moves": "/ (-4, 1) / (0, -4) / (0, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-right-5-1-parallel-edges",
      "name": "Right 5-1 / Parallel Edges",
      "group": "5 Slices",
      "moves": "/ (3, 0) / (0, 4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-parallel-edges-right-5-1",
      "name": "Parallel Edges / Right 5-1",
      "group": "5 Slices",
      "moves": "/ (0, 3) / (4, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-4-2-perpendicular-edges",
      "name": "Right 4-2 / Perpendicular Edges",
      "group": "5 Slices",
      "moves": "/ (-4, 3) / (-3, 2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-right-4-2",
      "name": "Perpendicular Edges / Right 4-2",
      "group": "5 Slices",
      "moves": "/ (-4, 3) / (-3, 2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-right-4-2-perpendicular-edges-2",
      "name": "Right 4-2 / Perpendicular Edges",
      "group": "5 Slices",
      "moves": "/ (-3, 4) / (-2, 3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-left-4-2",
      "name": "Perpendicular Edges / Left 4-2",
      "group": "5 Slices",
      "moves": "/ (0, -3) / (-4, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-6-perpendicular-edges",
      "name": "6 / Perpendicular Edges",
      "group": "5 Slices",
      "moves": "/ (-3, -4) / (-2, 3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-6",
      "name": "Perpendicular Edges / 6",
      "group": "5 Slices",
      "moves": "/ (-3, -2) / (2, -3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-3-2-1-pair",
      "name": "3-2-1 / Pair",
      "group": "5 Slices",
      "moves": "/ (0, 5) / (-3, 2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-pair-3-2-1",
      "name": "Pair / 3-2-1",
      "group": "5 Slices",
      "moves": "/ (-5, 0) / (-2, 3) / (2, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-3-1-2-pair",
      "name": "3-1-2 / Pair",
      "group": "5 Slices",
      "moves": "/ (0, -5) / (-3, 4) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-pair-3-1-2",
      "name": "Pair / 3-1-2",
      "group": "5 Slices",
      "moves": "(0, 2) / (-2, 2) / (0, -4) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-3-3-pair",
      "name": "3-3 / Pair",
      "group": "5 Slices",
      "moves": "/ (0, -2) / (3, 0) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-pair-3-3",
      "name": "Pair / 3-3",
      "group": "5 Slices",
      "moves": "/ (2, 0) / (0, -3) / (2, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-left-paw-left-paw",
      "name": "Left paw / Left paw",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (-2, -2) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-left-fist-left-paw",
      "name": "Left fist / Left paw",
      "group": "5 Slices",
      "moves": "/ (0, 2) / (0, -4) / (5, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-left-paw-left-fist",
      "name": "Left paw / Left fist",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (4, 0) / (2, -5) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-right-paw",
      "name": "Right fist / Right paw",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-paw-right-fist",
      "name": "Right paw / Right fist",
      "group": "5 Slices",
      "moves": "/ (0, 2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-paw-muffin",
      "name": "Right paw / Muffin",
      "group": "5 Slices",
      "moves": "/ (-1, 0) / (2, 0) / (-2, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-muffin-right-paw",
      "name": "Muffin / Right paw",
      "group": "5 Slices",
      "moves": "/ (-1, 0) / (0, 2) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-left-paw-muffin",
      "name": "Left paw / Muffin",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (-2, 0) / (2, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-muffin-left-paw",
      "name": "Muffin / Left paw",
      "group": "5 Slices",
      "moves": "/ (0, -1) / (0, 2) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-left-paw-shield",
      "name": "Left paw / Shield",
      "group": "5 Slices",
      "moves": "/ (0, -1) / (2, -3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-shield-left-paw",
      "name": "Shield / Left paw",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (3, -2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-paw-shield",
      "name": "Right paw / Shield",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (-2, 3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-shield-right-paw",
      "name": "Shield / Right paw",
      "group": "5 Slices",
      "moves": "/ (0, -1) / (-3, 2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-shield",
      "name": "Right fist / Shield",
      "group": "5 Slices",
      "moves": "/ (-1, -2) / (0, 2) / (-5, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-shield-right-fist",
      "name": "Shield / Right fist",
      "group": "5 Slices",
      "moves": "/ (-1, -2) / (0, 2) / (-5, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-fist-shield",
      "name": "Left fist / Shield",
      "group": "5 Slices",
      "moves": "/ (-1, 0) / (0, 2) / (-5, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-shield-left-fist",
      "name": "Shield / Left fist",
      "group": "5 Slices",
      "moves": "/ (0, 1) / (-2, 0) / (-2, 5) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-muffin-scallop",
      "name": "Muffin / Scallop",
      "group": "5 Slices",
      "moves": "/ (0, 2) / (-3, 4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-scallop-muffin",
      "name": "Scallop / Muffin",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (-4, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-fist-scallop",
      "name": "Left fist / Scallop",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (0, -4) / (-1, 4) / (0, -3) /"
    },
    {
      "id": "sq1-cs-scallop-left-fist",
      "name": "Scallop / Left fist",
      "group": "5 Slices",
      "moves": "/ (0, -1) / (4, 0) / (-4, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-right-fist-scallop",
      "name": "Right fist / Scallop",
      "group": "5 Slices",
      "moves": "/ (-1, 0) / (0, 4) / (1, -4) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-scallop-right-fist",
      "name": "Scallop / Right fist",
      "group": "5 Slices",
      "moves": "/ (0, 1) / (-4, 0) / (4, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-paw-scallop",
      "name": "Left paw / Scallop",
      "group": "5 Slices",
      "moves": "/ (3, 2) / (-3, 2) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-scallop-left-paw",
      "name": "Scallop / Left paw",
      "group": "5 Slices",
      "moves": "/ (-2, -3) / (-2, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-right-paw-scallop",
      "name": "Right paw / Scallop",
      "group": "5 Slices",
      "moves": "/ (-3, -2) / (3, -2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-scallop-right-paw",
      "name": "Scallop / Right paw",
      "group": "5 Slices",
      "moves": "/ (2, 3) / (2, -3) / (2, 1) / (3, 0) /"
    },
    {
      "id": "sq1-cs-shield-scallop",
      "name": "Shield / Scallop",
      "group": "5 Slices",
      "moves": "/ (0, 2) / (0, -4) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-scallop-shield",
      "name": "Scallop / Shield",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (4, 0) / (2, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-left-paw-barrel",
      "name": "Left paw / Barrel",
      "group": "5 Slices",
      "moves": "/ (2, -1) / (-4, 3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-barrel-left-paw",
      "name": "Barrel / Left paw",
      "group": "5 Slices",
      "moves": "/ (1, -2) / (-3, 4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-right-paw-barrel",
      "name": "Right paw / Barrel",
      "group": "5 Slices",
      "moves": "/ (2, -1) / (3, -4) / (1, 2) / (0, 3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-barrel-right-paw",
      "name": "Barrel / Right paw",
      "group": "5 Slices",
      "moves": "/ (1, -2) / (4, -3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-shield-barrel",
      "name": "Shield / Barrel",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (2, 0) / (-1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-barrel-shield",
      "name": "Barrel / Shield",
      "group": "5 Slices",
      "moves": "/ (0, 2) / (0, -2) / (0, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-left-paw-kite",
      "name": "Left paw / Kite",
      "group": "5 Slices",
      "moves": "/ (0, 1) / (2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-left-paw",
      "name": "Kite / Left paw",
      "group": "5 Slices",
      "moves": "/ (1, 0) / (-1, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-shield-kite",
      "name": "Shield / Kite",
      "group": "5 Slices",
      "moves": "/ (0, -2) / (-1, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-kite-shield",
      "name": "Kite / Shield",
      "group": "5 Slices",
      "moves": "/ (-2, 0) / (2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-paw-kite",
      "name": "Right paw / Kite",
      "group": "5 Slices",
      "moves": "/ (0, -1) / (2, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-right-paw",
      "name": "Kite / Right paw",
      "group": "5 Slices",
      "moves": "/ (-1, 0) / (0, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-left-fist-square",
      "name": "Left fist / Square",
      "group": "6 Slices",
      "moves": "/ (-4, 0) / (1, 2) / (-2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-square-left-fist",
      "name": "Square / Left fist",
      "group": "6 Slices",
      "moves": "/ (0, 4) / (-2, -1) / (0, 2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-square",
      "name": "Right fist / Square",
      "group": "6 Slices",
      "moves": "(0, 1) / (4, 0) / (-2, -1) / (2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-square-right-fist",
      "name": "Square / Right fist",
      "group": "6 Slices",
      "moves": "(-1, 0) / (0, -4) / (1, 2) / (0, -2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-barrel-square",
      "name": "Barrel / Square",
      "group": "6 Slices",
      "moves": "/ (2, 2) / (-2, -1) / (2, 2) / (-1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-square-barrel",
      "name": "Square / Barrel",
      "group": "6 Slices",
      "moves": "/ (2, 2) / (-1, 2) / (2, 2) / (0, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-star-7-1",
      "name": "Star / 7-1",
      "group": "6 Slices",
      "moves": "/ (-2, 0) / (-2, -1) / (-3, 2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-7-1-star",
      "name": "7-1 / Star",
      "group": "6 Slices",
      "moves": "(1, 0) / (0, -2) / (-1, -2) / (2, -3) / (-2, -1) / (-3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-star-5-3",
      "name": "Star / 5-3",
      "group": "6 Slices",
      "moves": "(0, 3) / (-4, 0) / (-2, -1) / (-3, 2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-5-3-star",
      "name": "5-3 / Star",
      "group": "6 Slices",
      "moves": "/ (0, 4) / (1, 2) / (-2, 3) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-2-2-2-parallel-edges",
      "name": "2-2-2 / Parallel Edges",
      "group": "6 Slices",
      "moves": "/ (6, -3) / (2, 0) / (2, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-parallel-edges-2-2-2",
      "name": "Parallel Edges / 2-2-2",
      "group": "6 Slices",
      "moves": "/ (0, 3) / (2, 0) / (2, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-2-2-2-perpendicular-edges",
      "name": "2-2-2 / Perpendicular Edges",
      "group": "6 Slices",
      "moves": "/ (-1, 0) / (2, 0) / (0, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-perpendicular-edges-2-2-2",
      "name": "Perpendicular Edges / 2-2-2",
      "group": "6 Slices",
      "moves": "/ (0, -1) / (0, 2) / (2, 1) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-left-fist-left-fist",
      "name": "Left fist / Left fist",
      "group": "6 Slices",
      "moves": "/ (0, -2) / (0, 2) / (0, -2) / (0, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-right-fist",
      "name": "Right fist / Right fist",
      "group": "6 Slices",
      "moves": "/ (2, 0) / (-2, 0) / (2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-right-fist-muffin",
      "name": "Right fist / Muffin",
      "group": "6 Slices",
      "moves": "/ (4, 0) / (-2, -1) / (2, 0) / (-1, 4) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-muffin-right-fist",
      "name": "Muffin / Right fist",
      "group": "6 Slices",
      "moves": "/ (0, -4) / (1, 2) / (0, -2) / (-4, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-left-fist-muffin",
      "name": "Left fist / Muffin",
      "group": "6 Slices",
      "moves": "/ (4, 0) / (0, -1) / (2, 0) / (-1, 4) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-muffin-left-fist",
      "name": "Muffin / Left fist",
      "group": "6 Slices",
      "moves": "/ (0, -4) / (1, 0) / (0, -2) / (-4, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-right-fist-barrel",
      "name": "Right fist / Barrel",
      "group": "6 Slices",
      "moves": "/ (-2, 0) / (-1, 0) / (2, 0) / (1, 2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-barrel-right-fist",
      "name": "Barrel / Right fist",
      "group": "6 Slices",
      "moves": "/ (0, 2) / (0, 1) / (0, -2) / (-2, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-left-fist-barrel",
      "name": "Left fist / Barrel",
      "group": "6 Slices",
      "moves": "/ (2, 0) / (1, 0) / (-2, 0) / (-1, -2) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-barrel-left-fist",
      "name": "Barrel / Left fist",
      "group": "6 Slices",
      "moves": "/ (0, -2) / (0, -1) / (0, 2) / (2, 1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-muffin-barrel",
      "name": "Muffin / Barrel",
      "group": "6 Slices",
      "moves": "/ (2, 3) / (2, 0) / (-2, 0) / (1, 0) / (3, 0) / (-1, 1)"
    },
    {
      "id": "sq1-cs-barrel-muffin",
      "name": "Barrel / Muffin",
      "group": "6 Slices",
      "moves": "/ (-3, -2) / (0, -2) / (0, 2) / (0, -1) / (0, -3) / (-1, 1)"
    },
    {
      "id": "sq1-cs-left-fist-kite",
      "name": "Left fist / Kite",
      "group": "6 Slices",
      "moves": "/ (-2, 0) / (0, -1) / (2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-left-fist",
      "name": "Kite / Left fist",
      "group": "6 Slices",
      "moves": "/ (0, 2) / (1, 0) / (0, -2) / (-1, -2) / (0, -3) /"
    },
    {
      "id": "sq1-cs-right-fist-kite",
      "name": "Right fist / Kite",
      "group": "6 Slices",
      "moves": "/ (-2, 0) / (0, -1) / (2, 0) / (-1, -2) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-kite-right-fist",
      "name": "Kite / Right fist",
      "group": "6 Slices",
      "moves": "/ (0, 2) / (1, 0) / (0, -2) / (2, 1) / (0, 3) /"
    },
    {
      "id": "sq1-cs-muffin-kite",
      "name": "Muffin / Kite",
      "group": "6 Slices",
      "moves": "/ (2, 3) / (-2, 0) / (2, 0) / (-1, 0) / (-3, -3) /"
    },
    {
      "id": "sq1-cs-kite-muffin",
      "name": "Kite / Muffin",
      "group": "6 Slices",
      "moves": "/ (3, 2) / (0, -2) / (0, 2) / (0, -1) / (3, 3) /"
    },
    {
      "id": "sq1-cs-kite-square",
      "name": "Kite / Square",
      "group": "7 Slices",
      "moves": "/ (-1, 0) / (2, 0) / (-2, 0) / (2, 0) / (-1, 0) / (-3, 0) /"
    },
    {
      "id": "sq1-cs-square-kite",
      "name": "Square / Kite",
      "group": "7 Slices",
      "moves": "/ (0, 1) / (0, -2) / (0, 2) / (0, -2) / (0, 1) / (0, 3) /"
    }
  ],
};
