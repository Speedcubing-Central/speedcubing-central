import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { formatTime } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { getSet } from '../../data/algSets';
import { useAlgTrainerData } from './useAlgTrainerData';
import { statsByCase, summarize } from './algStats';
import { CaseThumb } from './CaseThumb';
import { AlgSolveDetail } from './AlgSolveDetail';
import { URL_TO_SET, SET_TO_URL } from './algUrls';

export default function AlgStatsPage() {
  const { puzzle, setId: setSlug } = useParams<{ puzzle: string; setId: string }>();
  const navigate = useNavigate();
  const { solvePrecision } = useSettings();
  const setId = setSlug ? URL_TO_SET[setSlug] ?? null : null;
  const set = setId ? getSet(setId) : null;
  const data = useAlgTrainerData(setId);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const caseStats = useMemo(() => statsByCase(data.solves), [data.solves]);
  const summary = useMemo(() => summarize(data.solves), [data.solves]);

  const rows = useMemo(() => {
    if (!set) return [];
    return set.cases
      .map((c) => ({ c, stats: caseStats.get(c.id) }))
      .filter((r): r is { c: typeof r.c; stats: NonNullable<typeof r.stats> } => !!r.stats);
  }, [set, caseStats]);

  if (!set || !setId) {
    return <PageHeader title="Stats" subtitle="Set not found." />;
  }

  const backHref = `/algorithms/trainer/${puzzle}/${SET_TO_URL[setId] ?? setId.toLowerCase()}`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={() => navigate(backHref)} className="btn-ghost flex items-center gap-1">
          <Icon name="arrowLeft" size={14} /> Trainer
        </button>
        <span className="text-muted">/</span>
        <span className="font-semibold">{set.name} Stats</span>
      </div>

      <PageHeader
        title={`${set.name} Stats`}
        subtitle={`${summary.count} attempt${summary.count !== 1 ? 's' : ''} across ${summary.caseCount} case${summary.caseCount !== 1 ? 's' : ''}`}
      />

      {rows.length === 0 ? (
        <p className="text-muted text-sm text-center py-12">No attempts yet — start training to build up per-case stats.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(({ c, stats }) => {
            const globalIndex = stats.pb ? data.solves.findIndex((sv) => sv.id === stats.pb!.id) : -1;
            return (
              <button
                key={c.id}
                onClick={() => globalIndex >= 0 && setDetailIndex(globalIndex)}
                disabled={globalIndex < 0}
                className="card p-4 flex items-center gap-3 text-left hover:border-accent/50 transition-colors disabled:cursor-default disabled:hover:border-border"
              >
                <div className="shrink-0"><CaseThumb c={c} set={set} size={48} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted">{stats.count} attempt{stats.count !== 1 ? 's' : ''}</div>
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
          setId={setId}
          onUpdatePenalty={data.updatePenalty}
          onUpdateTime={data.updateTime}
          onDelete={data.deleteSolve}
        />
      )}
    </div>
  );
}
