import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import '@cubing/icons';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';

// ── Event metadata ────────────────────────────────────────────────────────────

const EVENT_ORDER = [
  '333','222','444','555','666','777',
  '333bf','444bf','555bf','333oh',
  'clock','minx','pyram','skewb','sq1',
  '333mbf','333fm',
];

const EVENT_NAMES: Record<string, string> = {
  '333':'3×3','222':'2×2','444':'4×4','555':'5×5',
  '666':'6×6','777':'7×7','333bf':'3×3 BLD','444bf':'4×4 BLD',
  '555bf':'5×5 BLD','333oh':'3×3 OH','clock':'Clock',
  'minx':'Megaminx','pyram':'Pyraminx','skewb':'Skewb',
  'sq1':'Square-1','333mbf':'Multi-BLD','333fm':'FMC',
};

// WCA round_type.id → readable label
const ROUND_NAMES: Record<string, string> = {
  '1':'Round 1','2':'Round 2','3':'Round 3','4':'Round 4','5':'Round 5',
  'f':'Final','0':'Combined Final','h':'Combined Round',
  'd':'Round 1','e':'Round 2','g':'Round 1','c':'Final',
};

// Cubing Contests unofficial events.
// iconPrefix: 'unofficial' for @cubing/icons unofficial-* classes, 'event' for legacy WCA-era events.
const CC_EVENTS: Array<{ id: string; name: string; iconPrefix: string }> = [
  { id: 'fto',               name: 'FTO',             iconPrefix: 'unofficial' },
  { id: 'kilominx',          name: 'Kilominx',        iconPrefix: 'unofficial' },
  { id: 'redi',              name: 'Redi Cube',       iconPrefix: 'unofficial' },
  { id: 'mpyram',            name: 'Multi-Pyraminx',  iconPrefix: 'unofficial' },
  { id: '333_mirror_blocks', name: 'Mirror Blocks',   iconPrefix: 'unofficial' },
  { id: '333_team_bld',      name: 'Team BLD',        iconPrefix: 'unofficial' },
  { id: 'magic',             name: 'Magic',           iconPrefix: 'event'      },
  { id: 'mmagic',            name: 'Master Magic',    iconPrefix: 'event'      },
  { id: '333_linear_fm',     name: '3×3 Linear FMC', iconPrefix: 'unofficial' },
  { id: 'minx_oh',           name: 'Megaminx OH',     iconPrefix: 'unofficial' },
];

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCs(cs: number, eventId: string): string {
  if (cs <= 0) return 'DNF';
  if (eventId === '333fm') return String(cs);
  if (eventId === '333mbf') {
    const missed   = cs % 100;
    const seconds  = Math.floor((cs % 10_000_000) / 100);
    const points   = 99 - Math.floor(cs / 10_000_000) - missed;
    const attempted = points + missed + missed;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${points}/${attempted} ${m}:${String(s).padStart(2, '0')}`;
  }
  const total = cs / 100;
  const mins  = Math.floor(total / 60);
  const secs  = total % 60;
  return mins > 0
    ? `${mins}:${secs.toFixed(2).padStart(5, '0')}`
    : secs.toFixed(2);
}

function fmtAvg(cs: number, eventId: string): string {
  if (cs === -1) return 'DNF';
  if (cs <= 0)  return '—';
  if (eventId === '333fm') return (cs / 100).toFixed(2);
  return fmtCs(cs, eventId);
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Record badge ──────────────────────────────────────────────────────────────

type RecordLevel = 'WR' | 'CR' | 'NR';

function RecBadge({ level }: { level: RecordLevel }) {
  return (
    <span className={clsx(
      'inline-block text-[9px] font-black px-1 py-px rounded leading-tight tracking-wider shrink-0',
      level === 'WR' && 'bg-yellow-400/20 text-yellow-300',
      level === 'CR' && 'bg-violet-400/20 text-violet-300',
      level === 'NR' && 'bg-red-400/20 text-red-300',
    )}>{level}</span>
  );
}

function inferRecord(wr: number, cr: number, nr: number): RecordLevel | null {
  if (wr === 1) return 'WR';
  if (cr === 1) return 'CR';
  if (nr === 1) return 'NR';
  return null;
}

// ── Event icon ────────────────────────────────────────────────────────────────

function EventIcon({ eventId, size = 14, prefix = 'event' }: { eventId: string; size?: number; prefix?: string }) {
  return (
    <span className={`cubing-icon ${prefix}-${eventId}`}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', flexShrink: 0 }} />
  );
}

// ── WCA API types ─────────────────────────────────────────────────────────────

interface PersonRecord {
  best: number; world_rank: number; continent_rank: number; country_rank: number;
}

interface PersonData {
  person: { name: string; wca_id: string; country_iso2: string; url: string };
  competition_count: number;
  personal_records: Record<string, { single?: PersonRecord; average?: PersonRecord }>;
  medals: { gold: number; silver: number; bronze: number };
  records: { national: number; continental: number; world: number };
}

interface CCRow {
  wcaId: string | null;
  name: string;
  result: number;
  eventId: string;
  resultType: 'single' | 'average';
  shortName?: string;
  competitionId?: string;
  date?: string;
  regionCode?: string;
  worldRank?: number | null;
  continentRank?: number | null;
  countryRank?: number | null;
}

interface CompResult {
  pos: number | null;
  best: number;
  average: number;
  regional_single_record?: string | null;
  regional_average_record?: string | null;
  competition?: { id: string; name: string; start_date?: string };
  event?:       { id: string; name: string };
  round_type?:  { id: string; name?: string };
  competition_id?: string;
  competition_name?: string;
  event_id?: string;
  round_type_id?: string;
  round_type_name?: string;
  start_date?: string;
}

function getCompId  (r: CompResult) { return r.competition?.id   ?? r.competition_id   ?? ''; }
function getCompName(r: CompResult) {
  return r.competition_name ?? r.competition?.name ?? getCompId(r);
}
function getEventId (r: CompResult) { return r.event?.id         ?? r.event_id         ?? ''; }
function getDate    (r: CompResult) { return r.competition?.start_date ?? r.start_date ?? ''; }
function getRound   (r: CompResult) {
  const name = r.round_type?.name ?? r.round_type_name;
  if (name) return name;
  const id = r.round_type?.id ?? r.round_type_id ?? '';
  return ROUND_NAMES[id] ?? (id ? `Round ${id}` : '—');
}

// ── Personal Records table ────────────────────────────────────────────────────

function PRTable({ records }: { records: PersonData['personal_records'] }) {
  const events = EVENT_ORDER.filter((id) => records[id]);
  if (!events.length) return <p className="text-muted text-sm">No official results yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-gray-200 dark:border-border">
            <th className="pb-2 font-medium text-left pr-4">Event</th>
            <th className="pb-2 font-medium text-right pr-3">Single</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right pr-5 opacity-60">NR</th>
            <th className="pb-2 font-medium text-right pr-3">Average</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right opacity-60">NR</th>
          </tr>
        </thead>
        <tbody>
          {events.map((id) => {
            const rec = records[id];
            const s   = rec?.single;
            const a   = rec?.average;
            const sl  = s ? inferRecord(s.world_rank, s.continent_rank, s.country_rank) : null;
            const al  = a ? inferRecord(a.world_rank, a.continent_rank, a.country_rank) : null;
            return (
              <tr key={id} className="border-b border-gray-100 dark:border-border/40 last:border-0 hover:bg-gray-50 dark:hover:bg-card-hover/30 transition-colors">
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <EventIcon eventId={id} size={13} />
                    <span className="font-medium">{EVENT_NAMES[id] ?? id}</span>
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  <span className="flex items-center justify-end gap-1.5">
                    {sl && <RecBadge level={sl} />}
                    {s ? fmtCs(s.best, id) : '—'}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{s ? s.world_rank.toLocaleString()     : '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{s ? s.continent_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-5 text-right font-mono text-muted">{s ? s.country_rank.toLocaleString()   : '—'}</td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  {a ? (
                    <span className="flex items-center justify-end gap-1.5">
                      {al && <RecBadge level={al} />}
                      {fmtAvg(a.best, id)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{a ? a.world_rank.toLocaleString()     : '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{a ? a.continent_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5     text-right font-mono text-muted">{a ? a.country_rank.toLocaleString()   : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared result row ─────────────────────────────────────────────────────────

function ResultRow({ label, rank, best, avg, eventId, singleRec, avgRec }: {
  label: string; rank: number | null;
  best: number; avg: number; eventId: string;
  singleRec?: string | null; avgRec?: string | null;
}) {
  const sr = singleRec as RecordLevel | null;
  const ar = avgRec    as RecordLevel | null;
  return (
    <div className="flex items-center gap-4 py-2 px-4 border-b border-gray-100 dark:border-border/40 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors text-sm">
      <div className="flex-1 min-w-0 font-medium truncate">{label}</div>
      <div className="text-xs text-muted font-mono w-14 text-right shrink-0">
        {rank != null ? rank : '—'}
      </div>
      <div className="flex items-center justify-end gap-1.5 font-mono font-semibold w-20 shrink-0 text-right">
        {sr && <RecBadge level={sr} />}
        {best > 0 ? fmtCs(best, eventId) : 'DNF'}
      </div>
      <div className="flex items-center justify-end gap-1.5 font-mono text-muted w-20 shrink-0 text-right">
        {ar && <RecBadge level={ar} />}
        {fmtAvg(avg, eventId)}
      </div>
    </div>
  );
}

// ── By Competition ────────────────────────────────────────────────────────────

function ByCompetition({ results, eventFilter }: { results: CompResult[]; eventFilter: string | null }) {
  const byComp = new Map<string, { name: string; date: string; rows: CompResult[] }>();
  for (const r of results) {
    const id = getCompId(r);
    if (!byComp.has(id)) byComp.set(id, { name: getCompName(r), date: getDate(r), rows: [] });
    byComp.get(id)!.rows.push(r);
  }
  const allComps = Array.from(byComp.values()).sort((a, b) => b.date.localeCompare(a.date));

  // When filtering, skip competitions that don't have the selected event at all
  const comps = eventFilter
    ? allComps.filter((c) => c.rows.some((r) => getEventId(r) === eventFilter))
    : allComps;

  return (
    <div className="space-y-3">
      {comps.map((comp) => {
        const eventGroups = new Map<string, CompResult[]>();
        for (const r of comp.rows) {
          const evId = getEventId(r);
          if (!eventGroups.has(evId)) eventGroups.set(evId, []);
          eventGroups.get(evId)!.push(r);
        }
        // Preserve WCA order, applying the event filter if set
        const visibleEventIds = EVENT_ORDER.filter(
          (id) => eventGroups.has(id) && (eventFilter == null || id === eventFilter),
        );

        return (
          <div key={comp.name} className="card overflow-hidden">
            <div className="px-4 py-3 flex items-baseline justify-between gap-4 border-b border-gray-200 dark:border-border">
              <span className="font-semibold truncate">{comp.name}</span>
              {comp.date && <span className="text-xs text-muted shrink-0">{fmtDate(comp.date)}</span>}
            </div>
            {visibleEventIds.map((evId, gi) => (
              <div key={evId} className={gi > 0 ? 'border-t border-gray-200 dark:border-border' : ''}>
                {/* Event subheader: icon + name + column labels */}
                <div className="flex items-center gap-4 px-4 py-2 bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-200 dark:border-border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <EventIcon eventId={evId} size={13} />
                    <span className="text-xs font-semibold">{EVENT_NAMES[evId] ?? evId}</span>
                  </div>
                  <div className="w-14 text-right shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wide">Rank</div>
                  <div className="w-20 text-right shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wide">Single</div>
                  <div className="w-20 text-right shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wide">Average</div>
                </div>
                {eventGroups.get(evId)!.map((r, i) => (
                  <ResultRow
                    key={i}
                    label={getRound(r)}
                    rank={r.pos}
                    best={r.best}
                    avg={r.average}
                    eventId={evId}
                    singleRec={r.regional_single_record}
                    avgRec={r.regional_average_record}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Unofficial (Cubing Contests) PR table ─────────────────────────────────────

interface CCPr {
  single?: number; singleWR?: number | null; singleCR?: number | null; singleNR?: number | null;
  average?: number; avgWR?: number | null; avgCR?: number | null; avgNR?: number | null;
}

function UnofficialPRTable({ rows, loading }: { rows: CCRow[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted py-1">Loading Cubing Contests results…</p>;

  const prMap = new Map<string, CCPr>();
  for (const row of rows) {
    const pr = prMap.get(row.eventId) ?? {};
    const cs = row.result;
    if (row.resultType === 'single') {
      if (pr.single == null || cs < pr.single) {
        pr.single   = cs;
        pr.singleWR = row.worldRank     ?? null;
        pr.singleCR = row.continentRank ?? null;
        pr.singleNR = row.countryRank   ?? null;
      }
    } else {
      if (pr.average == null || cs < pr.average) {
        pr.average = cs;
        pr.avgWR   = row.worldRank     ?? null;
        pr.avgCR   = row.continentRank ?? null;
        pr.avgNR   = row.countryRank   ?? null;
      }
    }
    prMap.set(row.eventId, pr);
  }

  const eventIds = CC_EVENTS.map((e) => e.id).filter((id) => prMap.has(id));

  if (!eventIds.length) {
    return <p className="text-sm text-muted">No Cubing Contests results found for your WCA ID.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-gray-200 dark:border-border">
            <th className="pb-2 font-medium text-left pr-4">Event</th>
            <th className="pb-2 font-medium text-right pr-3">Single</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right pr-5 opacity-60">NR</th>
            <th className="pb-2 font-medium text-right pr-3">Average</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right opacity-60">NR</th>
          </tr>
        </thead>
        <tbody>
          {eventIds.map((id) => {
            const pr = prMap.get(id)!;
            const event = CC_EVENTS.find((e) => e.id === id);
            const name = event?.name ?? id;
            return (
              <tr key={id} className="border-b border-gray-100 dark:border-border/40 last:border-0 hover:bg-gray-50 dark:hover:bg-card-hover/30 transition-colors">
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <EventIcon eventId={id} size={13} prefix={event?.iconPrefix} />
                    <span className="font-medium">{name}</span>
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  {pr.single != null ? fmtCs(pr.single, id) : '—'}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{pr.singleWR?.toLocaleString() ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{pr.singleCR?.toLocaleString() ?? '—'}</td>
                <td className="py-1.5 pr-5 text-right font-mono text-muted">{pr.singleNR?.toLocaleString() ?? '—'}</td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  {pr.average != null ? fmtAvg(pr.average, id) : '—'}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{pr.avgWR?.toLocaleString() ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{pr.avgCR?.toLocaleString() ?? '—'}</td>
                <td className="py-1.5     text-right font-mono text-muted">{pr.avgNR?.toLocaleString() ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { user } = useAuth();
  const wcaId = user?.wcaId;
  const [source, setSource] = useState<'official' | 'unofficial'>('official');
  const [eventFilter, setEventFilter] = useState<string | null>(null);

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

  const { data: ccData, isLoading: ccLoading } = useQuery<CCRow[]>({
    queryKey: ['cc-results', wcaId],
    queryFn: () => api.get(`/cc/competitor/${wcaId}/results`).then((r) => r.data),
    enabled: !!wcaId,
    staleTime: 1000 * 60 * 60,
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <Icon name="trophy" size={36} className="mx-auto text-muted" />
        <h2 className="text-xl font-bold">Competition Results</h2>
        <p className="text-muted text-sm">Log in to view your official WCA results.</p>
      </div>
    );
  }

  if (!wcaId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-3">
        <Icon name="trophy" size={36} className="mx-auto text-muted" />
        <h2 className="text-xl font-bold">No WCA ID linked</h2>
        <p className="text-muted text-sm">Log in with WCA OAuth to link your official results.</p>
      </div>
    );
  }

  if (personLoading) return <div className="p-8 text-muted text-center text-sm">Loading…</div>;
  if (personError || !personData) {
    return (
      <div className="p-8 text-center space-y-1">
        <p className="text-red-400 font-medium text-sm">Could not load WCA profile.</p>
        <p className="text-muted text-xs">WCA ID: {wcaId}</p>
      </div>
    );
  }

  const { person, competition_count, personal_records, medals, records } = personData;
  return (
    <div className="space-y-5 max-w-4xl">

      {/* Profile header */}
      <div className="rounded-xl bg-card border-2 border-accent p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold leading-tight">{person.name}</h1>
              <span className="font-mono text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded shrink-0">
                {person.wca_id}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {person.country_iso2 && (
                <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {person.country_iso2}
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Icon name="trophy" size={11} className="text-muted" />
                {competition_count} competition{competition_count !== 1 ? 's' : ''}
              </span>
              {medals.gold > 0 && (
                <span className="flex items-center gap-1 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 rounded-lg px-2.5 py-1 text-xs font-medium">
                  🥇 {medals.gold}
                </span>
              )}
              {medals.silver > 0 && (
                <span className="flex items-center gap-1 bg-gray-400/10 text-gray-600 dark:text-gray-300 rounded-lg px-2.5 py-1 text-xs font-medium">
                  🥈 {medals.silver}
                </span>
              )}
              {medals.bronze > 0 && (
                <span className="flex items-center gap-1 bg-orange-400/10 text-orange-600 dark:text-orange-400 rounded-lg px-2.5 py-1 text-xs font-medium">
                  🥉 {medals.bronze}
                </span>
              )}
              {(records.world + records.continental + records.national) > 0 && (
                <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 rounded-lg px-2.5 py-1 text-xs">
                  {records.world       > 0 && <RecBadge level="WR" />}
                  {records.continental > 0 && <RecBadge level="CR" />}
                  {records.national    > 0 && <RecBadge level="NR" />}
                </span>
              )}
            </div>
          </div>
          <a href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors border border-gray-200 dark:border-border rounded-lg px-3 py-1.5 shrink-0">
            <Icon name="external" size={13} />
            WCA Profile
          </a>
      </div>

      {/* Official / Unofficial toggle */}
      <div className="flex rounded-lg border border-gray-200 dark:border-border overflow-hidden text-xs font-medium w-fit">
        {(['official', 'unofficial'] as const).map((v, i) => (
          <button
            key={v}
            onClick={() => setSource(v)}
            className={clsx(
              'px-4 py-2 transition-colors',
              i > 0 && 'border-l border-gray-200 dark:border-border',
              source === v
                ? 'bg-accent text-white'
                : 'text-muted hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-card-hover',
            )}
          >
            {v === 'official' ? 'Official Events' : 'Unofficial Events'}
          </button>
        ))}
      </div>

      {/* Personal Records */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Personal Records</h2>
        {source === 'official'
          ? <PRTable records={personal_records} />
          : <UnofficialPRTable rows={ccData ?? []} loading={ccLoading} />
        }
      </div>
      {source === 'unofficial' && (
        <p className="text-center text-xs text-muted -mt-2">
          Powered by{' '}
          <a href="https://cubingcontests.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Cubing Contests
          </a>
          {' '}· Personal bests only · {CC_EVENTS.length} unofficial events tracked
        </p>
      )}

      {/* Competition Results — official only */}
      {source === 'official' && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Competition Results</h2>
          {resultsLoading ? (
            <div className="card p-6 text-center text-sm text-muted">Loading competition history…</div>
          ) : resultsData && resultsData.length > 0 ? (
            <>
              {/* Event filter pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setEventFilter(null)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap',
                    eventFilter == null
                      ? 'bg-accent text-white border-accent'
                      : 'border-gray-200 dark:border-border text-muted hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-card-hover',
                  )}
                >
                  All
                </button>
                {EVENT_ORDER.filter((id) => resultsData.some((r) => getEventId(r) === id)).map((id) => (
                  <button
                    key={id}
                    onClick={() => setEventFilter(id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap',
                      eventFilter === id
                        ? 'bg-accent text-white border-accent'
                        : 'border-gray-200 dark:border-border text-muted hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-card-hover',
                    )}
                  >
                    <EventIcon eventId={id} size={13} />
                    {EVENT_NAMES[id] ?? id}
                  </button>
                ))}
              </div>
              <ByCompetition results={resultsData} eventFilter={eventFilter} />
            </>
          ) : (
            <div className="card p-4 flex items-center justify-between text-sm">
              <span className="text-muted">Full history available on the WCA website.</span>
              <a href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:underline text-xs ml-4 shrink-0">
                View on WCA <Icon name="external" size={12} />
              </a>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
