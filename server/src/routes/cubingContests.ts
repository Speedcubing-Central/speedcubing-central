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
// Fetches rankings for each curated unofficial event (cached per-event),
// filters by the given WCA ID, and returns the matching rows.
// CC times are in milliseconds; the client divides by 10 to get centiseconds.
router.get('/competitor/:wcaId/results', async (req, res, next) => {
  try {
    const wcaId = req.params.wcaId.toUpperCase();
    const key = `cc:competitor:${wcaId}:results`;
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
              for (const entry of extractEntries(response)) {
                const match = entry.persons?.find(
                  (p: any) => p.wcaId?.toUpperCase() === wcaId,
                );
                if (match) {
                  rows.push({ ...entry, eventId, resultType: type });
                }
              }
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
