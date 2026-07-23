import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Modal } from '../../components/Modal';
import { getEvent } from '@scc/shared';
import { toast } from '../../store/toast';
import { parseCstimerExport, anchorImportTimestamps, type CstimerParsedSession } from '../../lib/cstimerImport';
import type { useTimerData } from './useTimerData';

type Data = ReturnType<typeof useTimerData>;

const pill = (active: boolean) =>
  clsx(
    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
    active
      ? 'border-accent bg-accent/10 text-accent'
      : 'border-gray-200 dark:border-border text-muted hover:text-gray-700 dark:hover:text-gray-100',
  );

export function ImportCstimerModal({ open, onClose, data, event }: { open: boolean; onClose: () => void; data: Data; event: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [allSessions, setAllSessions] = useState<CstimerParsedSession[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [destMode, setDestMode] = useState<'new' | 'existing'>('new');
  const [newName, setNewName] = useState('');
  const [destSessionId, setDestSessionId] = useState('');
  const [position, setPosition] = useState<'beginning' | 'end'>('end');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const matching = useMemo(() => (allSessions ?? []).filter((s) => s.eventId === event), [allSessions, event]);
  const skippedCount = (allSessions?.length ?? 0) - matching.length;
  const selected = matching.find((s) => s.key === selectedKey) ?? null;

  function reset() {
    setFileName('');
    setAllSessions(null);
    setParseError('');
    setSelectedKey(null);
    setDestMode('new');
    setNewName('');
    setDestSessionId('');
    setPosition('end');
    setImporting(false);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function close() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(f: File) {
    setFileName(f.name);
    setParseError('');
    setAllSessions(null);
    setSelectedKey(null);
    try {
      const text = await f.text();
      const parsed = parseCstimerExport(text);
      if (parsed.length === 0) throw new Error('No importable solves found in this file.');
      setAllSessions(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Couldn't read this file. Is it a cstimer export?");
    }
  }

  async function doImport() {
    if (!selected) return;
    if (destMode === 'new' && !newName.trim()) {
      toast.error('Name the new session');
      return;
    }
    if (destMode === 'existing' && !destSessionId) {
      toast.error('Pick a session to import into');
      return;
    }

    setImporting(true);
    setProgress({ done: 0, total: selected.solves.length });
    try {
      let sessionId: string;
      let entries = selected.solves;
      if (destMode === 'new') {
        const created = await data.createSession(newName.trim());
        sessionId = created.id;
      } else {
        sessionId = destSessionId;
        const existingSolves = await data.getSolves(sessionId);
        entries = anchorImportTimestamps(selected.solves, position, existingSolves);
      }
      await data.importSolves(sessionId, entries, (done, total) => setProgress({ done, total }));
      toast.success(`Imported ${selected.solves.length} solve${selected.solves.length !== 1 ? 's' : ''}`);
      reset();
      onClose();
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Import from CSTimer" size="md">
      <div className="flex flex-col gap-4">
        <div>
          <div className="label mb-2">Export file (.txt)</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-sm file:mr-3 file:btn-ghost file:border-0 file:cursor-pointer"
          />
          {fileName && <p className="text-xs text-muted mt-1.5">{fileName}</p>}
          {parseError && <p className="text-xs text-red-400 mt-1.5">{parseError}</p>}
        </div>

        {allSessions && matching.length === 0 && (
          <p className="text-sm text-muted">
            No {getEvent(event)?.name ?? event} sessions were found in this file. Switch events above and reopen this dialog to import a different event.
          </p>
        )}

        {matching.length > 0 && (
          <div>
            <div className="label mb-2">CSTimer session ({getEvent(event)?.name ?? event})</div>
            {skippedCount > 0 && (
              <p className="text-xs text-muted mb-2">
                {skippedCount} other session{skippedCount !== 1 ? 's' : ''} in this file {skippedCount !== 1 ? 'use' : 'uses'} a different event or an
                unsupported scramble type and won't show here.
              </p>
            )}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {matching.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSelectedKey(s.key);
                    setNewName(s.name.replace(/^[^\w]*/, '').trim() || s.name);
                  }}
                  disabled={importing}
                  className={clsx(
                    'text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                    selectedKey === s.key
                      ? 'border-accent bg-accent/10'
                      : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-gray-500',
                  )}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted ml-2">
                    {s.solves.length} solve{s.solves.length !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <>
            <div>
              <div className="label mb-2">Import into</div>
              <div className="flex gap-2 mb-2">
                <button className={pill(destMode === 'new')} onClick={() => setDestMode('new')} disabled={importing}>
                  New session
                </button>
                <button
                  className={pill(destMode === 'existing')}
                  onClick={() => setDestMode('existing')}
                  disabled={importing || data.sessions.length === 0}
                  title={data.sessions.length === 0 ? `No existing ${getEvent(event)?.name ?? event} sessions yet` : undefined}
                >
                  Existing session
                </button>
              </div>
              {destMode === 'new' ? (
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Session name"
                  disabled={importing}
                />
              ) : (
                <select className="input" value={destSessionId} onChange={(e) => setDestSessionId(e.target.value)} disabled={importing}>
                  <option value="">Choose a session…</option>
                  {data.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.solveCount ?? 0})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {destMode === 'existing' && destSessionId && (
              <div>
                <div className="label mb-2">Position</div>
                <div className="flex gap-2">
                  {(['beginning', 'end'] as const).map((p) => (
                    <button key={p} className={pill(position === p)} onClick={() => setPosition(p)} disabled={importing}>
                      {p === 'beginning' ? 'Add to beginning' : 'Add to end'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1.5">
                  {position === 'beginning'
                    ? "Imported solves will be dated before this session's earliest solve."
                    : "Imported solves will be dated after this session's most recent solve."}
                </p>
              </div>
            )}

            <button className="btn-primary" onClick={doImport} disabled={importing}>
              {importing
                ? progress
                  ? `Importing… ${progress.done}/${progress.total}`
                  : 'Importing…'
                : `Import ${selected.solves.length} solve${selected.solves.length !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
