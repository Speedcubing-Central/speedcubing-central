// Regenerate client/src/data/sq1CubeShape.ts and
// client/src/data/sq1SetupAlgs.generated.ts after re-scraping
// scripts/scdb-raw/sq1cs.txt by running, from the repo root:
//
//   node --experimental-strip-types scripts/generate-sq1-cube-shape.ts
//
// scripts/scdb-raw/sq1cs.txt is a scrape of speedcubedb.com's Square-1
// "Cube Shape" listing page (https://speedcubedb.com/a/SQ1/SQ1CS). Unlike
// pll.txt/oll.txt/coll.txt (plain get_page_text dumps read by
// generate-setup-algs.ts), SQ1 Cube Shape's algorithm options and their
// community vote counts live in DOM nodes that are hidden until a user
// expands them client-side, so this dump was produced by walking the
// rendered DOM directly (see the "Community Votes" `.stats-title` markup
// inside each case's `.row.singlealgorithm`), not by a plain text
// extraction, but it's saved verbatim as a scrape here, same convention.
// Each block is "<name>\nSQ1\n-\nCube Shape\n-\n<subgroup>\nsetup:\n<setup>\n"
// followed by one or more "alg: <moves> votes:<n>" lines, terminated by a
// "---" line.
//
// SpeedCubeDB writes Square-1 moves/setups in a compact "x,y / x,y / ..."
// notation (slash-separated twists, no parens). cubing.js's Alg.fromString
// wants each twist wrapped in parens instead, e.g. "(x,y) / (x,y) /", which
// also happens to be the exact format this app's own SQ1 scrambles are
// already displayed in (see sq1Pairs in client/src/lib/scramble.ts), so
// converted+re-serialized (via Alg#toString) moves are used as this app's
// canonical `moves` string for every case, not SpeedCubeDB's raw notation.
//
// Verification here is necessarily different from generate-setup-algs.ts's
// PLL/OLL/COLL check (which requires reaching a *fully solved* cube, up to
// a y rotation): a "Cube Shape" algorithm only promises to restore the
// physical SHAPE of a cube, not any particular permutation/orientation of
// pieces within it, that's the entire point of this alg set (it's the
// first step of the Square-1 method, done before any EO/CO/permutation
// stage). So instead of comparing the resulting pattern to the solved
// pattern directly, isCubeShape() below checks the same invariant a
// physical Square-1 checks: every corner wedge's two occupied slots are
// still adjacent (i.e. no corner has been sliced in half), every edge
// wedge occupies exactly one slot, and the equator is closed (an odd
// number of total "/" turns leaves the two layers half-turned relative to
// each other, which can't physically close into a cube; this is exactly
// what a nonzero EQUATOR orientation encodes, discovered empirically; see
// the corner/edge slot-grouping derivation this relies on, verified against
// cubing/puzzles' own `square1` KPuzzle definition, not assumed).
//
// A case's algorithm options are tried highest-community-vote-first; the
// first one that verifies becomes that case's canonical `moves`, any other
// *verified* options become `alts`, and any option that fails to verify is
// dropped (reported in the failed list this script prints), same
// don't-ship-what-we-can't-verify philosophy as generate-setup-algs.ts.
// A case with zero verifying options is dropped entirely.
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import * as fs from 'fs';

const RAW_FILE = new URL('./scdb-raw/sq1cs.txt', import.meta.url);

// Converts SpeedCubeDB's "1,-1 / -3,0 /" notation to cubing.js's
// "(1,-1) / (-3,0) /" notation. Each "/"-delimited segment is either blank
// (a bare slice turn) or an "x,y" twist, whitespace around either is
// insignificant and stripped.
function toCubingNotation(raw: string): string {
  const segments = raw.split('/');
  const tokens: string[] = [];
  segments.forEach((seg, i) => {
    const t = seg.trim();
    if (t) tokens.push(`(${t})`);
    if (i < segments.length - 1) tokens.push('/');
  });
  return tokens.join(' ');
}

function slugify(name: string): string {
  return 'sq1-cs-' + name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ParsedAlg {
  moves: string;
  votes: number;
}
interface ParsedCase {
  name: string;
  subgroup: string;
  setup: string;
  algs: ParsedAlg[];
}

function parseBlocks(text: string): ParsedCase[] {
  const blocks = text.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const cases: ParsedCase[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const name = lines[0];
    const subgroup = lines[5];
    const setupIdx = lines.indexOf('setup:');
    const setup = lines[setupIdx + 1] ?? '';
    const algs: ParsedAlg[] = [];
    for (const line of lines.slice(setupIdx + 2)) {
      const m = line.match(/^alg:\s*(.*)\s+votes:(-?\d+)$/);
      if (!m) continue;
      algs.push({ moves: m[1].trim(), votes: parseInt(m[2], 10) });
    }
    cases.push({ name, subgroup, setup, algs });
  }
  return cases;
}

// Every corner wedge occupies WEDGES slots [3k, 3k+1] and every edge wedge
// occupies slot [3k+2], for k = 0..7 across both layers (derived from, and
// confirmed against, how cubing.js's square1 KPuzzle permutes pieces under
// a twist vs. a slice turn; see this script's header comment).
function isCubeShape(pattern: any): boolean {
  const pieces: number[] = pattern.patternData.WEDGES.pieces;
  const wedgeOri: number[] = pattern.patternData.WEDGES.orientation;
  if (wedgeOri.some((o) => o !== 0)) return false;
  for (let offset = 0; offset < 24; offset += 3) {
    const a = pieces[offset];
    const b = pieces[offset + 1];
    const e = pieces[offset + 2];
    if (a % 3 !== 0 || b !== a + 1) return false;
    if (e % 3 !== 2) return false;
  }
  const eqOri: number[] = pattern.patternData.EQUATOR.orientation;
  return eqOri.every((o) => o === 0);
}

async function main() {
  const loader = puzzles['square1'];
  const kp = await loader.kpuzzle();
  const solved = kp.defaultPattern();

  const text = fs.readFileSync(RAW_FILE, 'utf-8');
  const parsed = parseBlocks(text).filter((c) => c.subgroup !== 'Solved');

  const setupAlgs: Record<string, string> = {};
  const outCases: { id: string; name: string; group: string; moves: string; alts?: string[] }[] = [];
  const failed: { name: string; reason: string; moves?: string }[] = [];
  const groupCounts: Record<string, number> = {};
  const usedSetupInverseFor: string[] = [];
  // SpeedCubeDB's own listing repeats the name "Right 4-2 / Perpendicular
  // Edges" for two genuinely distinct cases (different setups) rather than
  // the mirror-image name ("Left 4-2 / ...") the pairing pattern used
  // everywhere else would suggest, so a name-derived slug isn't always
  // unique. Rather than silently guessing at the "correct" name, disambiguate
  // mechanically with a numeric suffix on any repeat, keeping the scraped
  // `name` untouched.
  const usedIds = new Set<string>();

  for (const c of parsed) {
    let setupAlg: Alg;
    try {
      setupAlg = Alg.fromString(toCubingNotation(c.setup));
    } catch (e: any) {
      failed.push({ name: c.name, reason: `setup parse error: ${e.message}` });
      continue;
    }
    const afterSetup = solved.applyAlg(setupAlg);

    const sorted = [...c.algs].sort((x, y) => y.votes - x.votes);
    const verified: string[] = [];
    for (const a of sorted) {
      try {
        const movesAlg = Alg.fromString(toCubingNotation(a.moves));
        const after = afterSetup.applyAlg(movesAlg);
        if (isCubeShape(after)) {
          verified.push(movesAlg.toString());
        } else {
          failed.push({ name: c.name, reason: 'setup+moves does not reach cube shape', moves: a.moves });
        }
      } catch (e: any) {
        failed.push({ name: c.name, reason: `moves parse error: ${e.message}`, moves: a.moves });
      }
    }

    // SpeedCubeDB's setup fields are far more reliable than its solving
    // algorithms in practice — for 7 real cases, every listed algorithm
    // option fails to verify (5 of them provably: an odd total slice-turn
    // count across setup+alg, which can never close into a cube, regardless
    // of anything else). Rather than drop those cases, fall back to the
    // exact inverse of the setup: setup followed by its own inverse is
    // mathematically guaranteed to return to solved, so this always
    // verifies (checked below anyway, defensively, rather than assumed).
    if (verified.length === 0) {
      const inverseAlg = setupAlg.invert();
      if (isCubeShape(afterSetup.applyAlg(inverseAlg))) {
        verified.push(inverseAlg.toString());
        usedSetupInverseFor.push(c.name);
      }
    }

    if (verified.length === 0) continue;

    let id = slugify(c.name);
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(c.name)}-${n}`;
    usedIds.add(id);
    groupCounts[c.subgroup] = (groupCounts[c.subgroup] ?? 0) + 1;
    outCases.push({
      id,
      name: c.name,
      group: c.subgroup,
      moves: verified[0],
      ...(verified.length > 1 ? { alts: verified.slice(1) } : {}),
    });
    setupAlgs[id] = setupAlg.toString();
  }

  console.error(JSON.stringify({
    parsedCount: parsed.length,
    verifiedCaseCount: outCases.length,
    failedOptionCount: failed.length,
    usedSetupInverseFor,
    groupCounts,
    failed,
  }, null, 2));

  const setHeader = [
    '// GENERATED FILE from scripts/scdb-raw/sq1cs.txt, do not edit by hand.',
    '// Regenerate with: see the comment atop scripts/generate-sq1-cube-shape.ts',
    "import type { AlgSet } from './algTypes';",
    '',
    'export const SQ1_CUBE_SHAPE_SET: AlgSet = {',
    "  id: 'SQ1CubeShape',",
    "  name: 'Cube Shape',",
    "  kind: 'sq1-cs',",
    "  description: 'Square-1 Cube Shape',",
    '  cases: ' + JSON.stringify(outCases, null, 2).split('\n').join('\n  ') + ',',
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(new URL('../client/src/data/sq1CubeShape.ts', import.meta.url), setHeader);
  console.error('Wrote client/src/data/sq1CubeShape.ts with', outCases.length, 'cases');

  const setupHeader = [
    '// GENERATED FILE, do not edit by hand.',
    '// Regenerate with: see the comment atop scripts/generate-sq1-cube-shape.ts',
    '//',
    '// Maps a sq1-cs case id to the exact setup SpeedCubeDB publishes for it,',
    '// the moves to apply to a solved Square-1 to reach that case, verified',
    '// here (at generation time) to actually pair with that case\'s stored',
    '// `moves` (see generate-sq1-cube-shape.ts\'s header comment for how).',
    'export const SQ1_SETUP_ALGS: Record<string, string> = '
      + JSON.stringify(setupAlgs, null, 2) + ';',
    '',
  ].join('\n');
  fs.writeFileSync(new URL('../client/src/data/sq1SetupAlgs.generated.ts', import.meta.url), setupHeader);
  console.error('Wrote client/src/data/sq1SetupAlgs.generated.ts');
}

main();
