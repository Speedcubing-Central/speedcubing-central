import type { Penalty } from '@scc/shared';

export interface CstimerSolveEntry {
  time: number; // ms
  penalty: Penalty;
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
const SCRTYPE_TO_EVENT: Record<string, string> = {
  '222so': '222',
  '333': '333',
  '444wca': '444',
  '555wca': '555',
  '666wca': '666',
  '777wca': '777',
  clkwca: 'clock',
  pyrso: 'pyram',
  skbso: 'skewb',
  sqrs: 'sq1',
  mgmp: 'minx',
  ftoso: 'fto',
};

// cstimer uses the plain "333" scramble type for OH and BLD sessions too
// (same scrambler, different solving method) — the session name is the only
// signal, so sniff it for those two common cases.
function mapEvent(scrType: string, name: string): string | null {
  const base = SCRTYPE_TO_EVENT[scrType];
  if (!base) return null;
  if (base === '333') {
    if (/\bOH\b|one-?handed/i.test(name)) return '333oh';
    if (/\bBLD\b|blind/i.test(name)) return '333bf';
  }
  return base;
}

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
function enforceDocumentOrder(solves: CstimerSolveEntry[]): CstimerSolveEntry[] {
  let prev = -Infinity;
  return solves.map((s) => {
    let t = new Date(s.createdAt).getTime();
    if (t <= prev) t = prev + 1;
    prev = t;
    return { ...s, createdAt: new Date(t).toISOString() };
  });
}

// Parses a cstimer "export to file" .txt: a single JSON object shaped like
// { session1: [...], session2: [...], ..., properties: { sessionData: "<json string>" } }.
// Each solve entry is [[penaltyCode, timeMs], scramble, comment, unixSeconds];
// penaltyCode is 0 (OK), 2000 (+2, timeMs already excludes the penalty), or
// -1 (DNF, timeMs is the raw recorded time) — mirrors this app's own
// Penalty/time convention (effectiveTime adds the 2000ms for PLUS2), so no
// adjustment is needed either way.
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

    const solves: CstimerSolveEntry[] = [];
    for (const entry of rawSolves as unknown[]) {
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) continue;
      const [code, timeMs] = entry[0] as [number, number];
      const penalty: Penalty = code === -1 ? 'DNF' : code === 2000 ? 'PLUS2' : 'NONE';
      const scramble = typeof entry[1] === 'string' ? entry[1] : '';
      const seconds = typeof entry[3] === 'number' ? entry[3] : Date.now() / 1000;
      solves.push({
        time: Math.max(0, Math.round(timeMs)),
        penalty,
        scramble,
        createdAt: new Date(seconds * 1000).toISOString(),
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
