import { Router } from 'express';
import axios from 'axios';
import { cached } from '../cache.js';

const router = Router();
const ONE_HOUR = 3600;
const CC_BASE = 'https://cubingcontests.com/api';

// Keep in sync with client/src/features/results/ResultsPage.tsx's CC_EVENTS
// (ids/names verified against https://cubingcontests.com/api/events).
const CC_EVENTS = [
  { id: 'fto',                   name: 'FTO' },
  { id: '333_team_bld',          name: '3x3 Team BLD' },
  { id: '333_mirror_blocks',     name: 'Mirror Blocks' },
  { id: '333_mirror_blocks_bld', name: 'Mirror Blocks BLD' },
  { id: 'mpyram',                name: 'Master Pyraminx' },
  { id: 'kilominx',              name: 'Kilominx' },
  { id: 'redi',                  name: 'Redi Cube' },
  { id: 'magic',                 name: 'Magic' },
  { id: 'mmagic',                name: 'Master Magic' },
];

// Country code → CC continent code, sourced verbatim from RecordRanks/client/helpers/default-regions.ts
// CC continent codes (same as WCA): XN=North America, XS=South America, XE=Europe,
//   XA=Asia, XO=Oceania, XF=Africa
// Notable differences from geographic intuition: IL→XE (Europe), KZ→XA (Asia)
const CC_CONTINENT: Record<string, string> = {
  AF:'XA', AL:'XE', DZ:'XF', AD:'XE', AO:'XF', AG:'XN', AR:'XS', AM:'XE',
  AU:'XO', AT:'XE', AZ:'XE', BS:'XN', BH:'XA', BD:'XA', BB:'XN', BY:'XE',
  BE:'XE', BZ:'XN', BJ:'XF', BT:'XA', BO:'XS', BA:'XE', BW:'XF', BR:'XS',
  BN:'XA', BG:'XE', BF:'XF', BI:'XF', CV:'XF', KH:'XA', CM:'XF', CA:'XN',
  CF:'XF', TD:'XF', CL:'XS', CN:'XA', CO:'XS', KM:'XF', CR:'XN', CI:'XF',
  HR:'XE', CU:'XN', CY:'XE', CZ:'XE', CD:'XF', DK:'XE', DJ:'XF', DM:'XN',
  DO:'XN', EC:'XS', EG:'XF', SV:'XN', GQ:'XF', ER:'XF', EE:'XE', SZ:'XF',
  ET:'XF', FJ:'XO', FI:'XE', FR:'XE', GA:'XF', GM:'XF', GE:'XE', DE:'XE',
  GH:'XF', GR:'XE', GD:'XN', GT:'XN', GN:'XF', GW:'XF', GY:'XS', HT:'XN',
  HN:'XN', HK:'XA', HU:'XE', IS:'XE', IN:'XA', ID:'XA', IR:'XA', IQ:'XA',
  IE:'XE', IL:'XE', IT:'XE', JM:'XN', JP:'XA', JO:'XA', KZ:'XA', KE:'XF',
  KI:'XO', XK:'XE', KW:'XA', KG:'XA', LA:'XA', LV:'XE', LB:'XA', LS:'XF',
  LR:'XF', LY:'XF', LI:'XE', LT:'XE', LU:'XE', MO:'XA', MG:'XF', MW:'XF',
  MY:'XA', MV:'XA', ML:'XF', MT:'XE', MH:'XO', MR:'XF', MU:'XF', MX:'XN',
  FM:'XO', MD:'XE', MC:'XE', MN:'XA', ME:'XE', MA:'XF', MZ:'XF', MM:'XA',
  NA:'XF', NR:'XO', NP:'XA', NL:'XE', NZ:'XO', NI:'XN', NE:'XF', NG:'XF',
  KP:'XA', MK:'XE', NO:'XE', OM:'XA', PK:'XA', PW:'XO', PS:'XA', PA:'XN',
  PG:'XO', PY:'XS', PE:'XS', PH:'XA', PL:'XE', PT:'XE', QA:'XA', CG:'XF',
  RO:'XE', RU:'XE', RW:'XF', KN:'XN', LC:'XN', VC:'XN', WS:'XO', SM:'XE',
  ST:'XF', SA:'XA', SN:'XF', RS:'XE', SC:'XF', SL:'XF', SG:'XA', SK:'XE',
  SI:'XE', SB:'XO', SO:'XF', ZA:'XF', KR:'XA', SS:'XF', ES:'XE', LK:'XA',
  SD:'XF', SR:'XS', SE:'XE', CH:'XE', SY:'XA', TW:'XA', TJ:'XA', TZ:'XF',
  TH:'XA', TL:'XA', TG:'XF', TO:'XO', TT:'XN', TN:'XF', TM:'XA', TV:'XO',
  TR:'XE', UG:'XF', UA:'XE', AE:'XA', GB:'XE', US:'XN', UY:'XS', UZ:'XA',
  VU:'XO', VA:'XE', VE:'XS', VN:'XA', YE:'XA', ZM:'XF', ZW:'XF',
};

async function ccGet<T>(path: string): Promise<T> {
  const resp = await axios.get<T>(`${CC_BASE}${path}`, {
    headers: { 'User-Agent': 'SpeedcubingCentral/1.0' },
    timeout: 15000,
  });
  return resp.data;
}

function extractEntries(response: unknown): any[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.results)) return r.results;
    if (Array.isArray(r.data)) return r.data;
  }
  return [];
}

// GET /api/cc/competitor/:wcaId/results
// Fetches world, national, and continental rankings for each curated unofficial event
// directly from the CC API using its ?region= parameter, so the ranks returned match
// exactly what Cubing Contests shows on its website.
// All three leaderboards (world / continent / country) are cached per event+region and
// shared across users — no redundant network calls.
router.get('/competitor/:wcaId/results', async (req, res, next) => {
  try {
    const wcaId = req.params.wcaId.toUpperCase();
    const key = `cc:competitor:${wcaId}:results:v3`;
    const data = await cached(key, ONE_HOUR, async () => {
      const rows: any[] = [];
      await Promise.all(
        CC_EVENTS.flatMap(({ id: eventId }) =>
          (['single', 'average'] as const).map(async (type) => {
            try {
              // World rankings — also used to detect whether the user has a result
              const worldKey = `cc:rankings:${eventId}:${type}`;
              const worldResp = await cached(worldKey, ONE_HOUR, () =>
                ccGet<unknown>(`/default/results/rankings/${eventId}/${type}/all?topN=10000`),
              );
              const worldEntries = extractEntries(worldResp);

              const worldEntry = worldEntries.find((e: any) =>
                e.persons?.some((p: any) => p.wcaId?.toUpperCase() === wcaId),
              );
              if (!worldEntry) return;

              const worldRank: number | null = worldEntry.ranking ?? null;

              const mp = worldEntry.persons?.find((p: any) => p.wcaId?.toUpperCase() === wcaId);
              const country = (mp?.regionCode ?? '').toUpperCase();
              const continent = CC_CONTINENT[country] ?? '';

              // National rank — CC returns ranking=NR when filtered by country code
              let countryRank: number | null = null;
              if (country) {
                try {
                  const natKey = `cc:rankings:${eventId}:${type}:${country}`;
                  const natResp = await cached(natKey, ONE_HOUR, () =>
                    ccGet<unknown>(`/default/results/rankings/${eventId}/${type}/all?region=${country}&topN=10000`),
                  );
                  const natEntry = extractEntries(natResp).find((e: any) =>
                    e.persons?.some((p: any) => p.wcaId?.toUpperCase() === wcaId),
                  );
                  countryRank = natEntry?.ranking ?? null;
                } catch { /* country may have no results for this event */ }
              }

              // Continental rank — CC returns ranking=CR when filtered by continent code
              let continentRank: number | null = null;
              if (continent) {
                try {
                  const contKey = `cc:rankings:${eventId}:${type}:${continent}`;
                  const contResp = await cached(contKey, ONE_HOUR, () =>
                    ccGet<unknown>(`/default/results/rankings/${eventId}/${type}/all?region=${continent}&topN=10000`),
                  );
                  const contEntry = extractEntries(contResp).find((e: any) =>
                    e.persons?.some((p: any) => p.wcaId?.toUpperCase() === wcaId),
                  );
                  continentRank = contEntry?.ranking ?? null;
                } catch { /* continent endpoint unavailable for this event */ }
              }

              rows.push({ ...worldEntry, eventId, resultType: type, worldRank, countryRank, continentRank });
            } catch {
              // Event or type not supported — skip silently
            }
          }),
        ),
      );
      return rows;
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
