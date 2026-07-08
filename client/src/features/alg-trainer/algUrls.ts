// URL slug ↔ internal set ID mappings — shared by the trainer/library pages
// and the stats page so they resolve routes identically.
export const SET_TO_URL: Record<string, string> = {
  OLL: 'oll', PLL: 'pll', F2L: 'f2l', COLL: 'coll',
  EG1: 'eg-1', EG2: 'eg-2', CLL: 'cll',
  OrtegaOLL: 'ortega-oll', OrtegaPBL: 'ortega-pbl',
};
export const URL_TO_SET: Record<string, string> = Object.fromEntries(
  Object.entries(SET_TO_URL).map(([k, v]) => [v, k]),
);
