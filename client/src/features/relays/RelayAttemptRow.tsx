import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { formatTime } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { Icon } from '../../components/Icon';

// A single relay-attempt history row with inline edit (pencil -> input +
// check/x, mirrors Timer's SolveDetail time-edit pattern) and delete —
// shared between RelaysPage's cross-relay "Recent Attempts" list and
// SoloRelayRunner's own per-relay History panel.
export function RelayAttemptRow({
  totalTimeMs,
  isBest,
  leading,
  onSave,
  onDelete,
}: {
  totalTimeMs: number;
  isBest?: boolean;
  leading: ReactNode;
  onSave: (newTimeMs: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  function startEdit() {
    setValue(formatTime(totalTimeMs, 'NONE', 2));
    setEditing(true);
  }

  function save() {
    // No penalty concept for a relay total — plain time only.
    const parsed = parseTimeInput(value, 2);
    if (!parsed || parsed.penalty !== 'NONE' || parsed.plusTwoCount > 0) return;
    onSave(parsed.time);
    setEditing(false);
  }

  function del() {
    if (confirm('Delete this attempt? This cannot be undone.')) onDelete();
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card-hover/50 px-3 py-2 text-sm">
      <div className="flex-1 min-w-0 truncate">{leading}</div>
      {editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            className="input font-mono text-center text-sm w-24 py-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button className="text-green-500 hover:text-green-400 p-1" title="Save" onClick={save}>
            <Icon name="check" size={15} />
          </button>
          <button className="text-muted hover:text-gray-700 dark:hover:text-gray-200 p-1" title="Cancel" onClick={() => setEditing(false)}>
            <Icon name="x" size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span className={clsx('font-mono', isBest && 'text-accent font-bold')}>{formatTime(totalTimeMs, 'NONE', 2)}</span>
          <button className="text-muted hover:text-accent p-1.5" title="Edit time" onClick={startEdit}>
            <Icon name="pencil" size={13} />
          </button>
          <button className="text-muted hover:text-red-400 p-1.5" title="Delete" onClick={del}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
