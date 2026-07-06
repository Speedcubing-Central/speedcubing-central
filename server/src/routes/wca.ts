import { Router } from 'express';
import axios from 'axios';
import { env } from '../env.js';
import { cached } from '../cache.js';

const router = Router();
const ONE_HOUR = 3600;

async function wcaGet<T>(path: string): Promise<T> {
  const resp = await axios.get<T>(`${env.WCA_API_BASE}${path}`, {
    headers: { 'User-Agent': 'SpeedcubingCentral/1.0' },
    timeout: 15000,
  });
  return resp.data;
}

// GET /api/wca/rankings?event=333&type=single&region=world
// WCA's public API doesn't expose a clean "rankings" list, so we query the
// search/results endpoints. We proxy + cache whatever the client needs.
router.get('/rankings', async (req, res, next) => {
  try {
    const event = String(req.query.event ?? '333');
    const type = String(req.query.type ?? 'single'); // single | average
    const region = String(req.query.region ?? 'world');
    const key = `wca:rankings:${event}:${type}:${region}`;
    const data = await cached(key, ONE_HOUR, async () => {
      // The unofficial but stable rankings endpoint.
      const path = `/rankings/${event}/${type}${region && region !== 'world' ? `?region=${encodeURIComponent(region)}` : ''}`;
      try {
        return await wcaGet(path);
      } catch {
        // Fallback: return an empty rankings payload shape if WCA blocks it.
        return { items: [], note: 'WCA rankings endpoint unavailable' };
      }
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// GET /api/wca/competitions?upcoming=true
router.get('/competitions', async (req, res, next) => {
  try {
    const upcoming = req.query.upcoming !== 'false';
    const key = `wca:competitions:${upcoming}`;
    const data = await cached(key, ONE_HOUR, async () => {
      return wcaGet(`/competitions?upcoming_json=true`);
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// GET /api/wca/competitions/:id — full competition detail (rounds, events)
router.get('/competitions/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const key = `wca:competition:${id}`;
    const data = await cached(key, ONE_HOUR, async () => {
      const comp = await wcaGet(`/competitions/${encodeURIComponent(id)}`);
      let wcif: unknown = null;
      try {
        wcif = await wcaGet(`/competitions/${encodeURIComponent(id)}/wcif/public`);
      } catch {
        /* wcif may be unavailable */
      }
      return { competition: comp, wcif };
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// GET /api/wca/competitor/:wcaId — competitor profile + results history
router.get('/competitor/:wcaId', async (req, res, next) => {
  try {
    const wcaId = req.params.wcaId.toUpperCase();
    const key = `wca:competitor:${wcaId}`;
    const data = await cached(key, ONE_HOUR, async () => {
      return wcaGet(`/persons/${encodeURIComponent(wcaId)}`);
    });
    res.json(data);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      res.status(404).json({ error: 'Competitor not found' });
      return;
    }
    next(e);
  }
});

// GET /api/wca/competitor/:wcaId/results — all competition results for a person,
// enriched with proper competition names fetched from the WCA competitions endpoint.
router.get('/competitor/:wcaId/results', async (req, res, next) => {
  try {
    const wcaId = req.params.wcaId.toUpperCase();
    const key = `wca:competitor:${wcaId}:results`;
    const data = await cached(key, ONE_HOUR, async () => {
      const results = await wcaGet<any[]>(`/persons/${encodeURIComponent(wcaId)}/results`);
      if (!Array.isArray(results)) return results;

      // Collect unique competition IDs that don't already have a proper name.
      const ids = [...new Set(
        results
          .map((r: any) => r.competition_id ?? r.competition?.id)
          .filter(Boolean) as string[],
      )];

      // Fetch each competition's proper name in parallel, caching each individually.
      const nameMap = new Map<string, string>();
      await Promise.all(ids.map(async (id) => {
        try {
          const name = await cached(`wca:comp-name:${id}`, ONE_HOUR, async () => {
            const comp = await wcaGet<any>(`/competitions/${encodeURIComponent(id)}`);
            return (comp?.name ?? id) as string;
          });
          nameMap.set(id, name as string);
        } catch {
          nameMap.set(id, id);
        }
      }));

      // Inject competition_name into every result row.
      return results.map((r: any) => {
        const id = r.competition_id ?? r.competition?.id ?? '';
        return { ...r, competition_name: nameMap.get(id) ?? r.competition?.name ?? id };
      });
    });
    res.json(data);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      res.status(404).json({ error: 'Competitor not found' });
      return;
    }
    next(e);
  }
});

// GET /api/wca/search?q=... — search persons by name or id
router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json({ result: [] });
      return;
    }
    const key = `wca:search:${q.toLowerCase()}`;
    const data = await cached(key, ONE_HOUR, async () => {
      return wcaGet(`/search/users?q=${encodeURIComponent(q)}&persons_table=true`);
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
