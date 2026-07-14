import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { formatTime } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { getSet, type AlgSet } from '../../data/algSets';
import { useAlgTrainerData } from './useAlgTrainerData';
import { statsByCase, statsKey, summarize } from './algStats';
import { CaseThumb } from './CaseThumb';
import { AlgSolveDetail } from './AlgSolveDetail';
import { joinSetSlugs, parseSetSlugs } from './algUrls';

export default function AlgStatsPage() {
  const { puzzle, setId: setSlug } = useParams<{ puzzle: string; setId: string }>();
  const navigate = useNavigate();
  const { solvePrecision } = useSettings();
  // A Trainer session can combine several sets — the URL joins their slugs
  // with "+" (see algUrls.ts) — so Stats needs to pool all of them too,
  // not just resolve one. This is the actual fix for the old "Stats only
  // shows one of the sets you were training" bug: previously the Trainer's
  // Stats button linked to whichever set the *currently displayed* case
  // happened to belong to, and this page only ever parsed a single setId
  // out of the URL to begin with.
  const setIds = useMemo(() => parseSetSlugs(setSlug), [setSlug]);
  const sets = useMemo(
    () => setIds.map((id) => getSet(id)).filter((s): s is AlgSet => Boolean(s)),
    [setIds],
  );
  // Only used to route each pooled case's thumbnail to its own set — actual
  // stats grouping below never trusts bare caseId alone (see algStats.ts's
  // statsKey), so even a hypothetical id collision here would misroute a
  // diagram, not corrupt data.
  const caseSetId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sets) for (const c of s.cases) map[c.id] = s.id;
    return map;
  }, [sets]);
  const data = useAlgTrainerData(setIds);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const caseStats = useMemo(() => statsByCase(data.solves), [data.solves]);
  const summary = useMemo(() => summarize(data.solves), [data.solves]);

  const rows = useMemo(() => {
    return sets.flatMap((s) => s.cases)
      .map((c) => ({ c, stats: caseStats.get(statsKey(caseSetId[c.id], c.id)) }))
      .filter((r): r is { c: typeof r.c; stats: NonNullable<typeof r.stats> } => !!r.stats);
  }, [sets, caseSetId, caseStats]);

  if (sets.length === 0) {
    return <PageHeader title="Stats" subtitle="Set not found." />;
  }

  const title = sets.map((s) => s.name).join(' + ');
  const backHref = `/algorithms/trainer/${puzzle}/${joinSetSlugs(setIds)}`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={() => navigate(backHref)} className="btn-ghost flex items-center gap-1">
          <Icon name="arrowLeft" size={14} /> Trainer
        </button>
        <span className="text-muted">/</span>
        <span className="font-semibold">{title} Stats</span>
      </div>

      <PageHeader
        title={`${title} Stats`}
        subtitle={`${summary.count} attempt${summary.count !== 1 ? 's' : ''} across ${summary.caseCount} case${summary.caseCount !== 1 ? 's' : ''}`}
      />

      {rows.length === 0 ? (
        <p className="text-muted text-sm text-center py-12">No attempts yet — start training to build up per-case stats.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(({ c, stats }) => {
            const globalIndex = stats.pb ? data.solves.findIndex((sv) => sv.id === stats.pb!.id) : -1;
            const cSet = getSet(caseSetId[c.id])!;
            return (
              <button
                key={statsKey(caseSetId[c.id], c.id)}
                onClick={() => globalIndex >= 0 && setDetailIndex(globalIndex)}
                disabled={globalIndex < 0}
                className="card card-interactive p-4 flex items-center gap-3 text-left disabled:cursor-default disabled:hover:border-border disabled:hover:shadow-sm disabled:hover:shadow-black/20 disabled:hover:translate-y-0"
              >
                <div className="shrink-0"><CaseThumb c={c} set={cSet} size={48} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted">
                    {stats.count} attempt{stats.count !== 1 ? 's' : ''}
                    {sets.length > 1 && <> · {cSet.name}</>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold text-accent">
                    {stats.pb ? formatTime(stats.pb.time, stats.pb.penalty, solvePrecision) : 'DNF'}
                  </div>
                  <div className="text-xs text-muted">PB</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detailIndex !== null && (
        <AlgSolveDetail
          open
          onClose={() => setDetailIndex(null)}
          solves={data.solves}
          index={detailIndex}
          onUpdatePenalty={data.updatePenalty}
          onUpdateTime={data.updateTime}
          onDelete={data.deleteSolve}
        />
      )}
    </div>
  );
}
