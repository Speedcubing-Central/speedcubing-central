import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Modal } from '../../components/Modal';
import { formatTime, type AlgSolveDTO, type Penalty } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { getSet } from '../../data/algSets';
import { statsByCase, summarize } from './algStats';
import { CaseThumb } from './CaseThumb';
import { AlgSolveDetail } from './AlgSolveDetail';

export function AlgStatsModal({
  open,
  onClose,
  setId,
  solves,
  onUpdatePenalty,
  onUpdateTime,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  setId: string;
  solves: AlgSolveDTO[];
  onUpdatePenalty: (solveId: string, penalty: Penalty) => void;
  onUpdateTime: (solveId: string, time: number) => void;
  onDelete: (solveId: string) => void;
}) {
  const { solvePrecision } = useSettings();
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const set = getSet(setId);

  const caseStats = useMemo(() => statsByCase(solves), [solves]);
  const summary = useMemo(() => summarize(solves), [solves]);

  const rows = useMemo(() => {
    if (!set) return [];
    return set.cases
      .map((c) => ({ c, stats: caseStats.get(c.id) }))
      .filter((r) => r.stats);
  }, [set, caseStats]);

  if (!set) return null;

  return (
    <>
      <Modal open={open && detailIndex === null} onClose={onClose} title={`${set.name} Stats`} size="lg">
        <div className="text-sm text-muted mb-4">
          {summary.count} attempt{summary.count !== 1 ? 's' : ''} across {summary.caseCount} case{summary.caseCount !== 1 ? 's' : ''}
        </div>

        {rows.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No attempts yet — start training to build up per-case stats.</p>
        ) : (
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Per-case PBs</div>
            <div className="max-h-[35vh] overflow-y-auto divide-y divide-border/60 border border-border rounded-lg">
              {rows.map(({ c, stats }) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="shrink-0"><CaseThumb c={c} set={set} size={40} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted">{stats!.count} attempt{stats!.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-semibold text-accent">
                      {stats!.pb ? formatTime(stats!.pb.time, stats!.pb.penalty, solvePrecision) : 'DNF'}
                    </div>
                    <div className="text-xs text-muted">PB</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">All solves</div>
          {solves.length === 0 ? (
            <p className="text-muted text-sm">No solves yet.</p>
          ) : (
            <div className="max-h-[35vh] overflow-y-auto divide-y divide-border/60 border border-border rounded-lg">
              {solves.map((s, i) => {
                const c = set.cases.find((cc) => cc.id === s.caseId);
                return (
                  <button
                    key={s.id}
                    onClick={() => setDetailIndex(i)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-card-hover transition-colors"
                  >
                    <span className="text-xs text-muted w-8 text-right shrink-0">{solves.length - i}.</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{c?.name ?? s.caseId}</span>
                    <span className={clsx('font-mono text-sm font-semibold', s.penalty === 'DNF' && 'text-red-400')}>
                      {formatTime(s.time, s.penalty, solvePrecision)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {detailIndex !== null && (
        <AlgSolveDetail
          open
          onClose={() => setDetailIndex(null)}
          solves={solves}
          index={detailIndex}
          setId={setId}
          onUpdatePenalty={onUpdatePenalty}
          onUpdateTime={onUpdateTime}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
