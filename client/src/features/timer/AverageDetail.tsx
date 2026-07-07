import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { formatTime } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { formatScrambleForCopy } from '../../lib/scramble';
import { copyText, formatAverageCopy } from './copy';
import type { SolveAverage } from './stats';

// Detailed view of one average: all member solves + scrambles, with a copy button.
export function AverageDetail({ view, event, onClose }: { view: SolveAverage; event: string; onClose: () => void }) {
  const { solvePrecision } = useSettings();
  const value = view.value === null ? '—' : !isFinite(view.value) ? 'DNF' : formatTime(Math.round(view.value), 'NONE', solvePrecision);

  const label = view.size === 3 ? 'mo3' : `ao${view.size}`;

  return (
    <Modal open onClose={onClose} title={`${label} — ${value}`} size="lg">
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => copyText(formatAverageCopy(view, event, solvePrecision), 'Average copied')}>
          <Icon name="copy" size={15} /> Copy average
        </button>
      </div>
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
        {view.window.map((s, i) => {
          const dropped = view.droppedIndices.includes(i);
          return (
            <div
              key={s.id}
              className={`grid grid-cols-[28px_72px_1fr] items-baseline gap-2 rounded-lg border border-gray-200 dark:border-border px-3 py-2 ${dropped ? 'opacity-50' : ''}`}
            >
              <span className="text-muted text-xs">{i + 1}.</span>
              <span className="font-mono">
                {dropped ? '(' : ''}
                {formatTime(s.time, s.penalty, solvePrecision)}
                {dropped ? ')' : ''}
              </span>
              <span className="font-mono text-xs text-muted break-words">{formatScrambleForCopy(s.scramble, event) || '—'}</span>
            </div>
          );
        })}
      </div>
      {view.droppedIndices.length > 0 && (
        <p className="text-xs text-muted mt-3">Dropped solves (best &amp; worst) are dimmed and shown in parentheses.</p>
      )}
    </Modal>
  );
}
