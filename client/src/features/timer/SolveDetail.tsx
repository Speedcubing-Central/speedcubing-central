import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { ScrambleImage } from '../../components/ScrambleImage';
import { PenaltyButtons } from './PenaltyButtons';
import { formatTime, normalizeScramble, type Penalty, type SolveDTO } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { copyText, formatSolveCopy } from './copy';
import { averagesForSolve, type SolveAverage } from './stats';

export function SolveDetail({
  open,
  onClose,
  solves,
  index,
  event,
  onUpdatePenalty,
  onDelete,
  onOpenAverage,
}: {
  open: boolean;
  onClose: () => void;
  solves: SolveDTO[];
  index: number;
  event: string;
  onUpdatePenalty: (solveId: string, penalty: Penalty) => void;
  onDelete: (solveId: string) => void;
  onOpenAverage: (view: SolveAverage) => void;
}) {
  const { solvePrecision } = useSettings();
  const solve = solves[index];
  if (!solve) return null;

  const total = solves.length;
  const averages = averagesForSolve(solves, index);

  function del() {
    if (confirm('Delete this solve? This cannot be undone.')) {
      onDelete(solve.id);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Solve #${total - index}`} size="md">
      <div className="text-center mb-4">
        <div className="font-mono text-5xl font-bold">{formatTime(solve.time, solve.penalty, solvePrecision)}</div>
        <div className="text-xs text-muted mt-1">{new Date(solve.createdAt).toLocaleString()}</div>
      </div>

      <div className="flex justify-center mb-5">
        <PenaltyButtons penalty={solve.penalty} onChange={(p) => onUpdatePenalty(solve.id, p)} />
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center mb-5">
        <div>
          <div className="label flex items-center justify-between">
            Scramble
            <button
              className="text-accent hover:underline inline-flex items-center gap-1"
              onClick={() => copyText(normalizeScramble(solve.scramble), 'Scramble copied')}
            >
              <Icon name="copy" size={12} /> copy
            </button>
          </div>
          <div className="font-mono text-sm bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-3 break-words">
            {normalizeScramble(solve.scramble) || '—'}
          </div>
        </div>
        <div className="justify-self-center">
          <ScrambleImage eventId={event} scramble={solve.scramble} />
        </div>
      </div>

      {averages.length > 0 && (
        <div className="mb-4">
          <div className="label">Averages at this solve</div>
          <div className="flex flex-wrap gap-2">
            {averages.map((a) => (
              <button
                key={a.size}
                onClick={() => onOpenAverage(a)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent"
              >
                <span className="text-muted">{a.size === 3 ? 'mo3' : `ao${a.size}`}: </span>
                <span className="font-mono">
                  {a.value === null ? '—' : !isFinite(a.value) ? 'DNF' : formatTime(Math.round(a.value), 'NONE', solvePrecision)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <button className="btn-ghost" onClick={() => copyText(formatSolveCopy(solve, solvePrecision), 'Solve copied')}>
          <Icon name="copy" size={15} /> Copy solve
        </button>
        <button className="btn-ghost text-red-400 hover:text-red-300" onClick={del}>
          <Icon name="trash" size={15} /> Delete solve
        </button>
      </div>
    </Modal>
  );
}
