import type { Penalty } from '@scc/shared';

export interface CstimerSolveEntry {
  time: number; // ms
  penalty: Penalty;
  // cstimer's own format has no notion of stacked +2s — a "+2" entry always
  // imports as plusTwoCount: 1 (see the parse loop below).
  plusTwoCount: number;
  scramble: string;
  createdAt: string; // ISO
}

export interface CstimerParsedSession {
  key: string; // "session1"
  name: string;
  scrType: string;
  eventId: string;
  solves: CstimerSolveEntry[];
}

// cstimer scramble-type code -> this app's WCA/unofficial event id. Only
// scramble types that produce full, storable solves are mapped — case-
// drilling types (oll/pll/2gen/easyc/lsll2/wvls/f2l/...) aren't full solves
// and have no equivalent session here, so they're left unmapped and skipped.
//
// cstimer uses distinct scrType codes for OH/BLD, not the plain "333"/
// "444wca"/"555wca" codes their sighted counterparts use (verified against
// cstimer's own src/lang/en-us.js scrdata list) — a previous version of
// this mapping assumed otherwise (that OH/BLD reused the sighted scrType,
// with only the session *name* distinguishing them), which meant a
// well-formed cstimer OH or BLD export had no entry here at all: mapEvent
// returned null, and the caller skips any session with no mapped event —
// the whole session silently vanished from the import rather than merely
// landing in the wrong place.
const SCRTYPE_TO_EVENT: Record<string, string> = {
  '222so': '222',
  '333': '333',
  '333oh': '333oh',
  '333ni': '333bf',
  '444wca': '444',
  '444bld': '444bf',
  '555wca': '555',
  '555bld': '555bf',
  '666wca': '666',
  '777wca': '777',
  clkwca: 'clock',
  pyrso: 'pyram',
  skbso: 'skewb',
  sqrs: 'sq1',
  mgmp: 'minx',
  ftoso: 'fto',
};

// Defensive fallback only, for any export where scrType genuinely is the
// plain "333" but the session is actually OH/BLD (e.g. an older export, or
// a session someone hand-edited) — see SCRTYPE_TO_EVENT's doc comment for
// why this is no longer the primary way OH/BLD get recognized.
function mapEvent(scrType: string, name: string): string | null {
  const base = SCRTYPE_TO_EVENT[scrType];
  if (!base) return null;
  if (base === '333') {
    if (/\bOH\b|one-?handed/i.test(name)) return '333oh';
    if (/\bBLD\b|blind/i.test(name)) return '333bf';
  }
  return base;
}

// Largest value `Solve.time` can actually hold: the column is a Postgres
// Int (32-bit), i.e. ~24.8 days in ms. Real exports do contain entries past
// this. A corrupt row in a synced cstimer export can carry a time like
// 3.6e26 ms alongside a matching nonsense unix stamp of -3.6e23 s. Such a
// row is unstorable (it would 500 the bulk insert on integer overflow) and
// unrenderable, so it's dropped like any other malformed entry.
const MAX_SOLVE_MS = 2147483647;

// The range a JS Date can represent (±100,000,000 days from the epoch).
// Anything outside it yields an Invalid Date, and calling .toISOString() on
// one throws a RangeError whose message is the bare string "Invalid time
// value". That string is exactly what the import modal used to surface to
// the user, aborting a 45,000-solve import over one bad row.
const MAX_TIMESTAMP_MS = 8640000000000000;

function isRepresentableDate(ms: number): boolean {
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_TIMESTAMP_MS;
}

// A parsed entry before its timestamp is finalized. `createdAtMs` is null
// when the export's own stamp was missing or unrepresentable. The solve
// itself is still kept, and enforceDocumentOrder places it right after the
// solve above it, which is where cstimer lists it anyway.
type PendingSolve = Omit<CstimerSolveEntry, 'createdAt'> & { createdAtMs: number | null };

// The DB orders solves purely by createdAt, so the import needs each solve's
// timestamp to be strictly increasing in the same sequence cstimer lists
// them in — matching cstimer's own display order exactly, rather than
// re-deriving "true" chronological order from the recorded second values
// (which a synced/merged export can't be trusted for: it can contain
// same-second ties on fast events, or even a whole out-of-order run, e.g. an
// older session from another device appended after newer solves once
// synced). Walk the list in document order and nudge any timestamp forward
// by 1ms whenever it wouldn't otherwise be later than the previous solve —
// this guarantees the stored order always matches cstimer's own list.
function enforceDocumentOrder(solves: PendingSolve[]): CstimerSolveEntry[] {
  // Seeded from the first usable stamp so a leading run of unstamped solves
  // still lands just before it rather than at -Infinity.
  const firstKnown = solves.find((s) => s.createdAtMs !== null)?.createdAtMs ?? Date.now();
  let prev = firstKnown - 1;
  return solves.map(({ createdAtMs, ...rest }) => {
    let t = createdAtMs ?? prev + 1;
    if (t <= prev) t = prev + 1;
    prev = t;
    return { ...rest, createdAt: new Date(t).toISOString() };
  });
}

// Parses a cstimer "export to file" .txt: a single JSON object shaped like
// { session1: [...], session2: [...], ..., properties: { sessionData: "<json string>" } }.
// Each solve entry is [[penaltyCode, timeMs], scramble, comment, unixSeconds];
// penaltyCode is 0 (OK), 2000 (+2, timeMs already excludes the penalty), or
// -1 (DNF, timeMs is the raw recorded time) — mirrors this app's own
// Penalty/time convention (effectiveTime adds 2000ms per stacked +2), so no
// time adjustment is needed either way. cstimer has no concept of *stacked*
// +2s, so a 2000 entry always imports as plusTwoCount: 1 — this is a known
// limitation of the import, not a lossy reduction of anything cstimer itself
// could represent.
//
// Individual entries are *skipped*, never fatal: a real export can contain a
// corrupt row (see MAX_SOLVE_MS), and one such row must not take the other
// tens of thousands of solves down with it. Only a file that isn't JSON at
// all throws.
//
// This is also why nothing here calls .toISOString() on an unvalidated
// value: every timestamp goes through isRepresentableDate first.
export function parseCstimerExport(raw: string): CstimerParsedSession[] {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like a cstimer export (not valid JSON).");
  }

  let sessionMeta: Record<string, { name?: string; opt?: { scrType?: string } }> = {};
  const propsRaw = (data.properties as { sessionData?: unknown } | undefined)?.sessionData;
  if (typeof propsRaw === 'string') {
    try {
      sessionMeta = JSON.parse(propsRaw);
    } catch {
      /* fall back to raw "sessionN" keys as names below */
    }
  }

  const results: CstimerParsedSession[] = [];
  for (const key of Object.keys(data)) {
    if (!/^session\d+$/.test(key)) continue;
    const rawSolves = data[key];
    if (!Array.isArray(rawSolves) || rawSolves.length === 0) continue;

    const num = key.replace('session', '');
    const meta = sessionMeta[num] ?? {};
    const name = typeof meta.name === 'string' ? meta.name : key;
    const scrType = meta.opt?.scrType ?? '333';
    const eventId = mapEvent(scrType, name);
    if (!eventId) continue;

    const solves: PendingSolve[] = [];
    for (const entry of rawSolves as unknown[]) {
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) continue;
      const [code, timeMs] = entry[0] as [number, number];
      if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0 || timeMs > MAX_SOLVE_MS) continue;
      const penalty: Penalty = code === -1 ? 'DNF' : 'NONE';
      const plusTwoCount = code === 2000 ? 1 : 0;
      const scramble = typeof entry[1] === 'string' ? entry[1] : '';
      const ms = typeof entry[3] === 'number' ? entry[3] * 1000 : NaN;
      solves.push({
        time: Math.max(0, Math.round(timeMs)),
        penalty,
        plusTwoCount,
        scramble,
        createdAtMs: isRepresentableDate(ms) ? ms : null,
      });
    }
    if (solves.length > 0) results.push({ key, name, scrType, eventId, solves: enforceDocumentOrder(solves) });
  }
  return results.sort((a, b) => b.solves.length - a.solves.length);
}

// Shifts a whole imported batch (preserving each solve's relative spacing)
// so it lands entirely before the target session's earliest solve
// ("beginning") or entirely after its latest ("end"). Left untouched if the
// target session has no solves yet — nothing to anchor against, so the
// import's own original timestamps are used as-is.
export function anchorImportTimestamps(
  solves: CstimerSolveEntry[],
  position: 'beginning' | 'end',
  existingSolves: { createdAt: string }[],
): CstimerSolveEntry[] {
  if (existingSolves.length === 0 || solves.length === 0) return solves;
  const importTimes = solves.map((s) => new Date(s.createdAt).getTime());
  const importMin = Math.min(...importTimes);
  const importMax = Math.max(...importTimes);
  const existingTimes = existingSolves.map((s) => new Date(s.createdAt).getTime());
  const shift = position === 'beginning'
    ? Math.min(...existingTimes) - 1000 - importMax
    : Math.max(...existingTimes) + 1000 - importMin;
  return solves.map((s) => ({ ...s, createdAt: new Date(new Date(s.createdAt).getTime() + shift).toISOString() }));
}
