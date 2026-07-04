import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { ScrambleImage } from '../../components/ScrambleImage';
import { PenaltyButtons } from './PenaltyButtons';
import { formatTime, normalizeScramble, type Penalty, type SolveDTO } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { copyText, formatSolveCopy } from './copy';
import { averagesForSolve, type SolveAverage } from './stats';

function parseEditTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let ms: number;
  if (s.includes(':')) {
    const [m, rest] = s.split(':');
    ms = (parseInt(m, 10) * 60 + parseFloat(rest)) * 1000;
  } else {
    ms = parseFloat(s) * 1000;
  }
  return isNaN(ms) || ms <= 0 ? null : Math.round(ms);
}

export function SolveDetail({
  open,
  onClose,
  solves,
  index,
  event,
  onUpdatePenalty,
  onUpdateTime,
  onDelete,
  onOpenAverage,
}: {
  open: boolean;
  onClose: () => void;
  solves: SolveDTO[];
  index: number;
  event: string;
  onUpdatePenalty: (solveId: string, penalty: Penalty) => void;
  onUpdateTime?: (solveId: string, time: number) => void;
  onDelete: (solveId: string) => void;
  onOpenAverage: (view: SolveAverage) => void;
}) {
  const { solvePrecision } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const solve = solves[index];
  if (!solve) return null;

  const total = solves.length;
  const averages = averagesForSolve(solves, index);
  const editValid = parseEditTime(editValue) !== null;

  function startEdit() {
    setEditValue(formatTime(solve.time, 'NONE', solvePrecision));
    setEditing(true);
  }

  function saveEdit() {
    const parsed = parseEditTime(editValue);
    if (parsed === null) return;
    onUpdateTime!(solve.id, parsed);
    setEditing(false);
  }

  function del() {
    if (confirm('Delete this solve? This cannot be undone.')) {
      onDelete(solve.id);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Solve #${total - index}`} size="md">
      <div className="text-center mb-4">
        {editing ? (
          <div className="flex items-center justify-center gap-2">
            <input
              className="input font-mono text-center text-3xl w-36"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <button
              onClick={saveEdit}
              disabled={!editValid}
              className="text-green-500 hover:text-green-400 disabled:text-muted disabled:cursor-not-allowed transition-colors"
              title="Save"
            >
              <Icon name="check" size={18} />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted hover:text-primary transition-colors"
              title="Cancel"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className="font-mono text-5xl font-bold">{formatTime(solve.time, solve.penalty, solvePrecision)}</div>
            {onUpdateTime && (
              <button
                onClick={startEdit}
                className="text-muted hover:text-accent transition-colors self-start mt-2"
                title="Edit time"
              >
                <Icon name="pencil" size={14} />
              </button>
            )}
          </div>
        )}
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
                className="rounded-lg border border-gray-200 dark:border-border px-3 py-1.5 text-sm hover:border-accent"
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

      <div className="flex items-center justify-between border-t border-gray-200 dark:border-border pt-3">
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
