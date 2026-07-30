import { puzzles } from 'cubing/puzzles';

// Scramble images, drawn with cubing.js's own 2D artwork.
//
// The web client renders these with <twisty-player>, a DOM custom element with
// no React Native counterpart, so mobile can't use that path directly. It can,
// however, use everything underneath it: cubing.js ships the artwork
// (puzzles[id].svg()) and the state machine (puzzles[id].kpuzzle()) as DOM-free
// modules, and only the renderer that binds them needs a browser.
//
// That binding turns out to be small. Every puzzle's artwork keys its stickers
// `{ORBIT}-l{piece}-o{orientation}`, which is exactly how a KPattern addresses
// pieces, so drawing a scrambled state is: read each sticker slot's solved
// colour, ask the pattern which piece now sits in that slot, and paint the slot
// with that piece's colour. No geometry, no layout, no DOM.
//
// This replaces a hand-written facelet simulator that could only draw NxN cubes.
// Using cubing.js instead means the images match the web client exactly (same
// artwork, same colours) and every side event is covered: megaminx, pyraminx,
// skewb, square-1, clock, FTO, kilominx and redi cube all have artwork here and
// none could be drawn before.
//
// Deliberately bundled rather than fetched from the server: the Timer has to
// work without a network, and an image that needs WiFi would be the only part of
// it that doesn't. Costs about 0.58MB of bundle, measured, and only
// `cubing/puzzles` is pulled in: `cubing/scramble` is the part carrying WASM and
// workers, and scrambles already come from the server.

/** App event id -> cubing.js puzzle id. Events absent here have no artwork. */
const EVENT_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  // Every 3x3 variant is the same puzzle: one-handed, blindfolded and FMC only
  // change how it's solved, and the practice subsets (LSLL/LL/CLS) scramble a
  // 3x3 too.
  '333': '3x3x3',
  '333oh': '3x3x3',
  '333bf': '3x3x3',
  '333fm': '3x3x3',
  lsll: '3x3x3',
  ll: '3x3x3',
  cls: '3x3x3',
  '444': '4x4x4',
  '444bf': '4x4x4',
  '555': '5x5x5',
  '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
  minx: 'megaminx',
  pyram: 'pyraminx',
  clock: 'clock',
  skewb: 'skewb',
  sq1: 'square1',
  kilominx: 'kilominx',
  fto: 'fto',
  redi_cube: 'redi_cube',
};

/** Whether an image can be drawn at all, so callers can lay out without a hole. */
export function hasScrambleImage(eventId: string): boolean {
  return eventId in EVENT_PUZZLE;
}

// Any element carrying an orbit-keyed id. The element *tag* varies by puzzle
// (<use> for 3x3, <polygon> for megaminx and skewb, <rect> and <polygon> for
// square-1), so this deliberately matches on the id rather than the tag: keying
// off <use> alone silently left ten of the fourteen puzzles drawn solved.
// `data-copy-id` marks hint facelets, the faded second copy of a face, which
// take the same colour as the sticker they copy.
const STICKER_RE = /(<[a-zA-Z]+\b[^>]*?\b(id|data-copy-id)="([A-Za-z0-9_]+)-l(\d+)-o(\d+)"[^>]*?)(\/?>)/g;
const STYLE_FILL_RE = /style="([^"]*?)fill:\s*([^;"]+)([^"]*)"/;
const ATTR_FILL_RE = /\bfill="([^"]+)"/;

function fillOf(tag: string): string | undefined {
  const s = tag.match(STYLE_FILL_RE);
  if (s) return s[2].trim();
  const a = tag.match(ATTR_FILL_RE);
  if (a) return a[1].trim();
  return undefined;
}

function withFill(tag: string, color: string): string {
  if (STYLE_FILL_RE.test(tag)) {
    return tag.replace(STYLE_FILL_RE, (_m, pre: string, _c: string, post: string) => `style="${pre}fill: ${color}${post}"`);
  }
  if (ATTR_FILL_RE.test(tag)) return tag.replace(ATTR_FILL_RE, `fill="${color}"`);
  return `${tag} fill="${color}"`;
}

interface OrbitSpec {
  orbitName: string;
  numOrientations: number;
}

interface LoadedPuzzle {
  svg: string;
  /** Solved-state fill per sticker slot, read out of the artwork itself. */
  solvedFills: Map<string, string>;
  orbits: OrbitSpec[];
  /** width / height, so callers can fit the drawing to a box. */
  aspect: number;
  applyAlg: (alg: string) => Record<string, { pieces: number[]; orientation: number[] }> | null;
}

// Loading a puzzle pulls a dynamic chunk (and, for some, puzzle-geometry), which
// measured at ~700ms for megaminx on device and single-digit ms after that.
// Cached by promise, not by value, so two scrambles arriving together don't both
// pay it.
const cache = new Map<string, Promise<LoadedPuzzle | null>>();

/**
 * The rendered drawing's aspect ratio, from viewBox if present and the width and
 * height attributes otherwise. Needed because each puzzle's artwork has its own
 * proportions, unlike the uniform 4:3 net this replaced.
 */
function readAspect(svg: string): number {
  const vb = svg.match(/viewBox="\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (vb) {
    const w = parseFloat(vb[1]);
    const h = parseFloat(vb[2]);
    if (w > 0 && h > 0) return w / h;
  }
  const w = svg.match(/\bwidth="([\d.]+)/);
  const h = svg.match(/\bheight="([\d.]+)/);
  if (w && h) {
    const wv = parseFloat(w[1]);
    const hv = parseFloat(h[1]);
    if (wv > 0 && hv > 0) return wv / hv;
  }
  return 1;
}

/**
 * react-native-svg's parser wants a bare <svg> root. cubing.js ships some of
 * these with an XML prolog and a DOCTYPE, which it does not accept, and a fixed
 * width/height on the root would override the size we want to draw at. Every
 * puzzle's artwork carries a viewBox, so removing width/height costs nothing and
 * lets the drawing scale to whatever box we give it.
 */
function normalizeRoot(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/(<svg\b[^>]*?)\s+width="[^"]*"/, '$1')
    .replace(/(<svg\b[^>]*?)\s+height="[^"]*"/, '$1')
    .trim();
}

/**
 * Drop the hint facelets: the faded copies of the U-layer stickers that
 * cubing.js draws fanned around the top face, so a 3D-ish view can show sides
 * you'd otherwise not see. On a flat net every one of those stickers is already
 * drawn in its own face, so they're duplicates.
 *
 * Only the 3x3 artwork has them, in a single group with no nested groups, so a
 * non-greedy match to the first closing tag is exact rather than approximate.
 */
function stripHintFacelets(svg: string): string {
  return svg.replace(/<g class="hint-facelet">[\s\S]*?<\/g>/g, '');
}

/**
 * Inline the artwork's CSS into presentation attributes and drop the <style>
 * block.
 *
 * react-native-svg has no CSS engine: it ignores <style> blocks and class
 * selectors entirely. The megaminx, skewb and 4x4 artwork put the sticker
 * outline there (`.sticker { stroke: #000000; stroke-width: 1px }`), so without
 * this the pieces render as adjacent blocks of colour with no lines between
 * them. Its <style> is also wrapped in CDATA, which the same parser handles
 * poorly, and removing it is what stops a face going missing entirely.
 *
 * Only the flat `.class { prop: value; ... }` form cubing.js actually uses is
 * supported; anything more (descendant selectors, media queries) is left alone
 * rather than half-applied.
 */
function inlineStyleBlocks(svg: string): string {
  const rules: { className: string; decls: [string, string][] }[] = [];
  const withoutStyle = svg.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_whole, css: string) => {
    const body = css.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
    for (const m of body.matchAll(/\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g)) {
      const decls: [string, string][] = [];
      for (const d of m[2].split(';')) {
        const [rawProp, ...rest] = d.split(':');
        if (!rawProp || rest.length === 0) continue;
        const prop = rawProp.trim();
        // SVG presentation attributes are unitless; react-native-svg wants a
        // plain number where CSS would happily write "1px".
        const value = rest.join(':').trim().replace(/px$/, '');
        if (prop && value) decls.push([prop, value]);
      }
      if (decls.length) rules.push({ className: m[1], decls });
    }
    return '';
  });

  if (rules.length === 0) return withoutStyle;

  return withoutStyle.replace(/<([a-zA-Z]+)\b([^>]*?)(\/?)>/g, (whole, tag: string, attrs: string, selfClose: string) => {
    const cls = attrs.match(/\bclass="([^"]+)"/);
    if (!cls) return whole;
    const names = cls[1].split(/\s+/);
    let extra = '';
    for (const rule of rules) {
      if (!names.includes(rule.className)) continue;
      for (const [prop, value] of rule.decls) {
        // An attribute already on the element wins, same as an inline style
        // would beat a class rule in CSS.
        if (new RegExp(`\\b${prop}=`).test(attrs)) continue;
        extra += ` ${prop}="${value}"`;
      }
    }
    return extra ? `<${tag}${attrs}${extra}${selfClose}>` : whole;
  });
}

async function load(puzzleId: string): Promise<LoadedPuzzle | null> {
  try {
    const loader = (puzzles as Record<string, { svg: () => Promise<string>; kpuzzle: () => Promise<unknown> }>)[puzzleId];
    if (!loader) return null;
    // Hint facelets go before the fill map is built, so the duplicates never
    // enter it; the CSS is inlined before too, so a stroke that came from a
    // class is carried on the element itself from here on.
    const rawSvg = inlineStyleBlocks(stripHintFacelets(normalizeRoot(String(await loader.svg()))));
    const kpuzzle = (await loader.kpuzzle()) as {
      definition: { orbits: OrbitSpec[] };
      defaultPattern: () => { applyAlg: (a: string) => { patternData: Record<string, { pieces: number[]; orientation: number[] }> } };
    };

    const solvedFills = new Map<string, string>();
    for (const m of rawSvg.matchAll(STICKER_RE)) {
      const [, tag, , orbit, l, o] = m;
      const f = fillOf(tag);
      if (f !== undefined) solvedFills.set(`${orbit}-l${l}-o${o}`, f);
    }

    return {
      svg: rawSvg,
      solvedFills,
      orbits: kpuzzle.definition.orbits,
      aspect: readAspect(rawSvg),
      applyAlg: (alg: string) => {
        try {
          return kpuzzle.defaultPattern().applyAlg(alg).patternData;
        } catch {
          // A scramble in notation this puzzle doesn't accept draws nothing
          // rather than a wrong or half-applied state.
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

function loadCached(puzzleId: string): Promise<LoadedPuzzle | null> {
  let p = cache.get(puzzleId);
  if (!p) {
    p = load(puzzleId);
    cache.set(puzzleId, p);
  }
  return p;
}

export interface ScrambleImage {
  /** SVG source ready for react-native-svg's SvgXml. */
  xml: string;
  /** width / height of the drawing. */
  aspect: number;
}

/**
 * The scramble image for an event, or null when there's no artwork for it or the
 * scramble doesn't parse.
 *
 * The orientation convention below (subtracting the piece's twist) was settled
 * by experiment, not assumption: the two candidates are indistinguishable under
 * a U turn, which doesn't twist corners, and only differ under a turn that does.
 */
export async function renderScrambleImage(eventId: string, scramble: string): Promise<ScrambleImage | null> {
  const puzzleId = EVENT_PUZZLE[eventId];
  if (!puzzleId) return null;
  const loaded = await loadCached(puzzleId);
  if (!loaded) return null;

  const patternData = loaded.applyAlg(scramble);
  if (!patternData) return null;

  const byOrbit: Record<string, OrbitSpec> = {};
  for (const o of loaded.orbits) byOrbit[o.orbitName] = o;

  const xml = loaded.svg.replace(
    STICKER_RE,
    (whole: string, tag: string, _attr: string, orbit: string, lStr: string, oStr: string, close: string) => {
      const spec = byOrbit[orbit];
      const data = patternData[orbit];
      if (!spec || !data) return whole;
      const l = Number(lStr);
      const o = Number(oStr);
      const n = spec.numOrientations;
      const piece = data.pieces[l];
      const twist = data.orientation[l];
      const srcO = (((o - twist) % n) + n) % n;
      const color = loaded.solvedFills.get(`${orbit}-l${piece}-o${srcO}`);
      if (color === undefined) return whole;
      return `${withFill(tag, color)}${close}`;
    },
  );

  return { xml, aspect: loaded.aspect };
}
