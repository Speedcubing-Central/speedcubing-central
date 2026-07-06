import { Router } from 'express';
import axios from 'axios';
import { cached } from '../cache.js';

const router = Router();
const ONE_HOUR = 3600;
const CC_BASE = 'https://cubingcontests.com/api';

const CC_EVENTS = [
  { id: 'fto',              name: 'FTO' },
  { id: 'kilominx',         name: 'Kilominx' },
  { id: 'redi',             name: 'Redi Cube' },
  { id: 'mpyram',           name: 'Multi-Pyraminx' },
  { id: '333_mirror_blocks',name: 'Mirror Blocks' },
  { id: '333_team_bld',     name: 'Team BLD' },
  { id: 'magic',            name: 'Magic' },
  { id: 'mmagic',           name: 'Master Magic' },
  { id: '333_linear_fm',    name: '3×3 Linear FMC' },
  { id: 'minx_oh',          name: 'Megaminx OH' },
];

// ISO 3166-1 alpha-2 country → WCA continent code
// Codes: NA=North America, SA=South America, EU=Europe, AS=Asia, OC=Oceania, AF=Africa
const CONTINENT: Record<string, string> = {
  // North America
  AG:'NA', AI:'NA', AW:'NA', BB:'NA', BL:'NA', BM:'NA', BS:'NA', BZ:'NA', CA:'NA',
  CR:'NA', CU:'NA', DM:'NA', DO:'NA', GD:'NA', GL:'NA', GP:'NA', GT:'NA', HN:'NA',
  HT:'NA', JM:'NA', KN:'NA', KY:'NA', LC:'NA', MF:'NA', MQ:'NA', MS:'NA', MX:'NA',
  NI:'NA', PA:'NA', PM:'NA', PR:'NA', SV:'NA', TC:'NA', TT:'NA', US:'NA', VC:'NA',
  VG:'NA', VI:'NA', CW:'NA', SX:'NA', BQ:'NA',
  // South America
  AR:'SA', BO:'SA', BR:'SA', CL:'SA', CO:'SA', EC:'SA', FK:'SA', GF:'SA', GY:'SA',
  PE:'SA', PY:'SA', SR:'SA', UY:'SA', VE:'SA',
  // Europe (follows WCA convention: TR, AZ, AM, GE, KZ in Europe)
  AD:'EU', AL:'EU', AM:'EU', AT:'EU', AZ:'EU', BA:'EU', BE:'EU', BG:'EU', BY:'EU',
  CH:'EU', CY:'EU', CZ:'EU', DE:'EU', DK:'EU', EE:'EU', ES:'EU', FI:'EU', FO:'EU',
  FR:'EU', GB:'EU', GE:'EU', GG:'EU', GI:'EU', GR:'EU', HR:'EU', HU:'EU', IE:'EU',
  IM:'EU', IS:'EU', IT:'EU', JE:'EU', KZ:'EU', LI:'EU', LT:'EU', LU:'EU', LV:'EU',
  MC:'EU', MD:'EU', ME:'EU', MK:'EU', MT:'EU', NL:'EU', NO:'EU', PL:'EU', PT:'EU',
  RO:'EU', RS:'EU', RU:'EU', SE:'EU', SI:'EU', SK:'EU', SM:'EU', TR:'EU', UA:'EU',
  VA:'EU', XK:'EU',
  // Asia
  AE:'AS', AF:'AS', BH:'AS', BD:'AS', BN:'AS', CN:'AS', HK:'AS', ID:'AS', IL:'AS',
  IN:'AS', IQ:'AS', IR:'AS', JO:'AS', JP:'AS', KH:'AS', KP:'AS', KR:'AS', KW:'AS',
  LA:'AS', LB:'AS', LK:'AS', MM:'AS', MN:'AS', MO:'AS', MV:'AS', MY:'AS', NP:'AS',
  OM:'AS', PH:'AS', PK:'AS', PS:'AS', QA:'AS', SA:'AS', SG:'AS', SY:'AS', TH:'AS',
  TJ:'AS', TL:'AS', TM:'AS', TW:'AS', UZ:'AS', VN:'AS', YE:'AS',
  // Oceania
  AU:'OC', CK:'OC', FJ:'OC', FM:'OC', GU:'OC', KI:'OC', MH:'OC', MP:'OC', NC:'OC',
  NR:'OC', NU:'OC', NZ:'OC', PF:'OC', PG:'OC', PW:'OC', SB:'OC', TK:'OC', TO:'OC',
  TV:'OC', VU:'OC', WF:'OC', WS:'OC',
  // Africa
  AO:'AF', BF:'AF', BI:'AF', BJ:'AF', BW:'AF', CD:'AF', CF:'AF', CG:'AF', CI:'AF',
  CM:'AF', CV:'AF', DJ:'AF', DZ:'AF', EG:'AF', ER:'AF', ET:'AF', GA:'AF', GH:'AF',
  GM:'AF', GN:'AF', GQ:'AF', GW:'AF', KE:'AF', KM:'AF', LR:'AF', LS:'AF', LY:'AF',
  MA:'AF', MG:'AF', ML:'AF', MR:'AF', MU:'AF', MW:'AF', MZ:'AF', NA:'AF', NE:'AF',
  NG:'AF', RE:'AF', RW:'AF', SC:'AF', SD:'AF', SL:'AF', SN:'AF', SO:'AF', SS:'AF',
  ST:'AF', SZ:'AF', TD:'AF', TG:'AF', TN:'AF', TZ:'AF', UG:'AF', YT:'AF', ZA:'AF',
  ZM:'AF', ZW:'AF',
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
// Fetches rankings for each curated unofficial event (cached per-event, shared across users),
// finds this user's personal best entry, and computes world / continental / national ranks
// by scanning the already-cached leaderboard — no extra API calls required.
router.get('/competitor/:wcaId/results', async (req, res, next) => {
  try {
    const wcaId = req.params.wcaId.toUpperCase();
    const key = `cc:competitor:${wcaId}:results:v2`;
    const data = await cached(key, ONE_HOUR, async () => {
      const rows: any[] = [];
      await Promise.all(
        CC_EVENTS.flatMap(({ id: eventId }) =>
          ['single', 'average'].map(async (type) => {
            try {
              const rankingsKey = `cc:rankings:${eventId}:${type}`;
              const response = await cached(rankingsKey, ONE_HOUR, () =>
                ccGet<unknown>(`/default/results/rankings/${eventId}/${type}/all?topN=10000`),
              );
              const entries = extractEntries(response);

              const matchEntry = entries.find((e: any) =>
                e.persons?.some((p: any) => p.wcaId?.toUpperCase() === wcaId),
              );
              if (!matchEntry) return;

              const mp = matchEntry.persons?.find((p: any) => p.wcaId?.toUpperCase() === wcaId);
              const country = (mp?.regionCode ?? '').toUpperCase();
              const continent = CONTINENT[country] ?? '';

              // World rank: provided directly by the CC API on each entry
              const worldRank: number | null = matchEntry.ranking ?? null;

              // Country rank: count entries with a strictly better result in the same country
              const countryRank: number | null = country
                ? entries.filter((e: any) =>
                    e.result < matchEntry.result &&
                    (e.persons?.[0]?.regionCode ?? '').toUpperCase() === country,
                  ).length + 1
                : null;

              // Continental rank: same approach, scoped to the same continent
              const continentRank: number | null = continent
                ? entries.filter((e: any) =>
                    e.result < matchEntry.result &&
                    CONTINENT[(e.persons?.[0]?.regionCode ?? '').toUpperCase()] === continent,
                  ).length + 1
                : null;

              rows.push({ ...matchEntry, eventId, resultType: type, worldRank, countryRank, continentRank });
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
