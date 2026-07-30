import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { cubeSizeForEvent, scrambledCube, type CubeState, type FaceKey } from '../lib/cubeNet';

// The scramble image: an unfolded cube net showing the state the scramble
// produces, so you can check your cube matches before starting.
//
// Layout is the standard cross/T unfolding, the same shape CubeTime and Twisty
// Timer use, which is what makes it readable at a glance:
//
//        U
//     L  F  R  B
//        D
//
// Colors are the standard speedcubing scheme, matching what cubing.js renders on
// the web client so the same scramble looks the same on both platforms: white U,
// yellow D, green F, blue B, red R, orange L.
const STICKER_COLOR: Record<FaceKey, string> = {
  U: '#f8f8f8',
  D: '#ffd500',
  F: '#00a651',
  B: '#0051ba',
  R: '#e02020',
  L: '#ff8c1a',
};

// Column and row of each face in the 4-wide, 3-tall net above.
const FACE_CELL: Record<FaceKey, { col: number; row: number }> = {
  U: { col: 1, row: 0 },
  L: { col: 0, row: 1 },
  F: { col: 1, row: 1 },
  R: { col: 2, row: 1 },
  B: { col: 3, row: 1 },
  D: { col: 1, row: 2 },
};

const NET_COLS = 4;
const NET_ROWS = 3;

export function ScrambleNet({
  eventId,
  scramble,
  size,
  style,
}: {
  eventId: string;
  scramble: string;
  /** Width budget in px. Height follows from the net's 4:3 face grid. */
  size: number;
  style?: React.ComponentProps<typeof Svg>['style'];
}) {
  const n = cubeSizeForEvent(eventId);

  // Recomputed only when the scramble or puzzle actually changes, not on every
  // timer tick. At 7x7 this is 6*49 stickers through a few hundred integer
  // rotations, cheap in absolute terms but pointless to redo 60 times a second.
  const state = useMemo<CubeState | null>(
    () => (n ? scrambledCube(n, scramble) : null),
    [n, scramble],
  );

  // Nothing to draw for puzzles this can't model (megaminx, pyraminx, square-1,
  // clock, ...) or a scramble that didn't parse. Renders as absent rather than as
  // a wrong or half-applied cube, which someone might actually set up from.
  if (!n || !state) return null;

  // Geometry: the net is NET_COLS faces wide, each face n stickers wide, plus a
  // one-sticker gap between faces so the faces read as separate panels.
  const gapStickers = 0.32;
  const unitsWide = NET_COLS * n + (NET_COLS - 1) * gapStickers;
  const unitsTall = NET_ROWS * n + (NET_ROWS - 1) * gapStickers;
  const cell = size / unitsWide;
  const height = cell * unitsTall;
  // Sticker inset, so adjacent stickers read as separate tiles.
  const inset = Math.max(0.5, cell * 0.06);
  const radius = Math.max(0.5, cell * 0.16);

  const tiles: React.ReactElement[] = [];
  for (const face of Object.keys(FACE_CELL) as FaceKey[]) {
    const { col, row } = FACE_CELL[face];
    const originX = col * (n + gapStickers) * cell;
    const originY = row * (n + gapStickers) * cell;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        tiles.push(
          <Rect
            key={`${face}${i}-${j}`}
            x={originX + j * cell + inset}
            y={originY + i * cell + inset}
            width={cell - inset * 2}
            height={cell - inset * 2}
            rx={radius}
            fill={STICKER_COLOR[state.faces[face][i * n + j]]}
          />,
        );
      }
    }
  }

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} style={style}>
      {tiles}
    </Svg>
  );
}

/** Whether a scramble image can be drawn at all, so callers can lay out without a hole. */
export function hasScrambleNet(eventId: string): boolean {
  return cubeSizeForEvent(eventId) !== undefined;
}
