// Regenerate client/src/data/sq1CO.ts and
// client/src/data/sq1COSetupAlgs.generated.ts after re-scraping
// scripts/scdb-raw/sq1co.txt by running, from the repo root:
//
//   node --experimental-strip-types scripts/generate-sq1-co.ts
//
// scripts/scdb-raw/sq1co.txt is a scrape of speedcubedb.com's Square-1
// "Corner Orientation" listing page (https://speedcubedb.com/a/SQ1/SQ1CO),
// walking the rendered DOM the same way scripts/scdb-raw/sq1cs.txt was
// produced (see generate-sq1-cube-shape.ts's header) — case name, setup,
// then one or more "alg: <moves> votes:<n>" lines per case, terminated by
// a "---" line. This set has no slice-count subgrouping the way Cube Shape
// does, so there's no group field to carry through.
//
// SpeedCubeDB writes Square-1 moves/setups in a compact "x,y / x,y / ..."
// notation (slash-separated twists, no parens). cubing.js's Alg.fromString
// wants each twist wrapped in parens instead, e.g. "(x,y) / (x,y) /", which
// also happens to be the exact format this app's own SQ1 scrambles are
// already displayed in (see sq1Pairs in client/src/lib/scramble.ts), so
// converted+re-serialized (via Alg#toString) moves are used as this app's
// canonical `moves` string for every case, not SpeedCubeDB's raw notation.
//
// Verification here is necessarily different from generate-sq1-cube-shape.ts's
// shape-only check: a Corner Orientation case's setup only ever disturbs
// corner orientation (never permutation, never edges), so a correct CO
// algorithm must return the puzzle to the EXACT fully-solved state, not
// merely restore the physical shape. So this script compares the resulting
// pattern's patternData to the solved pattern's patternData directly
// (JSON.stringify equality), verified empirically to hold true for real
// CO setup+algorithm pairs.
//
// A case's algorithm options are tried highest-voted first (same as
// generate-sq1-cube-shape.ts) — but vote count is NOT a reliable proxy for
// correctness, confirmed empirically here too: CO's own "Opp / Adj" case
// has its top-voted algorithm (1 vote) fail to verify while its only
// alternative (0 votes) does verify, so every option is still checked
// regardless of vote count, and votes only break ties among ones that
// actually pass. The first (highest-voted) one that verifies becomes that
// case's canonical `moves`, any other *verified* options become `alts`,
// and any option that fails to verify is dropped (reported in the failed
// list this script prints). If every scraped option fails to verify, this
// script falls back
// to the exact inverse of the setup: setup followed by its own inverse is
// mathematically guaranteed to return to solved, so this always verifies
// (checked below anyway, defensively, rather than assumed). A case with
// zero verifying options (including the fallback) is dropped entirely.
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import * as fs from 'fs';

const RAW_FILE = new URL('./scdb-raw/sq1co.txt', import.meta.url);

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
  return 'sq1-co-' + name
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
  setup: string;
  algs: ParsedAlg[];
}

function parseBlocks(text: string): ParsedCase[] {
  const blocks = text.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const cases: ParsedCase[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const name = lines[0].trim();
    const setupIdx = lines.indexOf('setup:');
    const setup = lines[setupIdx + 1] ?? '';
    const algs: ParsedAlg[] = [];
    for (const line of lines.slice(setupIdx + 2)) {
      const m = line.match(/^alg:\s*(.*)\s+votes:(-?\d+)$/);
      if (!m) continue;
      algs.push({ moves: m[1].trim(), votes: parseInt(m[2], 10) });
    }
    cases.push({ name, setup, algs });
  }
  return cases;
}

async function main() {
  const loader = puzzles['square1'];
  const kp = await loader.kpuzzle();
  const solved = kp.defaultPattern();

  const text = fs.readFileSync(RAW_FILE, 'utf-8');
  const parsed = parseBlocks(text);

  const setupAlgs: Record<string, string> = {};
  const outCases: { id: string; name: string; group: string; moves: string; alts?: string[] }[] = [];
  const failed: { name: string; reason: string; moves?: string }[] = [];
  const usedSetupInverseFor: string[] = [];
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
    for (const { moves } of sorted) {
      try {
        const movesAlg = Alg.fromString(toCubingNotation(moves));
        const after = afterSetup.applyAlg(movesAlg);
        if (JSON.stringify(after.patternData) === JSON.stringify(solved.patternData)) {
          verified.push(movesAlg.toString());
        } else {
          failed.push({ name: c.name, reason: 'setup+moves does not reach solved state', moves });
        }
      } catch (e: any) {
        failed.push({ name: c.name, reason: `moves parse error: ${e.message}`, moves });
      }
    }

    // If none of the scraped algorithm options verify, fall back to the
    // exact inverse of the setup: setup followed by its own inverse is
    // mathematically guaranteed to return to solved, so this always
    // verifies (checked below anyway, defensively, rather than assumed).
    if (verified.length === 0) {
      const inverseAlg = setupAlg.invert();
      const after = afterSetup.applyAlg(inverseAlg);
      if (JSON.stringify(after.patternData) === JSON.stringify(solved.patternData)) {
        verified.push(inverseAlg.toString());
        usedSetupInverseFor.push(c.name);
      }
    }

    if (verified.length === 0) {
      failed.push({ name: c.name, reason: 'no verifying algorithm option (including setup-inverse fallback)' });
      continue;
    }

    let id = slugify(c.name);
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(c.name)}-${n}`;
    usedIds.add(id);
    outCases.push({
      id,
      name: c.name,
      group: '',
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
    failed,
  }, null, 2));

  const setHeader = [
    '// GENERATED FILE from scripts/scdb-raw/sq1co.txt, do not edit by hand.',
    '// Regenerate with: node --experimental-strip-types scripts/generate-sq1-co.ts',
    "import type { AlgSet } from './algTypes';",
    '',
    'export const SQ1_CO_SET: AlgSet = {',
    "  id: 'SQ1CO',",
    "  name: 'CO',",
    "  kind: 'sq1-co',",
    "  description: 'Corner Orientation',",
    '  cases: ' + JSON.stringify(outCases, null, 2).split('\n').join('\n  ') + ',',
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(new URL('../client/src/data/sq1CO.ts', import.meta.url), setHeader);
  console.error('Wrote client/src/data/sq1CO.ts with', outCases.length, 'cases');

  const setupHeader = [
    '// GENERATED FILE, do not edit by hand.',
    '// Regenerate with: node --experimental-strip-types scripts/generate-sq1-co.ts',
    'export const SQ1_CO_SETUP_ALGS: Record<string, string> = '
      + JSON.stringify(setupAlgs, null, 2) + ';',
    '',
  ].join('\n');
  fs.writeFileSync(new URL('../client/src/data/sq1COSetupAlgs.generated.ts', import.meta.url), setupHeader);
  console.error('Wrote client/src/data/sq1COSetupAlgs.generated.ts');
}

main();
