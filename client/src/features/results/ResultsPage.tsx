import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import '@cubing/icons';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { Icon } from '../../components/Icon';

const EVENT_ORDER = [
  '333','222','444','555','666','777',
  '333bf','444bf','555bf','333oh',
  'clock','minx','pyram','skewb','sq1',
  '333mbf','333fm',
];

const EVENT_NAMES: Record<string, string> = {
  '333':'3×3','222':'2×2','444':'4×4','555':'5×5',
  '666':'6×6','777':'7×7','333bf':'3×3 Blind','444bf':'4×4 Blind',
  '555bf':'5×5 Blind','333oh':'3×3 One-Handed','clock':'Clock',
  'minx':'Megaminx','pyram':'Pyraminx','skewb':'Skewb',
  'sq1':'Square-1','333mbf':'Multi-Blind','333fm':'Fewest Moves',
};

// ── WCA time formatting ───────────────────────────────────────────────────────

function fmtCs(cs: number, eventId: string): string {
  if (cs <= 0) return 'DNF';
  if (eventId === '333fm') return String(cs);
  if (eventId === '333mbf') {
    const missed   = cs % 100;
    const seconds  = Math.floor((cs % 10_000_000) / 100);
    const points   = 99 - Math.floor(cs / 10_000_000) - missed;
    const solved   = points + missed;
    const attempted = solved + missed;
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

// ── Record badge ──────────────────────────────────────────────────────────────

type RecordLevel = 'WR' | 'CR' | 'NR';

function RecBadge({ level }: { level: RecordLevel }) {
  return (
    <span className={clsx(
      'inline-block text-[9px] font-black px-1 py-px rounded leading-tight tracking-wider',
      level === 'WR' && 'bg-yellow-400/20 text-yellow-300',
      level === 'CR' && 'bg-violet-400/20 text-violet-300',
      level === 'NR' && 'bg-red-400/20 text-red-300',
    )}>
      {level}
    </span>
  );
}

function inferRecord(wr: number, cr: number, nr: number): RecordLevel | null {
  if (wr === 1) return 'WR';
  if (cr === 1) return 'CR';
  if (nr === 1) return 'NR';
  return null;
}

// ── Event icon (cubing.js) ─────────────────────────────────────────────────────

function EventIcon({ eventId, size = 16 }: { eventId: string; size?: number }) {
  return (
    <span
      className={`cubing-icon event-${eventId}`}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    />
  );
}

// ── WCA API shapes ────────────────────────────────────────────────────────────

interface PersonRecord { best: number; world_rank: number; continent_rank: number; country_rank: number }

interface PersonData {
  person: {
    name: string; wca_id: string; country_iso2: string; url: string;
    avatar?: { url: string; thumb_url: string };
  };
  competition_count: number;
  personal_records: Record<string, { single?: PersonRecord; average?: PersonRecord }>;
  medals: { gold: number; silver: number; bronze: number };
  records: { national: number; continental: number; world: number };
}

interface CompResult {
  pos: number | null;
  best: number;
  average: number;
  regional_single_record?: string | null;
  regional_average_record?: string | null;
  // WCA API v0 nested format
  competition?: { id: string; name: string; start_date?: string; end_date?: string; city_name?: string };
  event?:       { id: string; name: string };
  round_type?:  { id: string; name: string; rank?: number; final?: boolean };
  // Flat format fallback
  competition_id?: string;
  competition_name?: string;
  event_id?: string;
  round_type_id?: string;
  round_type_name?: string;
  start_date?: string;
}

const getCompId   = (r: CompResult) => r.competition?.id   ?? r.competition_id   ?? '';
const getCompName = (r: CompResult) => r.competition?.name ?? r.competition_name ?? r.competition_id ?? '—';
const getEventId  = (r: CompResult) => r.event?.id         ?? r.event_id         ?? '';
const getRound    = (r: CompResult) => r.round_type?.name  ?? r.round_type_name  ?? r.round_type_id  ?? '—';
const getDate     = (r: CompResult) => r.competition?.start_date ?? r.start_date ?? '';

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Personal Records table ─────────────────────────────────────────────────────

function PRTable({ records }: { records: PersonData['personal_records'] }) {
  const events = EVENT_ORDER.filter((id) => records[id]);
  if (events.length === 0) return <p className="text-muted text-sm">No official results yet.</p>;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-gray-200 dark:border-border">
            <th className="pb-2 font-medium text-left pl-1 pr-3 w-32">Event</th>
            <th className="pb-2 font-medium text-right pr-3">Single</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right pr-5 opacity-60">NR</th>
            <th className="pb-2 font-medium text-right pr-3">Average</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">WR</th>
            <th className="pb-2 font-medium text-right pr-2 opacity-60">CR</th>
            <th className="pb-2 font-medium text-right pr-1 opacity-60">NR</th>
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
              <tr key={id} className="border-b border-gray-100 dark:border-border/40 last:border-0 hover:bg-gray-50 dark:hover:bg-card-hover/40 transition-colors">
                <td className="py-1.5 pl-1 pr-3">
                  <span className="flex items-center gap-2">
                    <EventIcon eventId={id} size={14} />
                    <span className="font-medium">{EVENT_NAMES[id] ?? id}</span>
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  <span className="flex items-center justify-end gap-1.5">
                    {sl && <RecBadge level={sl} />}
                    {s ? fmtCs(s.best, id) : '—'}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{s ? s.world_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{s ? s.continent_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-5 text-right font-mono text-muted">{s ? s.country_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold">
                  {a ? (
                    <span className="flex items-center justify-end gap-1.5">
                      {al && <RecBadge level={al} />}
                      {fmtAvg(a.best, id)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{a ? a.world_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted">{a ? a.continent_rank.toLocaleString() : '—'}</td>
                <td className="py-1.5 pr-1 text-right font-mono text-muted">{a ? a.country_rank.toLocaleString() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Result row (shared) ───────────────────────────────────────────────────────

function ResultRow({
  label, sublabel, pos, best, avg, eventId,
  singleRec, avgRec, showEvent,
}: {
  label: string; sublabel?: string;
  pos: number | null; best: number; avg: number; eventId: string;
  singleRec?: string | null; avgRec?: string | null;
  showEvent?: boolean;
}) {
  const sr = (singleRec as RecordLevel) ?? null;
  const ar = (avgRec as RecordLevel) ?? null;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 gap-y-0 py-2 px-3 border-b border-gray-100 dark:border-border/40 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {showEvent && <EventIcon eventId={eventId} size={14} />}
          <span className="font-medium text-sm truncate">{label}</span>
        </div>
        {sublabel && <div className="text-xs text-muted mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-xs text-muted font-mono text-right hidden sm:block">
        {pos != null ? `#${pos}` : '—'}
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1.5 font-mono text-sm font-semibold">
          {sr && <RecBadge level={sr} />}
          <span>{best > 0 ? fmtCs(best, eventId) : 'DNF'}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1.5 font-mono text-sm text-muted">
          {ar && <RecBadge level={ar} />}
          <span>{fmtAvg(avg, eventId)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Column headers for result sections ───────────────────────────────────────

function ResultHeader({ showEvent }: { showEvent?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 py-1.5 px-3 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-white/[0.02]">
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
        {showEvent ? 'Event' : 'Round'}
      </div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide text-right hidden sm:block">#</div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide text-right">Single</div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide text-right">Average</div>
    </div>
  );
}

// ── By Competition view ───────────────────────────────────────────────────────

function ByCompetition({ results }: { results: CompResult[] }) {
  const byComp = new Map<string, { name: string; date: string; rows: CompResult[] }>();
  for (const r of results) {
    const id = getCompId(r);
    if (!byComp.has(id)) byComp.set(id, { name: getCompName(r), date: getDate(r), rows: [] });
    byComp.get(id)!.rows.push(r);
  }
  const comps = Array.from(byComp.values()).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      {comps.map((comp) => (
        <div key={comp.name} className="card overflow-hidden">
          <div className="px-4 py-3 flex items-baseline justify-between gap-4 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-white/[0.03]">
            <span className="font-semibold text-sm truncate">{comp.name}</span>
            {comp.date && <span className="text-xs text-muted shrink-0">{formatDate(comp.date)}</span>}
          </div>
          <ResultHeader showEvent />
          {comp.rows
            .sort((a, b) => EVENT_ORDER.indexOf(getEventId(a)) - EVENT_ORDER.indexOf(getEventId(b)))
            .map((r, i) => (
              <ResultRow
                key={i}
                label={EVENT_NAMES[getEventId(r)] ?? getEventId(r)}
                sublabel={getRound(r)}
                pos={r.pos}
                best={r.best}
                avg={r.average}
                eventId={getEventId(r)}
                singleRec={r.regional_single_record}
                avgRec={r.regional_average_record}
                showEvent
              />
            ))}
        </div>
      ))}
    </div>
  );
}

// ── By Event view ─────────────────────────────────────────────────────────────

function ByEvent({ results }: { results: CompResult[] }) {
  const byEvent = new Map<string, CompResult[]>();
  for (const r of results) {
    const id = getEventId(r);
    if (!byEvent.has(id)) byEvent.set(id, []);
    byEvent.get(id)!.push(r);
  }
  const events = EVENT_ORDER.filter((id) => byEvent.has(id));

  return (
    <div className="space-y-3">
      {events.map((eventId) => {
        const rows = byEvent.get(eventId)!.sort((a, b) => getDate(b).localeCompare(getDate(a)));
        return (
          <div key={eventId} className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-200 dark:border-border bg-gray-50/50 dark:bg-white/[0.03]">
              <EventIcon eventId={eventId} size={18} />
              <span className="font-semibold text-sm">{EVENT_NAMES[eventId] ?? eventId}</span>
              <span className="text-xs text-muted ml-auto">{rows.length} result{rows.length !== 1 ? 's' : ''}</span>
            </div>
            <ResultHeader />
            {rows.map((r, i) => {
              const date = getDate(r);
              return (
                <ResultRow
                  key={i}
                  label={getCompName(r)}
                  sublabel={getRound(r) + (date ? ` · ${formatDate(date)}` : '')}
                  pos={r.pos}
                  best={r.best}
                  avg={r.average}
                  eventId={eventId}
                  singleRec={r.regional_single_record}
                  avgRec={r.regional_average_record}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { user } = useAuth();
  const wcaId = user?.wcaId;
  const [view, setView] = useState<'competition' | 'event'>('competition');

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
        <p className="text-muted text-sm">
          Log in with WCA OAuth to link your official results.
        </p>
      </div>
    );
  }

  if (personLoading) return <div className="p-8 text-muted text-center text-sm">Loading results…</div>;
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

      {/* ── Profile header ── */}
      <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {person.avatar?.thumb_url ? (
          <img src={person.avatar.thumb_url} alt={person.name}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-border shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-card-hover flex items-center justify-center shrink-0">
            <Icon name="user" size={24} className="text-muted" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-xl font-bold">{person.name}</h1>
            <span className="font-mono text-accent text-sm font-semibold">{person.wca_id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted mt-1">
            <span>{person.country_iso2}</span>
            <span className="text-border">·</span>
            <span>{competition_count} competition{competition_count !== 1 ? 's' : ''}</span>
            {(medals.gold + medals.silver + medals.bronze) > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-2">
                  {medals.gold   > 0 && <span>🥇 {medals.gold}</span>}
                  {medals.silver > 0 && <span>🥈 {medals.silver}</span>}
                  {medals.bronze > 0 && <span>🥉 {medals.bronze}</span>}
                </span>
              </>
            )}
            {(records.world + records.continental + records.national) > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1.5">
                  {records.world       > 0 && <RecBadge level="WR" />}
                  {records.continental > 0 && <RecBadge level="CR" />}
                  {records.national    > 0 && <RecBadge level="NR" />}
                </span>
              </>
            )}
          </div>
        </div>

        <a href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors shrink-0">
          <Icon name="external" size={13} />
          WCA Profile
        </a>
      </div>

      {/* ── Personal Records ── */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Personal Records</h2>
        <PRTable records={personal_records} />
      </div>

      {/* ── Competition Results ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Competition Results</h2>
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => setView('competition')}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                view === 'competition'
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-card-hover',
              )}
            >
              By Competition
            </button>
            <button
              onClick={() => setView('event')}
              className={clsx(
                'px-3 py-1.5 border-l border-gray-200 dark:border-border transition-colors',
                view === 'event'
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-card-hover',
              )}
            >
              By Event
            </button>
          </div>
        </div>

        {resultsLoading ? (
          <div className="card p-6 text-center text-sm text-muted">Loading competition history…</div>
        ) : resultsData && resultsData.length > 0 ? (
          view === 'competition'
            ? <ByCompetition results={resultsData} />
            : <ByEvent results={resultsData} />
        ) : (
          <div className="card p-4 flex items-center justify-between text-sm">
            <span className="text-muted">Full competition history available on the WCA website.</span>
            <a href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-accent hover:underline text-xs ml-4 shrink-0">
              View on WCA <Icon name="external" size={12} />
            </a>
          </div>
        )}
      </div>

    </div>
  );
}
