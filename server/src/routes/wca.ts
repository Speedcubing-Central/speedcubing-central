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

      // Fetch each competition's name + start_date in parallel, caching each individually.
      const compMap = new Map<string, { name: string; start_date: string }>();
      await Promise.all(ids.map(async (id) => {
        try {
          const info = await cached(`wca:comp-info:${id}`, ONE_HOUR, async () => {
            const comp = await wcaGet<any>(`/competitions/${encodeURIComponent(id)}`);
            return { name: (comp?.name ?? id) as string, start_date: (comp?.start_date ?? '') as string };
          });
          compMap.set(id, info as { name: string; start_date: string });
        } catch {
          compMap.set(id, { name: id, start_date: '' });
        }
      }));

      // Inject competition_name and start_date into every result row.
      return results.map((r: any) => {
        const id = r.competition_id ?? r.competition?.id ?? '';
        const info = compMap.get(id);
        return {
          ...r,
          competition_name: (info?.name && info.name !== id ? info.name : null) ?? r.competition?.name ?? id,
          start_date: info?.start_date ?? r.competition?.start_date ?? r.start_date ?? '',
        };
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
