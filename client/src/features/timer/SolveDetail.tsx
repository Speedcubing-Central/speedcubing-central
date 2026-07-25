import { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { ScrambleImage } from '../../components/ScrambleImage';
import { PenaltyButtons } from './PenaltyButtons';
import { formatTime, formatMoveCount, type Penalty, type SolveDTO } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { formatScrambleForCopy } from '../../lib/scramble';
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

// FMC's stored `time` is a move count, not milliseconds — editing it needs
// a plain whole number, not the mm:ss.cc parsing every other event uses.
function parseEditMoveCount(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? n : null;
}

// The scramble diagram shrinks (never crops) to whatever's left once
// everything else in the modal (time, penalty, solution, comment, averages)
// has taken what it needs — same shrink-to-fit convention as
// FmcScramblePanel's own diagram, so a deep session history (many average
// brackets) or an expanded FMC solution/comment never forces the modal to
// scroll, while an ordinary solve with little else to show still gets a
// nice big diagram instead of one shrunk for a worst case that isn't this one.
const PREFERRED_DIAGRAM = 220;
const MIN_DIAGRAM = 90;
// Modal's own header + its p-5 body padding + the outer backdrop's p-8
// aren't measurable from here (Modal owns that DOM, not exposed via ref) —
// measured empirically at ~153px combined; rounded up for a small safety
// margin, since a little unused slack is harmless but an overflowing modal
// isn't.
const MODAL_CHROME = 160;

export function SolveDetail({
  open,
  onClose,
  solves,
  index,
  event,
  onUpdatePenalty,
  onUpdateTime,
  onUpdateComment,
  onDelete,
  onOpenAverage,
}: {
  open: boolean;
  onClose: () => void;
  solves: SolveDTO[];
  index: number;
  event: string;
  onUpdatePenalty: (solveId: string, penalty: Penalty, plusTwoCount: number) => void;
  onUpdateTime?: (solveId: string, time: number) => void;
  onUpdateComment: (solveId: string, comment: string) => void;
  onDelete: (solveId: string) => void;
  onOpenAverage: (view: SolveAverage) => void;
}) {
  const { solvePrecision } = useSettings();
  const isFmc = event === '333fm';
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [editingComment, setEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [diagramSize, setDiagramSize] = useState(PREFERRED_DIAGRAM);
  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRowRef = useRef<HTMLDivElement>(null);
  const textColRef = useRef<HTMLDivElement>(null);

  const solve = solves[index];
  const total = solves.length;
  const averages = solve ? averagesForSolve(solves, index) : [];
  const editValid = (isFmc ? parseEditMoveCount(editValue) : parseEditTime(editValue)) !== null;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const row = gridRowRef.current;
    const textCol = textColRef.current;
    if (!body || !row || !textCol) return;
    const recompute = () => {
      const textColHeight = textCol.getBoundingClientRect().height;
      const rowHeight = row.getBoundingClientRect().height;
      const otherHeight = body.scrollHeight - rowHeight;
      const budgetForRow = window.innerHeight - MODAL_CHROME - otherHeight;
      const next = Math.round(
        Math.max(MIN_DIAGRAM, Math.min(PREFERRED_DIAGRAM, Math.max(textColHeight, budgetForRow))),
      );
      setDiagramSize((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(body);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [solve?.id, showSolution, editingComment, solve?.comment, averages.length]);

  if (!solve) return null;

  function startEdit() {
    setEditValue(isFmc ? formatMoveCount(solve.time) : formatTime(solve.time, 'NONE', solvePrecision));
    setEditing(true);
  }

  function saveEdit() {
    const parsed = isFmc ? parseEditMoveCount(editValue) : parseEditTime(editValue);
    if (parsed === null) return;
    onUpdateTime!(solve.id, parsed);
    setEditing(false);
  }

  function startEditComment() {
    setCommentValue(solve.comment ?? '');
    setEditingComment(true);
  }

  function saveComment() {
    onUpdateComment(solve.id, commentValue);
    setEditingComment(false);
  }

  function del() {
    if (confirm('Delete this solve? This cannot be undone.')) {
      onDelete(solve.id);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Solve #${total - index}`} size="lg">
      <div ref={bodyRef}>
      <div className="text-center mb-3">
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
            <div className="font-mono text-4xl font-bold">
              {isFmc ? formatMoveCount(solve.time, solve.penalty) : formatTime(solve.time, solve.penalty, solvePrecision, solve.plusTwoCount)}
              {isFmc && solve.penalty !== 'DNF' && <span className="text-lg font-normal text-muted ml-1">moves</span>}
            </div>
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
        {/* FMC's plain move-count/DNF display above reads unambiguously on
            its own, but a small explicit status pill removes any doubt at a
            glance, matching how other pass/fail states are badged elsewhere
            in the app (e.g. relay participant readiness). */}
        {isFmc && !editing && (
          <span
            className={clsx(
              'inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full',
              solve.penalty === 'DNF' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400',
            )}
          >
            {solve.penalty === 'DNF' ? 'DNF' : 'OK'}
          </span>
        )}
        <div className="text-xs text-muted mt-1">{new Date(solve.createdAt).toLocaleString()}</div>
      </div>

      {/* FMC never gets a +2 (no time-based penalty concept), but the
          OK/DNF toggle itself stays — every FMC result now comes from the
          same solution checker or an explicit give-up/expiry, so there's no
          "was this actually verified" distinction left to gate on the way
          an earlier version of this feature needed to. */}
      <div className="flex justify-center mb-4">
        <PenaltyButtons
          penalty={solve.penalty}
          plusTwoCount={solve.plusTwoCount}
          onChange={(p, c) => onUpdatePenalty(solve.id, p, c)}
          hidePlus2={isFmc}
        />
      </div>

      <div ref={gridRowRef} className="grid sm:grid-cols-[1fr_auto] gap-4 items-center mb-4">
        <div ref={textColRef}>
          <div className="label flex items-center justify-between">
            Scramble
            <button
              className="text-accent hover:underline inline-flex items-center gap-1"
              onClick={() => copyText(formatScrambleForCopy(solve.scramble, event), 'Scramble copied')}
            >
              <Icon name="copy" size={12} /> copy
            </button>
          </div>
          <div className="font-mono text-sm bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-3 break-words">
            {formatScrambleForCopy(solve.scramble, event) || '—'}
          </div>
        </div>
        <div className="justify-self-center">
          <ScrambleImage eventId={event} scramble={solve.scramble} size={diagramSize} />
        </div>
      </div>

      {isFmc && (
        <div className="mb-4">
          <div className="label flex items-center justify-between">
            Solution
            {showSolution && solve.solution && (
              <button
                className="text-accent hover:underline inline-flex items-center gap-1"
                onClick={() => copyText(solve.solution!, 'Solution copied')}
              >
                <Icon name="copy" size={12} /> copy
              </button>
            )}
          </div>
          {showSolution ? (
            <div className="font-mono text-sm bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-2.5 break-words whitespace-pre-wrap">
              {solve.solution || 'No solution was recorded for this attempt (gave up or ran out of time).'}
            </div>
          ) : (
            <button className="btn-ghost text-sm" onClick={() => setShowSolution(true)}>
              View solution
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        {editingComment ? (
          <div>
            <div className="label">Comment</div>
            <textarea
              className="input font-mono text-sm w-full min-h-[60px] resize-none"
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingComment(false);
              }}
              maxLength={2000}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={saveComment}
                className="text-green-500 hover:text-green-400 transition-colors"
                title="Save"
              >
                <Icon name="check" size={18} />
              </button>
              <button
                onClick={() => setEditingComment(false)}
                className="text-muted hover:text-primary transition-colors"
                title="Cancel"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>
        ) : solve.comment ? (
          <div>
            <div className="label flex items-center justify-between">
              Comment
              <button
                className="text-accent hover:underline inline-flex items-center gap-1"
                onClick={startEditComment}
              >
                <Icon name="pencil" size={12} /> edit
              </button>
            </div>
            <div className="font-mono text-sm bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-2.5 break-words whitespace-pre-wrap">
              {solve.comment}
            </div>
          </div>
        ) : (
          <button
            className="text-muted hover:text-accent transition-colors inline-flex items-center gap-1 text-sm"
            onClick={startEditComment}
          >
            <Icon name="pencil" size={12} /> Add comment
          </button>
        )}
      </div>

      {averages.length > 0 && (
        <div className="mb-4">
          <div className="label">Averages at this solve</div>
          <div className="flex flex-wrap gap-2">
            {averages.map((a) => (
              <button
                key={a.size}
                onClick={() => onOpenAverage(a)}
                className="rounded-lg border border-gray-200 dark:border-border px-3 py-0.5 text-sm hover:border-accent"
              >
                <span className="text-muted">{a.size === 3 ? 'mo3' : `ao${a.size}`}: </span>
                <span className="font-mono">
                  {a.value === null
                    ? '—'
                    : !isFinite(a.value)
                      ? 'DNF'
                      : isFmc
                        ? formatMoveCount(a.value, 'NONE', 2)
                        : formatTime(Math.round(a.value), 'NONE', solvePrecision)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-200 dark:border-border pt-2">
        <button className="btn-ghost" onClick={() => copyText(formatSolveCopy(solve, event, solvePrecision), 'Solve copied')}>
          <Icon name="copy" size={15} /> Copy solve
        </button>
        <button className="btn-ghost text-red-400 hover:text-red-300" onClick={del}>
          <Icon name="trash" size={15} /> Delete solve
        </button>
      </div>
      </div>
    </Modal>
  );
}
