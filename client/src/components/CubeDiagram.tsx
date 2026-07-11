// Last-layer and F2L case diagrams using cubing.js twisty-player.
// Each component takes the algorithm that SOLVES the case; we display the
// inverse (the unsolved state). OLL/PLL/COLL use 2D flat view; F2L uses 3D.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import 'cubing/twisty';

// Legacy types kept so existing data files compile without changes.
export interface OllPattern { u: boolean[]; top: boolean[]; right: boolean[]; bottom: boolean[]; left: boolean[]; }
export interface PllArrow { from: number; to: number; kind?: 'corner' | 'edge'; }

type TwistyEl = HTMLElement & {
  experimentalSetupAlg: string;
  experimentalStickeringMaskOrbits: unknown;
  alg: string;
  puzzle: string;
  visualization: string;
};

export type StickeringKind = 'oll' | 'pll' | 'f2l' | 'coll' | '2x2-oll' | 'full';

export function invertAlg(alg: string): string {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((move) => {
      if (move.endsWith("'")) return move.slice(0, -1);
      if (move.endsWith('2')) return move;
      return move + "'";
    })
    .join(' ');
}

// Net quarter-turns for one move (mod 4): plain = 1, ' = 3 (i.e. -1), 2 = 2.
function quarterTurns(move: string): number {
  if (move.endsWith('2')) return 2;
  if (move.endsWith("'")) return 3;
  return 1;
}
// The face/axis a move acts on, e.g. "U'" -> "U", "Rw2" -> "Rw", "y'" -> "y".
// Two moves only ever combine if this matches exactly, so a rotation (y)
// never gets combined with a face turn (U) even though both are "U-ish".
function faceOf(move: string): string {
  return move.replace(/2$|'$/, '');
}
function moveFromQuarterTurns(face: string, qt: number): string | null {
  const n = ((qt % 4) + 4) % 4;
  if (n === 0) return null; // net identity — cancels out entirely
  if (n === 1) return face;
  if (n === 2) return `${face}2`;
  return `${face}'`;
}

// Combines adjacent same-face moves into their net turn (or drops them
// entirely if they cancel out), e.g. "U' U" -> "" and "U U" -> "U2". Used
// wherever an AUF or setup move gets prepended to an existing algorithm —
// blindly concatenating can otherwise land right next to that algorithm's
// own first move on the same face, producing a redundant pair that's
// mathematically a no-op but visibly confusing (e.g. "U' U R2 ...").
// A simple left-to-right stack pass handles cascading cancellations
// correctly (e.g. "U R R' U'" fully collapses: R/R' cancel, exposing the
// now-adjacent U/U' pair, which then also cancels).
export function simplifyAlg(alg: string): string {
  const stack: string[] = [];
  for (const move of alg.trim().split(/\s+/).filter(Boolean)) {
    const face = faceOf(move);
    const top = stack[stack.length - 1];
    if (top !== undefined && faceOf(top) === face) {
      stack.pop();
      const combined = moveFromQuarterTurns(face, quarterTurns(top) + quarterTurns(move));
      if (combined) stack.push(combined);
    } else {
      stack.push(move);
    }
  }
  return stack.join(' ');
}

function isRotationToken(t: string): boolean {
  return /^[xyz]['2]?$/.test(t);
}
function isYAxisRotationToken(t: string): boolean {
  return /^y['2]?$/.test(t);
}

// Strips a leading whole-cube rotation from `alg` when doing so is provably
// safe (verified empirically via cubing.js simulation, not just by
// eyeballing notation): a y-axis rotation (y/y'/y2) always commutes with a
// U-axis AUF, so it can be pushed past `auf` to the true end of the eventual
// (inverted) scramble, where — like any trailing rotation — it only
// reorients the final result and can be dropped without changing which case
// the scramble represents. An x/z-axis rotation does NOT commute with a
// U-axis AUF (it relabels which physical face U turns into), so stripping
// it is only safe when there's no AUF to conflict with in the first place.
export function stripLeadingRotation(alg: string, auf: string): string {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0];
  if (!first || !isRotationToken(first)) return alg;
  if (isYAxisRotationToken(first) || !auf) return tokens.slice(1).join(' ');
  return alg;
}

// Strips a trailing whole-cube rotation. Always safe regardless of axis or
// what precedes it: it's the literal last move of the sequence, so dropping
// it only changes the final viewing orientation, never the solved-ness (up
// to rotation) of what comes before it.
export function stripTrailingRotation(alg: string): string {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last || !isRotationToken(last)) return alg;
  return tokens.slice(0, -1).join(' ');
}

// After x2 in experimentalSetupAlg, the cube is visually flipped:
//   Visual TOP  (yellow face) = D-layer pieces: CORNERS/EDGES indices 4-7, CENTER 5
//   Visual BOT  (white face)  = U-layer pieces: CORNERS/EDGES indices 0-3, CENTER 0
//   Middle edges              = EDGES indices 8-11
// Each piece has 5 facelet slots; facelet 0 is the primary (U/D face).
const F = (a: string, b: string): { facelets: string[] } => ({ facelets: [a, b, b, b, b] });
const REG  = F('regular', 'regular');  // all facelets shown
const DIM  = F('ignored', 'ignored');  // all facelets grayed out
const TOP  = F('regular', 'ignored'); // primary (yellow) shown, sides grayed out

function buildStickeringMask(kind: StickeringKind, puzzle: string): unknown {
  if (kind === 'full' || kind === 'pll') return null;

  if (puzzle === '3x3x3') {
    if (kind === 'oll') {
      // Bottom 2 layers: regular. Top layer: yellow sticker only.
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
    if (kind === 'f2l') {
      // F2L pieces + side centers: regular. Top layer + yellow center: dimmed.
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, DIM,  DIM,  DIM,  DIM,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, DIM,  DIM,  DIM,  DIM] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
    if (kind === 'coll') {
      // Everything regular except side stickers of visual-top edges (indices 4-7).
      return {
        orbits: {
          EDGES:   { pieces: [null, null, null, null, TOP,  TOP,  TOP,  TOP,  null, null, null, null] },
          CORNERS: { pieces: [null, null, null, null, REG,  REG,  REG,  REG] },
          CENTERS: { pieces: [null, null, null, null, null, null] },
        },
      };
    }
  }

  if (puzzle === '2x2x2') {
    if (kind === '2x2-oll') {
      // Bottom layer: regular. Top layer: yellow sticker only.
      return {
        orbits: {
          CORNERS: { pieces: [null, null, null, null, TOP, TOP, TOP, TOP] },
        },
      };
    }
  }

  return null;
}

function spawn3D(
  container: HTMLDivElement,
  alg: string,
  size: number,
  lat: number,
  lon: number,
  puzzle = '3x3x3',
  diagramPrefix = '',
  stickering: StickeringKind = 'full',
) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!alg) return;
  const el = document.createElement('twisty-player') as TwistyEl;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.setAttribute('background', 'none');
  el.setAttribute('control-panel', 'none');
  el.setAttribute('hint-facelets', 'none');
  el.setAttribute('visualization', 'PG3D');
  el.setAttribute('camera-latitude', String(lat));
  el.setAttribute('camera-longitude', String(lon));
  container.appendChild(el);
  el.puzzle = puzzle;
  el.visualization = 'PG3D';
  el.alg = '';
  el.experimentalSetupAlg = (diagramPrefix ? diagramPrefix + ' ' : '') + 'x2 ' + invertAlg(alg);
  const mask = buildStickeringMask(stickering, puzzle);
  if (mask) el.experimentalStickeringMaskOrbits = mask;
}

export function OllDiagram({ alg, size = 80 }: { alg: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'oll'); }, [alg, size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function PllDiagram({ alg, size = 80 }: { alg: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'pll'); }, [alg, size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function CollDiagram({ alg, size = 80 }: { alg: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'coll'); }, [alg, size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function F2LDiagram({ alg, size = 80 }: { alg: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '3x3x3', '', 'f2l'); }, [alg, size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function TwoByTwoDiagram({ alg, size = 80, diagramPrefix = '', stickering = 'full' as StickeringKind }: { alg: string; size?: number; diagramPrefix?: string; stickering?: StickeringKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) spawn3D(ref.current, alg, size, 72, 25, '2x2x2', diagramPrefix, stickering); }, [alg, size, diagramPrefix, stickering]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}

export function RotatingCaseDiagram({ alg, size = 280, defaultLat = 30, puzzle = '3x3x3', diagramPrefix = '', stickering = 'full' as StickeringKind }: { alg: string; size?: number; defaultLat?: number; puzzle?: string; diagramPrefix?: string; stickering?: StickeringKind }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<TwistyEl | null>(null);
  const lon = useRef(25);
  const lat = useRef(defaultLat);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const rotRaf = useRef<number | null>(null);
  const snapRaf = useRef<number | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const el = document.createElement('twisty-player') as TwistyEl;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.pointerEvents = 'none';
    el.setAttribute('background', 'none');
    el.setAttribute('control-panel', 'none');
    el.setAttribute('hint-facelets', 'none');
    el.setAttribute('visualization', 'PG3D');
    el.setAttribute('camera-latitude', String(lat.current));
    el.setAttribute('camera-longitude', String(lon.current));
    wrap.appendChild(el);
    elRef.current = el;
    el.puzzle = puzzle;
    el.visualization = 'PG3D';
    el.alg = '';
    el.experimentalSetupAlg = (diagramPrefix ? diagramPrefix + ' ' : '') + 'x2 ' + invertAlg(alg);
    const mask = buildStickeringMask(stickering, puzzle);
    if (mask) el.experimentalStickeringMaskOrbits = mask;

    const autoRotate = () => {
      if (!dragging.current) {
        lon.current += 0.25;
        el.setAttribute('camera-longitude', String(lon.current));
      }
      rotRaf.current = requestAnimationFrame(autoRotate);
    };
    rotRaf.current = requestAnimationFrame(autoRotate);

    return () => {
      if (rotRaf.current) cancelAnimationFrame(rotRaf.current);
      if (snapRaf.current) cancelAnimationFrame(snapRaf.current);
      wrap.innerHTML = '';
      elRef.current = null;
    };
  }, [alg, size, stickering]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setGrabbing(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (snapRaf.current) { cancelAnimationFrame(snapRaf.current); snapRaf.current = null; }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !elRef.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    lon.current -= dx * 0.5;
    lat.current = Math.max(-89, Math.min(89, lat.current + dy * 0.5));
    elRef.current.setAttribute('camera-longitude', String(lon.current));
    elRef.current.setAttribute('camera-latitude', String(lat.current));
  };

  const onPointerUp = () => {
    dragging.current = false;
    setGrabbing(false);
    const startLat = lat.current;
    const startTime = performance.now();
    const snap = (now: number) => {
      const t = Math.min((now - startTime) / 600, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      lat.current = startLat + (defaultLat - startLat) * eased;
      elRef.current?.setAttribute('camera-latitude', String(lat.current));
      if (t < 1) snapRaf.current = requestAnimationFrame(snap);
      else snapRaf.current = null;
    };
    snapRaf.current = requestAnimationFrame(snap);
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div ref={wrapRef} />
      <div
        style={{ position: 'absolute', inset: 0, cursor: grabbing ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full scramble + solution playback (Reconstruction tab)
// ---------------------------------------------------------------------------

// Minimal shape of cubing.js's AlgIndexer that we rely on for scrubbing —
// see node_modules/cubing/dist/lib/cubing/PuzzleLoader-*.d.ts (`AlgIndexer`).
// Index/timestamp values are plain numbers at runtime (TS-branded upstream).
interface AlgIndexerLike {
  numAnimatedLeaves(): number;
  algDuration(): number;
  indexToMoveStartTimestamp(index: number): number;
  timestampToIndex(timestamp: number): number;
}

// timestampToIndex(indexToMoveStartTimestamp(N)) resolves to N-1 exactly at a
// move's start boundary (that instant is the tail of the previous move), so a
// tiny forward nudge is needed to read back the move we actually landed on.
function currentIndexAt(idx: AlgIndexerLike, timestamp: number): number {
  return idx.timestampToIndex(timestamp + 1);
}
interface TwistyPropLike<T> {
  get(): Promise<T>;
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}
type ReconstructionEl = TwistyEl & {
  tempoScale: number;
  timestamp: number;
  play(): void;
  pause(): void;
  togglePlay(playing?: boolean): void;
  jumpToStart(): void;
  jumpToEnd(): void;
  experimentalGet: { timestamp(): Promise<number> };
  experimentalModel: {
    indexer: TwistyPropLike<AlgIndexerLike>;
    playingInfo: TwistyPropLike<{ playing: boolean }>;
  };
};

export interface ReconstructionHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToMoveIndex: (index: number) => void;
  seekFraction: (fraction: number) => void;
  setTempo: (scale: number) => void;
  rotate: (dLon: number, dLat: number) => void;
}

export interface ReconstructionProgress {
  index: number;
  total: number;
  playing: boolean;
  fraction: number;
}

export const ReconstructionPlayer = forwardRef<
  ReconstructionHandle,
  {
    scramble: string;
    solution: string;
    puzzle?: string;
    size?: number;
    onProgress?: (p: ReconstructionProgress) => void;
  }
>(function ReconstructionPlayer({ scramble, solution, puzzle = '3x3x3', size = 320, onProgress }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<ReconstructionEl | null>(null);
  const indexerRef = useRef<AlgIndexerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  // The move index we last navigated to (or last polled while playing).
  // Navigation actions read/update this directly instead of re-querying the
  // player's async timestamp getter, so stepping never depends on an await.
  const currentIndexRef = useRef(0);
  const lon = useRef(35);
  const lat = useRef(22);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const el = document.createElement('twisty-player') as ReconstructionEl;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.setAttribute('background', 'none');
    el.setAttribute('control-panel', 'none');
    el.setAttribute('visualization', 'PG3D');
    el.setAttribute('camera-latitude', String(lat.current));
    el.setAttribute('camera-longitude', String(lon.current));
    wrap.appendChild(el);
    elRef.current = el;
    el.puzzle = puzzle;
    el.visualization = 'PG3D';
    el.experimentalSetupAlg = scramble;
    el.alg = solution;

    indexerRef.current = null;
    playingRef.current = false;
    currentIndexRef.current = 0;
    el.experimentalModel.indexer.get().then((idx) => {
      indexerRef.current = idx;
      onProgress?.({ index: 0, total: idx.numAnimatedLeaves(), playing: false, fraction: 0 });
    });
    const onPlaying = (info: { playing: boolean }) => {
      playingRef.current = info.playing;
    };
    el.experimentalModel.playingInfo.addFreshListener(onPlaying);

    // Only poll the player's async timestamp getter while it's actually
    // animating. While paused, cubing.js has no reason to re-derive that prop
    // (nothing is driving its internal frame loop), so an in-flight await here
    // can sit unresolved indefinitely — which would otherwise wedge this whole
    // recursive rAF chain permanently, freezing the UI. Every explicit
    // navigation action (step/seek/jump) reports progress synchronously
    // instead, so paused-state accuracy never depends on this loop.
    const tick = async () => {
      if (playingRef.current && onProgress) {
        const idx = indexerRef.current;
        if (idx) {
          try {
            const ts = await el.experimentalGet.timestamp();
            const total = idx.numAnimatedLeaves();
            const duration = idx.algDuration();
            const index = Math.min(total, Math.max(0, currentIndexAt(idx, ts)));
            const fraction = duration > 0 ? Math.min(1, Math.max(0, ts / duration)) : 0;
            currentIndexRef.current = index;
            onProgress({ index, total, playing: playingRef.current, fraction });
          } catch {
            /* element may be mid-teardown */
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.experimentalModel.playingInfo.removeFreshListener(onPlaying);
      wrap.innerHTML = '';
      elRef.current = null;
      indexerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, solution, puzzle, size]);

  useImperativeHandle(
    ref,
    (): ReconstructionHandle => ({
      play: () => elRef.current?.play(),
      pause: () => elRef.current?.pause(),
      togglePlay: () => elRef.current?.togglePlay(),
      jumpToStart: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        el.jumpToStart();
        currentIndexRef.current = 0;
        onProgress?.({ index: 0, total: idx.numAnimatedLeaves(), playing: false, fraction: 0 });
      },
      jumpToEnd: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        el.jumpToEnd();
        const total = idx.numAnimatedLeaves();
        currentIndexRef.current = total;
        onProgress?.({ index: total, total, playing: false, fraction: 1 });
      },
      setTempo: (scale) => {
        if (elRef.current) elRef.current.tempoScale = scale;
      },
      // Every navigation action below reads/updates currentIndexRef directly and
      // reports progress synchronously — it never awaits the player's async
      // timestamp getter. That getter is driven by cubing.js's own internal
      // frame loop, which has no reason to resolve promptly (or at all) while
      // paused, and stepping/scrubbing always pauses first (see below).
      stepForward: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = currentIndexRef.current + 1;
        currentIndexRef.current = Math.min(target, total);
        if (target >= total) el.jumpToEnd();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({
          index: currentIndexRef.current,
          total,
          playing: false,
          fraction: total > 0 ? currentIndexRef.current / total : 0,
        });
      },
      stepBackward: () => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = Math.max(currentIndexRef.current - 1, 0);
        currentIndexRef.current = target;
        if (target <= 0) el.jumpToStart();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({ index: target, total, playing: false, fraction: total > 0 ? target / total : 0 });
      },
      jumpToMoveIndex: (index) => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const total = idx.numAnimatedLeaves();
        const target = Math.max(0, Math.min(index, total));
        currentIndexRef.current = target;
        if (target <= 0) el.jumpToStart();
        else if (target >= total) el.jumpToEnd();
        else el.timestamp = idx.indexToMoveStartTimestamp(target);
        onProgress?.({ index: target, total, playing: false, fraction: total > 0 ? target / total : 0 });
      },
      seekFraction: (fraction) => {
        const el = elRef.current;
        const idx = indexerRef.current;
        if (!el || !idx) return;
        el.pause();
        const clamped = Math.min(1, Math.max(0, fraction));
        const total = idx.numAnimatedLeaves();
        const target = Math.round(total * clamped);
        currentIndexRef.current = target;
        if (clamped <= 0) el.jumpToStart();
        else if (clamped >= 1) el.jumpToEnd();
        else el.timestamp = idx.algDuration() * clamped;
        onProgress?.({ index: target, total, playing: false, fraction: clamped });
      },
      rotate: (dLon, dLat) => {
        lon.current += dLon;
        lat.current = Math.max(-89, Math.min(89, lat.current + dLat));
        elRef.current?.setAttribute('camera-longitude', String(lon.current));
        elRef.current?.setAttribute('camera-latitude', String(lat.current));
      },
    }),
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setGrabbing(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !elRef.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    lon.current -= dx * 0.5;
    lat.current = Math.max(-89, Math.min(89, lat.current + dy * 0.5));
    elRef.current.setAttribute('camera-longitude', String(lon.current));
    elRef.current.setAttribute('camera-latitude', String(lat.current));
  };
  const onPointerUp = () => {
    dragging.current = false;
    setGrabbing(false);
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div ref={wrapRef} />
      <div
        style={{ position: 'absolute', inset: 0, cursor: grabbing ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
});
