import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';

// WCA standard event display order
const EVENT_ORDER = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '444bf', '555bf',
  '333oh',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '333mbf', '333fm',
];

const EVENT_NAMES: Record<string, string> = {
  '333': '3×3', '222': '2×2', '444': '4×4', '555': '5×5',
  '666': '6×6', '777': '7×7', '333bf': '3×3 BLD', '444bf': '4×4 BLD',
  '555bf': '5×5 BLD', '333oh': '3×3 OH', 'clock': 'Clock',
  'minx': 'Megaminx', 'pyram': 'Pyraminx', 'skewb': 'Skewb',
  'sq1': 'Square-1', '333mbf': 'Multi-BLD', '333fm': 'FMC',
};

function formatWcaTime(centiseconds: number, eventId: string): string {
  if (centiseconds <= 0) return 'DNF';

  if (eventId === '333fm') {
    // FMC single: move count stored as-is
    return String(centiseconds);
  }

  if (eventId === '333mbf') {
    // Encoding: (99 - points) * 10000000 + seconds * 100 + missed
    const missed = centiseconds % 100;
    const seconds = Math.floor((centiseconds % 10000000) / 100);
    const points = 99 - Math.floor(centiseconds / 10000000) - missed;
    const solved = points + missed;
    const attempted = solved + missed;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
    return `${points}/${attempted} ${timeStr}`;
  }

  const totalSeconds = centiseconds / 100;
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  return secs.toFixed(2);
}

function formatFmcAverage(value: number): string {
  // FMC average stored as centiseconds of the average (e.g. 2433 = 24.33 moves)
  return (value / 100).toFixed(2);
}

function RankBadge({ rank, label }: { rank: number; label: string }) {
  const colors: Record<string, string> = {
    WR: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40',
    CR: 'bg-purple-400/20 text-purple-300 border border-purple-400/40',
    NR: 'bg-red-400/20 text-red-300 border border-red-400/40',
  };
  const cls = colors[label];
  if (!cls) return null;
  return (
    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', cls)}>
      {label}
    </span>
  );
}

function rankLabel(worldRank: number, continentRank: number, countryRank: number) {
  if (worldRank === 1) return 'WR';
  if (continentRank === 1) return 'CR';
  if (countryRank === 1) return 'NR';
  return null;
}

interface PersonRecord {
  best: number;
  world_rank: number;
  continent_rank: number;
  country_rank: number;
}

interface PersonData {
  person: {
    name: string;
    wca_id: string;
    country_iso2: string;
    url: string;
    avatar?: { url: string; thumb_url: string };
  };
  competition_count: number;
  personal_records: Record<string, { single?: PersonRecord; average?: PersonRecord }>;
  medals: { gold: number; silver: number; bronze: number };
  records: { national: number; continental: number; world: number };
}

interface CompResult {
  competition_id: string;
  competition_name: string;
  event_id: string;
  round_type_name: string;
  pos: number | null;
  best: number;
  average: number;
  attempts: (number | null)[];
  country_rank: number;
  continent_rank: number;
  world_rank: number;
}

function PRTable({ records }: { records: PersonData['personal_records'] }) {
  const events = EVENT_ORDER.filter((id) => records[id]);

  if (events.length === 0) {
    return <p className="text-muted text-sm">No official results yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-border">
            <th className="pb-2 font-medium text-muted pr-4">Event</th>
            <th className="pb-2 font-medium text-muted text-right pr-6">Single</th>
            <th className="pb-2 font-medium text-muted text-right pr-2 text-xs">WR</th>
            <th className="pb-2 font-medium text-muted text-right pr-2 text-xs">CR</th>
            <th className="pb-2 font-medium text-muted text-right pr-6 text-xs">NR</th>
            <th className="pb-2 font-medium text-muted text-right pr-6">Average</th>
            <th className="pb-2 font-medium text-muted text-right pr-2 text-xs">WR</th>
            <th className="pb-2 font-medium text-muted text-right pr-2 text-xs">CR</th>
            <th className="pb-2 font-medium text-muted text-right text-xs">NR</th>
          </tr>
        </thead>
        <tbody>
          {events.map((eventId) => {
            const rec = records[eventId];
            const single = rec?.single;
            const avg = rec?.average;
            const singleLabel = single ? rankLabel(single.world_rank, single.continent_rank, single.country_rank) : null;
            const avgLabel = avg ? rankLabel(avg.world_rank, avg.continent_rank, avg.country_rank) : null;
            return (
              <tr key={eventId} className="border-b border-gray-100 dark:border-border/50 last:border-0">
                <td className="py-2.5 pr-4 font-medium">{EVENT_NAMES[eventId] ?? eventId}</td>
                {/* Single */}
                <td className="py-2.5 pr-6 text-right font-mono font-semibold">
                  <span className="flex items-center justify-end gap-2">
                    {singleLabel && <RankBadge rank={single!.country_rank} label={singleLabel} />}
                    {single ? formatWcaTime(single.best, eventId) : '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-2 text-right text-muted text-xs font-mono">
                  {single ? single.world_rank.toLocaleString() : '—'}
                </td>
                <td className="py-2.5 pr-2 text-right text-muted text-xs font-mono">
                  {single ? single.continent_rank.toLocaleString() : '—'}
                </td>
                <td className="py-2.5 pr-6 text-right text-muted text-xs font-mono">
                  {single ? single.country_rank.toLocaleString() : '—'}
                </td>
                {/* Average */}
                <td className="py-2.5 pr-6 text-right font-mono font-semibold">
                  {avg ? (
                    <span className="flex items-center justify-end gap-2">
                      {avgLabel && <RankBadge rank={avg.country_rank} label={avgLabel} />}
                      {eventId === '333fm'
                        ? formatFmcAverage(avg.best)
                        : formatWcaTime(avg.best, eventId)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 pr-2 text-right text-muted text-xs font-mono">
                  {avg ? avg.world_rank.toLocaleString() : '—'}
                </td>
                <td className="py-2.5 pr-2 text-right text-muted text-xs font-mono">
                  {avg ? avg.continent_rank.toLocaleString() : '—'}
                </td>
                <td className="py-2.5 text-right text-muted text-xs font-mono">
                  {avg ? avg.country_rank.toLocaleString() : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompHistory({ results }: { results: CompResult[] }) {
  // Group by competition
  const byComp = new Map<string, { name: string; results: CompResult[] }>();
  for (const r of results) {
    if (!byComp.has(r.competition_id)) {
      byComp.set(r.competition_id, { name: r.competition_name, results: [] });
    }
    byComp.get(r.competition_id)!.results.push(r);
  }

  const comps = Array.from(byComp.entries());

  if (comps.length === 0) {
    return <p className="text-muted text-sm">No competition results found.</p>;
  }

  return (
    <div className="space-y-4">
      {comps.map(([compId, { name, results: compResults }]) => (
        <div key={compId} className="card p-4">
          <div className="font-semibold mb-3 text-sm">{name}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-border">
                  <th className="pb-1.5 font-medium text-muted pr-3">Event</th>
                  <th className="pb-1.5 font-medium text-muted pr-3">Round</th>
                  <th className="pb-1.5 font-medium text-muted pr-3 text-right">Place</th>
                  <th className="pb-1.5 font-medium text-muted pr-3 text-right">Best</th>
                  <th className="pb-1.5 font-medium text-muted text-right">Average</th>
                </tr>
              </thead>
              <tbody>
                {compResults
                  .sort((a, b) => EVENT_ORDER.indexOf(a.event_id) - EVENT_ORDER.indexOf(b.event_id))
                  .map((r, i) => {
                    const label = rankLabel(r.world_rank, r.continent_rank, r.country_rank);
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-border/50 last:border-0">
                        <td className="py-1.5 pr-3 font-medium">{EVENT_NAMES[r.event_id] ?? r.event_id}</td>
                        <td className="py-1.5 pr-3 text-muted">{r.round_type_name}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {r.pos != null ? `#${r.pos}` : '—'}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                          <span className="flex items-center justify-end gap-1.5">
                            {label && <RankBadge rank={r.country_rank} label={label} />}
                            {r.best > 0 ? formatWcaTime(r.best, r.event_id) : 'DNF'}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono">
                          {r.average > 0
                            ? r.event_id === '333fm'
                              ? formatFmcAverage(r.average)
                              : formatWcaTime(r.average, r.event_id)
                            : r.average === -1 ? 'DNF' : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const { user } = useAuth();
  const wcaId = user?.wcaId;

  const { data: personData, isLoading: personLoading, error: personError } = useQuery<PersonData>({
    queryKey: ['wca-person', wcaId],
    queryFn: () => api.get(`/wca/competitor/${wcaId}`).then((r) => r.data),
    enabled: !!wcaId,
    staleTime: 1000 * 60 * 60,
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery<CompResult[]>({
    queryKey: ['wca-results', wcaId],
    queryFn: () => api.get(`/wca/competitor/${wcaId}/results`).then((r) => r.data),
    enabled: !!wcaId,
    staleTime: 1000 * 60 * 60,
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <Icon name="trophy" size={40} className="mx-auto text-muted" />
        <h2 className="text-xl font-bold">Competition Results</h2>
        <p className="text-muted">Log in to view your official WCA results.</p>
      </div>
    );
  }

  if (!wcaId) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <Icon name="trophy" size={40} className="mx-auto text-muted" />
        <h2 className="text-xl font-bold">No WCA ID linked</h2>
        <p className="text-muted">
          Your account doesn't have a WCA ID associated. Log in with WCA OAuth to link your
          official results.
        </p>
      </div>
    );
  }

  if (personLoading) {
    return <div className="p-8 text-muted text-center">Loading results…</div>;
  }

  if (personError || !personData) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-red-400 font-medium">Could not load WCA profile.</p>
        <p className="text-muted text-sm">WCA ID: {wcaId}</p>
      </div>
    );
  }

  const { person, competition_count, personal_records, medals, records } = personData;
  const totalRecords = records.national + records.continental + records.world;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Profile header */}
      <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {person.avatar?.thumb_url && (
          <img
            src={person.avatar.thumb_url}
            alt={person.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-border shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{person.name}</h1>
            <span className="font-mono text-accent font-semibold text-sm">{person.wca_id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="globe" size={14} />
              {person.country_iso2}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={14} />
              {competition_count} competition{competition_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {medals.gold > 0 && (
              <span className="text-sm font-medium">🥇 {medals.gold}</span>
            )}
            {medals.silver > 0 && (
              <span className="text-sm font-medium">🥈 {medals.silver}</span>
            )}
            {medals.bronze > 0 && (
              <span className="text-sm font-medium">🥉 {medals.bronze}</span>
            )}
            {records.world > 0 && (
              <RankBadge rank={1} label="WR" />
            )}
            {records.continental > 0 && (
              <RankBadge rank={1} label="CR" />
            )}
            {records.national > 0 && (
              <RankBadge rank={1} label="NR" />
            )}
          </div>
        </div>
        <a
          href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors shrink-0"
        >
          <Icon name="external" size={13} />
          WCA Profile
        </a>
      </div>

      {/* Personal Records */}
      <div className="card p-5">
        <h2 className="text-base font-semibold mb-4">Personal Records</h2>
        <PRTable records={personal_records} />
      </div>

      {/* Competition History */}
      <div>
        <h2 className="text-base font-semibold mb-3">Competition History</h2>
        {resultsLoading ? (
          <div className="text-muted text-sm p-4">Loading competition history…</div>
        ) : resultsData ? (
          <CompHistory results={resultsData} />
        ) : (
          <div className="card p-4 text-sm text-muted flex items-center justify-between">
            <span>Full competition history available on the WCA website.</span>
            <a
              href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-accent hover:underline text-xs"
            >
              View on WCA <Icon name="external" size={13} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
