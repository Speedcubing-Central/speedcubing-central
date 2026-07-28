// URL slug ↔ internal set ID mappings — shared by the trainer/library pages
// and the stats page so they resolve routes identically.
export const SET_TO_URL: Record<string, string> = {
  OLL: 'oll', PLL: 'pll', F2L: 'f2l', COLL: 'coll',
  EG1: 'eg-1', EG2: 'eg-2', CLL: 'cll',
  OrtegaOLL: 'ortega-oll', OrtegaPBL: 'ortega-pbl',
  SQ1CubeShape: 'cube-shape',
};
export const URL_TO_SET: Record<string, string> = Object.fromEntries(
  Object.entries(SET_TO_URL).map(([k, v]) => [v, k]),
);

// A Trainer session can combine cases from several sets at once — their
// slugs are joined with "+" in the URL (e.g. /algorithms/trainer/3x3/oll+pll).
// Centralized here (rather than each navigate() call inlining split/join)
// so the Trainer, its Stats page, and any other consumer agree on the
// scheme. Unknown slugs are silently dropped rather than left as `undefined`
// so a stale/bad URL degrades to "no sets selected" instead of crashing.
export function joinSetSlugs(setIds: string[]): string {
  return setIds.map((id) => SET_TO_URL[id] ?? id.toLowerCase()).join('+');
}

export function parseSetSlugs(slug: string | undefined): string[] {
  if (!slug) return [];
  return slug.split('+').map((s) => URL_TO_SET[s]).filter((s): s is string => Boolean(s));
}
