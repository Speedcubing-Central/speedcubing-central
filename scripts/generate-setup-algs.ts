// Regenerate client/src/data/setupAlgs.generated.ts after re-scraping any of
// scripts/scdb-raw/*.txt by running, from the repo root:
//
//   node_modules/.bin/esbuild client/src/data/algSets.ts --bundle --format=esm --platform=node --outfile=scripts/_algSets_bundle.generated.mjs
//   node --experimental-strip-types scripts/generate-setup-algs.ts
//
// scripts/scdb-raw/{pll,oll,coll}.txt are plain-text dumps of
// speedcubedb.com's per-set case-listing pages (https://www.speedcubedb.com/a/3x3/PLL
// etc — get_page_text with a generous max_chars, saved verbatim). Those are
// the only three 3x3 sets whose listing page publishes a distinct "setup:"
// algorithm (the moves to apply to a solved cube to reach the case) separate
// from the solving algorithm — F2L's setup is slot-specific (not a single
// fixed case orientation) and the 2x2 sets (Ortega OLL/PBL, CLL, EG-1, EG-2)
// don't publish a setup field on speedcubedb.com at all, so those are left
// out entirely; the app falls back to deriving a setup from `moves` via
// cleanAlgForDisplay for anything not in this generated file.
//
// Every parsed {name, setup} pair is verified here against cubing.js before
// being trusted: applying `setup` to a solved cube, then applying our own
// stored `moves` for that case, must reach a case-appropriately-masked
// solved state (up to a y rotation) — matching the exact case-type masking
// used by scripts/generate-valid-alts.ts. A pair that fails this check is
// NOT included (see the failed list this script prints), rather than risk
// shipping a setup that doesn't actually correspond to our own alg data —
// this caught a real, pre-existing bug where COLL-H2's stored `moves` is
// actually a duplicate of COLL-H4's algorithm (see the script's own output).
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { ALG_SETS } from './_algSets_bundle.generated.mjs';
import * as fs from 'fs';

const RAW_DIR = new URL('./scdb-raw/', import.meta.url);

// SpeedCubeDB writes 180-degree turns with a redundant trailing "'" (e.g.
// "R2'") to track a notion of direction that doesn't apply to a half turn;
// R2' and R2 are the same move, so this just strips the meaningless marker.
function normalize(alg: string): string {
  return alg.replace(/(\w)2'/g, '$1' + '2').trim();
}

function invertAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map((move) => {
    if (move.endsWith("'")) return move.slice(0, -1);
    if (move.endsWith('2')) return move;
    return move + "'";
  }).join(' ');
}

// Parses a speedcubedb.com category-page text dump: repeating blocks shaped
// like "<name>\n3x3\n-\n<SET>\n-\n<group?>\nsetup:\n<setup line>\nStandard Alg:\n...".
function parseBlocks(text: string): { name: string; setup: string }[] {
  const lines = text.split('\n').map((l) => l.trim());
  const results: { name: string; setup: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'setup:') {
      const setup = lines[i + 1];
      const back = lines.slice(Math.max(0, i - 6), i);
      const name = back[0];
      results.push({ name, setup: normalize(setup) });
      i++;
    }
  }
  return results;
}

const IS_2x2 = (kind: string) => ['2x2-oll', '2x2-pbl', 'cll', 'eg1', 'eg2'].includes(kind);
const ORIENTATION_ONLY = new Set(['oll', '2x2-oll']);
const PERMUTATION_ONLY = new Set(['pll']);
const FULL_CORNERS_TOP = new Set(['coll', 'cll', 'eg1', 'eg2']);
const LL = [0, 1, 2, 3];

function caseSolved(pattern: any, kind: string): boolean {
  const pd = pattern.patternData;
  if (ORIENTATION_ONLY.has(kind)) {
    const c = LL.every((i) => pd.CORNERS.orientation[i] === 0);
    const e = pd.EDGES ? LL.every((i) => pd.EDGES.orientation[i] === 0) : true;
    return c && e;
  }
  if (PERMUTATION_ONLY.has(kind)) {
    const c = LL.every((i) => pd.CORNERS.pieces[i] === i);
    const e = pd.EDGES ? LL.every((i) => pd.EDGES.pieces[i] === i) : true;
    return c && e;
  }
  if (FULL_CORNERS_TOP.has(kind)) {
    return LL.every((i) => pd.CORNERS.pieces[i] === i && pd.CORNERS.orientation[i] === 0);
  }
  return true;
}
const yOnly = ['', 'y', "y'", 'y2'];
function matchesAny(pattern: any, kind: string): string | null {
  for (const r of yOnly) {
    const pr = r ? pattern.applyAlg(Alg.fromString(r)) : pattern;
    if (caseSolved(pr, kind)) return r || '(identity)';
  }
  return null;
}

function pllNameToId(name: string): string | null {
  return name; // PLL case names ARE our ids (Aa, Ab, E, F, Ga, ...)
}
function ollNameToId(name: string): string | null {
  const m = name.match(/^OLL (\d+)$/);
  return m ? `OLL${m[1]}` : null;
}
function collNameToId(name: string): string | null {
  const m = name.match(/^(AS|S|L|U|T|Pi|H) (\d+)$/);
  if (!m) return null;
  const letter = m[1] === 'AS' ? 'A' : m[1] === 'Pi' ? 'P' : m[1];
  return `COLL-${letter}${m[2]}`;
}

async function main() {
  const kp3 = await cube3x3x3.kpuzzle();
  const solved3 = kp3.defaultPattern();

  const movesById = new Map<string, { moves: string; kind: string }>();
  for (const set of ALG_SETS) {
    if (IS_2x2(set.kind)) continue;
    for (const c of set.cases) movesById.set(c.id, { moves: c.moves, kind: set.kind });
  }

  const sources: { file: string; toId: (name: string) => string | null }[] = [
    { file: 'pll.txt', toId: pllNameToId },
    { file: 'oll.txt', toId: ollNameToId },
    { file: 'coll.txt', toId: collNameToId },
  ];

  const verified: Record<string, string> = {};
  const failed: { id: string | null; name: string; setup: string; reason: string }[] = [];

  for (const src of sources) {
    const text = fs.readFileSync(new URL(src.file, RAW_DIR), 'utf-8');
    const blocks = parseBlocks(text);
    for (const { name, setup } of blocks) {
      const id = src.toId(name);
      if (!id) { failed.push({ id: null, name, setup, reason: 'no id mapping' }); continue; }
      const entry = movesById.get(id);
      if (!entry) { failed.push({ id, name, setup, reason: 'id not found in our data' }); continue; }
      try {
        const pAfterSetupThenSolve = solved3.applyAlg(Alg.fromString(setup)).applyAlg(Alg.fromString(entry.moves));
        const match = matchesAny(pAfterSetupThenSolve, entry.kind);
        if (match) {
          verified[id] = setup;
        } else {
          failed.push({ id, name, setup, reason: `setup+moves does not reach solved (kind=${entry.kind})` });
        }
      } catch (e: any) {
        failed.push({ id, name, setup, reason: `parse error: ${e.message}` });
      }
    }
  }

  console.error(JSON.stringify({ verifiedCount: Object.keys(verified).length, failedCount: failed.length, failed }, null, 2));

  const commentLines = [
    '// GENERATED FILE — do not edit by hand.',
    '// Regenerate with: see the comment atop scripts/generate-setup-algs.ts',
    '//',
    '// Maps a case id to the exact algorithm SpeedCubeDB (speedcubedb.com)',
    '// publishes as that case\'s "setup" — the moves to apply to a solved cube',
    '// to reach the case — verified here (at generation time) to actually',
    '// pair with our own stored `moves` for that case. Only PLL/OLL/COLL are',
    '// covered; see the header comment in generate-setup-algs.ts for why.',
  ];
  const header = commentLines.join('\n') + '\nexport const SETUP_ALGS: Record<string, string> = '
    + JSON.stringify(verified, null, 2) + ';\n';

  fs.writeFileSync(new URL('../client/src/data/setupAlgs.generated.ts', import.meta.url), header);
  console.error('Wrote client/src/data/setupAlgs.generated.ts');
}

main();
