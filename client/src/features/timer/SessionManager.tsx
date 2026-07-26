import { useState } from 'react';
import clsx from 'clsx';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { formatTime, getEvent, SUBSET_EVENTS } from '@scc/shared';
import { toast } from '../../store/toast';
import type { useTimerData } from './useTimerData';

type Data = ReturnType<typeof useTimerData>;

const SUBSET_NAME: Record<string, string> = Object.fromEntries(SUBSET_EVENTS.map((e) => [e.id, e.name]));

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SessionManager({ open, onClose, data, event }: { open: boolean; onClose: () => void; data: Data; event: string }) {
  const [newName, setNewName] = useState('');
  const [newSubset, setNewSubset] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function add() {
    const name = newName.trim() || `${getEvent(event)?.name ?? event} Session`;
    await data.createSession(name, newSubset || undefined);
    setNewName('');
    setNewSubset('');
    toast.success('Session created');
  }

  async function saveRename(id: string) {
    if (editName.trim()) await data.renameSession(id, editName.trim());
    setEditingId(null);
  }

  async function remove(id: string, name: string) {
    if (confirm(`Delete session "${name}" and all its solves? This cannot be undone.`)) {
      await data.deleteSession(id);
      toast.info('Session deleted');
    }
  }

  async function exportSession(id: string, name: string) {
    const solves = await data.getSolves(id);
    if (solves.length === 0) {
      toast.error('That session has no solves to export');
      return;
    }
    const rows: string[][] = [['No.', 'Time (ms)', 'Penalty', 'Plus2Count', 'Result', 'Scramble', 'Date']];
    const ordered = [...solves].reverse(); // oldest first
    ordered.forEach((s, i) => {
      rows.push([
        String(i + 1),
        String(s.time),
        s.penalty,
        String(s.plusTwoCount),
        formatTime(s.time, s.penalty, 2, s.plusTwoCount),
        s.scramble,
        new Date(s.createdAt).toISOString(),
      ]);
    });
    downloadCsv(`${name.replace(/[^a-z0-9]+/gi, '_')}_${event}.csv`, rows);
    toast.success('Session exported');
  }

  return (
    <Modal open={open} onClose={onClose} title="Session Manager" size="md">
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder={`New ${getEvent(event)?.name ?? event} session name…`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        {event === '333' && (
          <select className="input max-w-[110px]" value={newSubset} onChange={(e) => setNewSubset(e.target.value)}>
            <option value="">Normal</option>
            {SUBSET_EVENTS.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <button className="btn-primary" onClick={add}>
          <Icon name="plus" size={16} /> Add
        </button>
      </div>

      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
        {data.sessions.length === 0 && <p className="text-muted text-sm text-center py-6">No sessions yet for this event.</p>}
        {data.sessions.map((sess) => {
          const active = sess.id === data.currentId;
          return (
            <div
              key={sess.id}
              className={clsx(
                'flex items-center gap-2 rounded-lg border px-3 py-2',
                active ? 'border-accent bg-accent/10' : 'border-border',
              )}
            >
              {editingId === sess.id ? (
                <input
                  autoFocus
                  className="input py-1 flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(sess.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => saveRename(sess.id)}
                />
              ) : (
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => {
                    data.setCurrentId(sess.id);
                    onClose();
                  }}
                >
                  <span className="font-medium truncate">
                    {sess.name}
                    {sess.subset && <span className="text-accent"> ({SUBSET_NAME[sess.subset] ?? sess.subset})</span>}
                  </span>
                  <span className="text-xs text-muted ml-2">{sess.solveCount ?? 0} solves</span>
                  {active && <span className="text-xs text-accent ml-2">active</span>}
                </button>
              )}
              <button
                className="text-muted hover:text-gray-100 p-1"
                title="Rename"
                onClick={() => {
                  setEditingId(sess.id);
                  setEditName(sess.name);
                }}
              >
                <Icon name="gear" size={16} />
              </button>
              <button className="text-muted hover:text-accent p-1" title="Export CSV" onClick={() => exportSession(sess.id, sess.name)}>
                <Icon name="external" size={16} />
              </button>
              <button className="text-muted hover:text-red-400 p-1" title="Delete" onClick={() => remove(sess.id, sess.name)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
