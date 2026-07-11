import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { RotatingCaseDiagram, invertAlg } from '../../components/CubeDiagram';
import { PenaltyButtons } from '../timer/PenaltyButtons';
import { formatTime, type Penalty, type AlgSolveDTO } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { copyText } from '../../lib/clipboard';
import { parseTimeInput } from '../../lib/timeInput';
import { getSet } from '../../data/algSets';
import { IS_2x2, rotatingStickering } from './algDiagram';

export function AlgSolveDetail({
  open,
  onClose,
  solves,
  index,
  onUpdatePenalty,
  onUpdateTime,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  solves: AlgSolveDTO[];
  index: number;
  onUpdatePenalty: (solveId: string, penalty: Penalty) => void;
  onUpdateTime: (solveId: string, time: number) => void;
  onDelete: (solveId: string) => void;
}) {
  const { solvePrecision } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const solve = solves[index];
  // Each solve carries its own setId (a session can mix cases from several
  // sets — see CaseSelector's multi-set support), so this resolves per-solve
  // rather than trusting a single set passed down from a parent.
  const set = solve ? getSet(solve.setId) : undefined;
  if (!solve || !set) return null;
  const c = set.cases.find((cc) => cc.id === solve.caseId);

  const total = solves.length;
  const editParsed = parseTimeInput(editValue, solvePrecision);

  function startEdit() {
    setEditValue(formatTime(solve.time, 'NONE', solvePrecision));
    setEditing(true);
  }

  function saveEdit() {
    if (!editParsed) return;
    onUpdateTime(solve.id, editParsed.time);
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
              disabled={!editParsed}
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
            <button
              onClick={startEdit}
              className="text-muted hover:text-accent transition-colors self-start mt-2"
              title="Edit time"
            >
              <Icon name="pencil" size={14} />
            </button>
          </div>
        )}
        <div className="text-xs text-muted mt-1">
          {c?.name ?? solve.caseId}
          <span className="mx-1.5">·</span>
          {new Date(solve.createdAt).toLocaleString()}
        </div>
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
              onClick={() => copyText(solve.scramble, 'Scramble copied')}
            >
              <Icon name="copy" size={12} /> copy
            </button>
          </div>
          <div className="font-mono text-sm bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-3 break-words">
            {solve.scramble || '—'}
          </div>
        </div>
        <div className="justify-self-center">
          <RotatingCaseDiagram
            alg={invertAlg(solve.scramble)}
            size={220}
            defaultLat={30}
            puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
            diagramPrefix={c?.diagramPrefix}
            stickering={rotatingStickering(set.kind)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 dark:border-border pt-3">
        <button
          className="btn-ghost"
          onClick={() => copyText(`${formatTime(solve.time, solve.penalty, solvePrecision)}   ${solve.scramble}`, 'Solve copied')}
        >
          <Icon name="copy" size={15} /> Copy solve
        </button>
        <button className="btn-ghost text-red-400 hover:text-red-300" onClick={del}>
          <Icon name="trash" size={15} /> Delete solve
        </button>
      </div>
    </Modal>
  );
}
