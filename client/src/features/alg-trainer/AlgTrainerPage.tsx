import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import '@cubing/icons';
import { PageHeader, Badge } from '../../components/ui';
import {
  OllDiagram, PllDiagram, CollDiagram, F2LDiagram, TwoByTwoDiagram,
  RotatingCaseDiagram, invertAlg, type StickeringKind,
} from '../../components/CubeDiagram';
import { ALG_SETS, getSet, type AlgCase, type AlgSet } from '../../data/algSets';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlgStatus = 'NEW' | 'LEARNING' | 'LEARNED';

interface AlgPref {
  caseId: string;
  status: AlgStatus;
  preferredAlg: string | null;
}

type PrefsMap = Record<string, AlgPref>;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useAlgPrefs(setId: string | null, isAuthed: boolean) {
  const [prefs, setPrefs] = useState<PrefsMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!setId || !isAuthed) return;
    setLoading(true);
    api.get<AlgPref[]>(`/alg/prefs/${setId}`)
      .then((r) => {
        const map: PrefsMap = {};
        for (const p of r.data) map[p.caseId] = p;
        setPrefs(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setId, isAuthed]);

  const upsert = useCallback(async (setId: string, caseId: string, patch: Partial<Pick<AlgPref, 'status' | 'preferredAlg'>>) => {
    try {
      const r = await api.put<AlgPref>('/alg/pref', { setId, caseId, ...patch });
      setPrefs((prev) => ({ ...prev, [caseId]: r.data }));
    } catch {}
  }, []);

  return { prefs, loading, upsert };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function CubingIcon({ event, className }: { event: string; className?: string }) {
  return <span className={clsx('cubing-icon', `event-${event}`, className)} />;
}

function twoByTwoStickering(kind: AlgSet['kind']): StickeringKind {
  return kind === '2x2-oll' ? '2x2-oll' : 'full';
}

function rotatingStickering(kind: AlgSet['kind']): StickeringKind {
  if (kind === 'oll') return 'oll';
  if (kind === 'pll') return 'pll';
  if (kind === 'coll') return 'coll';
  if (kind === 'f2l') return 'f2l';
  if (kind === '2x2-oll') return '2x2-oll';
  return 'full';
}

const IS_2x2 = (kind: AlgSet['kind']) => ['2x2-oll', '2x2-pbl', 'cll', 'eg1', 'eg2'].includes(kind);

function CaseImage({ c, set, size = 80, pref }: { c: AlgCase; set: AlgSet; size?: number; pref?: AlgPref }) {
  const alg = effectiveAlg(c, pref);
  if (set.kind === 'pll') return <PllDiagram alg={alg} size={size} />;
  if (set.kind === 'oll') return <OllDiagram alg={alg} size={size} />;
  if (set.kind === 'coll') return <CollDiagram alg={alg} size={size} />;
  if (IS_2x2(set.kind)) {
    return <TwoByTwoDiagram alg={alg} size={size} diagramPrefix={c.diagramPrefix} stickering={twoByTwoStickering(set.kind)} />;
  }
  return <F2LDiagram alg={alg} size={size} />;
}

function effectiveAlg(c: AlgCase, pref: AlgPref | undefined): string {
  return pref?.preferredAlg ?? c.moves;
}

const STATUS_LABELS: Record<AlgStatus, string> = { NEW: 'New', LEARNING: 'Learning', LEARNED: 'Done' };
const STATUS_COLORS: Record<AlgStatus, string> = {
  NEW: 'bg-gray-500/20 text-gray-400',
  LEARNING: 'bg-yellow-500/20 text-yellow-400',
  LEARNED: 'bg-green-500/20 text-green-500',
};

function StatusBadge({ status }: { status: AlgStatus }) {
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Puzzle pickers (shared between library and trainer)
// ---------------------------------------------------------------------------

const PUZZLES = [
  { id: '3x3', label: '3×3', event: '333', available: true },
  { id: '2x2', label: '2×2', event: '222', available: true },
  { id: 'sq1', label: 'Square-1', event: 'sq1', available: false },
  { id: 'minx', label: 'Megaminx', event: 'minx', available: false },
  { id: 'pyram', label: 'Pyraminx', event: 'pyram', available: false },
  { id: 'skewb', label: 'Skewb', event: 'skewb', available: false },
];

function PuzzleLanding({ subtitle, onSelect }: { subtitle: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <PageHeader title="Algorithms" subtitle={subtitle} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {PUZZLES.map((p) => (
          <button
            key={p.id}
            onClick={() => p.available && onSelect(p.id)}
            className={clsx(
              'card p-6 flex flex-col items-center gap-4 transition-colors text-center relative',
              p.available ? 'hover:border-accent/50 cursor-pointer' : 'opacity-60 cursor-not-allowed',
            )}
          >
            <CubingIcon event={p.event} className="text-[64px]" />
            <div>
              <div className="font-bold text-base">{p.label}</div>
              {!p.available && <div className="text-xs text-muted mt-1 font-medium">Coming Soon</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const SET_CARDS_3x3 = [
  { id: 'OLL',  label: 'OLL',  description: 'Orient the Last Layer',      count: 57, preview: <OllDiagram  alg="R U2 R2 F R F' U2 R' F R F'" size={80} /> },
  { id: 'PLL',  label: 'PLL',  description: 'Permute the Last Layer',     count: 21, preview: <PllDiagram  alg="R U R' U' R' F R2 U' R' U' R U R' F'" size={80} /> },
  { id: 'F2L',  label: 'F2L',  description: 'First Two Layers',           count: 41, preview: <F2LDiagram  alg="U R U' R'" size={80} /> },
  { id: 'COLL', label: 'COLL', description: 'Corners of the Last Layer',  count: 40, preview: <CollDiagram alg="R U R' U R U2 R'" size={80} /> },
];

const SET_CARDS_2x2 = [
  { id: 'OrtegaOLL', label: 'OLL', description: 'Ortega OLL', count: 7,
    preview: <TwoByTwoDiagram alg="R U R' U R U2 R'" size={80} stickering="2x2-oll" /> },
  { id: 'OrtegaPBL', label: 'PBL', description: 'Ortega PBL', count: 6,
    preview: <TwoByTwoDiagram alg="y R U R' F' R U R' U' R' F R2 U' R'" size={80} /> },
  { id: 'CLL',       label: 'CLL', description: 'Corners of the Last Layer', count: 42,
    preview: <TwoByTwoDiagram alg="y R U2 R' U' R U' R'" size={80} /> },
  { id: 'EG1',       label: 'EG-1', description: 'EG-1 (one solved bottom corner)', count: 42,
    preview: <TwoByTwoDiagram alg="U R U' R' F' U' F2 R U' R'" size={80} /> },
  { id: 'EG2',       label: 'EG-2', description: 'EG-2 (two solved bottom corners)', count: 42,
    preview: <TwoByTwoDiagram alg="F R2 U R' U2 R U R2 U F'" size={80} /> },
];

function SetPicker({ puzzle, onSelect, onBack }: { puzzle: string; onSelect: (id: string) => void; onBack: () => void }) {
  const is3x3 = puzzle === '3x3';
  const label = is3x3 ? '3×3' : '2×2';
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1 text-sm">
          <Icon name="arrowLeft" size={14} /> Puzzles
        </button>
        <span className="text-muted">/</span>
        <span className="font-semibold">{label}</span>
      </div>
      <PageHeader title={`${label} Algorithm Sets`} subtitle="Choose a set to browse and learn." />
      {is3x3 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SET_CARDS_3x3.map((s) => (
            <button key={s.id} onClick={() => onSelect(s.id)}
              className="card p-6 flex flex-col items-center gap-4 hover:border-accent/50 transition-colors cursor-pointer text-center">
              <div className="w-20 h-20 flex items-center justify-center">{s.preview}</div>
              <div>
                <div className="font-bold text-lg">{s.label}</div>
                <div className="text-xs text-muted mt-0.5">{s.description}</div>
                <div className="text-xs text-accent font-semibold mt-1">{s.count} cases</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SET_CARDS_2x2.map((s) => (
            <button key={s.id} onClick={() => onSelect(s.id)}
              className="card p-6 flex flex-col items-center gap-4 hover:border-accent/50 transition-colors cursor-pointer text-center">
              <div className="w-20 h-20 flex items-center justify-center">{s.preview}</div>
              <div>
                <div className="font-bold text-lg">{s.label}</div>
                <div className="text-xs text-muted mt-0.5">{s.description}</div>
                <div className="text-xs text-accent font-semibold mt-1">{s.count} cases</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Library tab
// ---------------------------------------------------------------------------

function AlgChip({ alg, selected, onClick }: { alg: string; selected?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'font-mono text-sm rounded px-3 py-2 break-all leading-relaxed',
        onClick ? 'cursor-pointer transition-colors' : '',
        selected ? 'bg-accent/20 ring-1 ring-accent' : 'bg-gray-100 dark:bg-card-hover',
        onClick && !selected ? 'hover:bg-gray-200 dark:hover:bg-card-hover/80' : '',
      )}
    >
      {alg}
    </div>
  );
}

function SlotTabs({ slotAlts }: { slotAlts: Record<string, string[]> }) {
  const slots = Object.keys(slotAlts);
  const [active, setActive] = useState(slots[0] ?? '');
  const algs = slotAlts[active] ?? [];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {slots.map((s) => (
          <button key={s} onClick={() => setActive(s)}
            className={clsx('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
              active === s ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
            {s}
          </button>
        ))}
      </div>
      {algs.length > 0
        ? <div className="flex flex-col gap-2">{algs.map((a, i) => <AlgChip key={i} alg={a} />)}</div>
        : <p className="text-sm text-muted italic">No algorithms on file.</p>}
    </div>
  );
}

function CaseModal({
  c, set, pref, onClose, onPrefChange, isAuthed,
}: {
  c: AlgCase; set: AlgSet; pref: AlgPref | undefined;
  onClose: () => void;
  onPrefChange: (patch: Partial<Pick<AlgPref, 'status' | 'preferredAlg'>>) => void;
  isAuthed: boolean;
}) {
  const allAlgs = useMemo(() => {
    const list = [c.moves];
    if (c.alts) list.push(...c.alts);
    return list;
  }, [c]);

  const currentPref = pref?.preferredAlg ?? null;
  const currentStatus: AlgStatus = pref?.status ?? 'NEW';
  const displayAlg = effectiveAlg(c, pref);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{c.name}</h2>
            <span className="text-sm text-muted">{c.group}</span>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg leading-none px-2 py-1">✕</button>
        </div>

        {/* Status selector */}
        {isAuthed && (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Status</div>
            <div className="flex gap-2">
              {(['NEW', 'LEARNING', 'LEARNED'] as AlgStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onPrefChange({ status: s })}
                  className={clsx(
                    'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                    currentStatus === s ? STATUS_COLORS[s] + ' ring-1 ring-current' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary',
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <RotatingCaseDiagram
            alg={displayAlg}
            size={280}
            defaultLat={30}
            puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
            diagramPrefix={c.diagramPrefix}
            stickering={rotatingStickering(set.kind)}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Setup (apply to solved cube)</div>
          <AlgChip alg={invertAlg(displayAlg)} />
        </div>

        {/* Main algorithm — shows the current preferred (or default) */}
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Main Algorithm</div>
          <AlgChip alg={displayAlg} />
        </div>

        {/* All algs except the current preferred, for switching */}
        {c.slotAlts && Object.keys(c.slotAlts).length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Alternates by Slot</div>
            <SlotTabs slotAlts={c.slotAlts} />
          </div>
        ) : allAlgs.filter((a) => a !== displayAlg).length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Alternates{isAuthed ? ' — click to set as main' : ''}
            </div>
            <div className="flex flex-col gap-2">
              {allAlgs.filter((a) => a !== displayAlg).map((a, i) => (
                <AlgChip
                  key={i}
                  alg={a}
                  onClick={isAuthed ? () => onPrefChange({ preferredAlg: a }) : undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Alternates</div>
            <p className="text-sm text-muted italic">No alternates on file.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CaseCard({
  c, set, pref, onSelect,
}: {
  c: AlgCase; set: AlgSet; pref: AlgPref | undefined; onSelect: (c: AlgCase) => void;
}) {
  const startPos = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const status = pref?.status;
  return (
    <div
      className="card p-4 flex gap-4 items-center text-left hover:border-accent/50 transition-colors cursor-pointer"
      onPointerDown={(e) => { startPos.current = { x: e.clientX, y: e.clientY }; dragged.current = false; }}
      onPointerMove={(e) => {
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 6) dragged.current = true;
      }}
      onClick={() => { if (!dragged.current) onSelect(c); }}
    >
      <div className="shrink-0"><CaseImage c={c} set={set} size={80} pref={pref} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
          {c.name}
          {status && status !== 'NEW' && <StatusBadge status={status} />}
        </div>
        <div className="font-mono text-xs text-muted mt-1 break-words">{effectiveAlg(c, pref)}</div>
      </div>
    </div>
  );
}

function CaseBrowser({
  setId, onBack, prefs, onPrefChange, isAuthed,
}: {
  setId: string;
  onBack: () => void;
  prefs: PrefsMap;
  onPrefChange: (caseId: string, patch: Partial<Pick<AlgPref, 'status' | 'preferredAlg'>>) => void;
  isAuthed: boolean;
}) {
  const set = getSet(setId)!;
  const groups = useMemo(() => ['All', ...Array.from(new Set(set.cases.map((c) => c.group)))], [set]);
  const [group, setGroup] = useState('All');
  const [statusFilter, setStatusFilter] = useState<AlgStatus | 'All'>('All');
  const [selected, setSelected] = useState<AlgCase | null>(null);

  const cases = useMemo(() => {
    let list = group === 'All' ? set.cases : set.cases.filter((c) => c.group === group);
    if (statusFilter !== 'All') {
      list = list.filter((c) => (prefs[c.id]?.status ?? 'NEW') === statusFilter);
    }
    return list;
  }, [set, group, statusFilter, prefs]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1">
          <Icon name="arrowLeft" size={14} /> Sets
        </button>
        <span className="text-muted">/</span>
        <span className="font-semibold">{set.name}</span>
      </div>
      <PageHeader title={set.name} subtitle={set.description} />

      <div className="flex flex-wrap gap-2 mb-4">
        {groups.length > 2 && groups.map((g) => (
          <button key={g} onClick={() => setGroup(g)}
            className={clsx('px-2.5 py-1 rounded text-xs font-semibold',
              group === g ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
            {g}
          </button>
        ))}
      </div>

      {isAuthed && (
        <div className="flex flex-wrap gap-2 mb-5">
          {(['All', 'NEW', 'LEARNING', 'LEARNED'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                statusFilter === s
                  ? s === 'All' ? 'bg-accent text-white' : STATUS_COLORS[s] + ' ring-1 ring-current'
                  : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
              {s === 'All' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {cases.map((c) => (
          <CaseCard key={c.id} c={c} set={set} pref={prefs[c.id]} onSelect={setSelected} />
        ))}
      </div>

      {selected && (
        <CaseModal
          c={selected}
          set={set}
          pref={prefs[selected.id]}
          onClose={() => setSelected(null)}
          onPrefChange={(patch) => onPrefChange(selected.id, patch)}
          isAuthed={isAuthed}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trainer tab
// ---------------------------------------------------------------------------

// Case selection screen
function CaseSelector({
  setId, prefs, onStart, onBack,
}: {
  setId: string;
  prefs: PrefsMap;
  onStart: (cases: AlgCase[]) => void;
  onBack: () => void;
}) {
  const set = getSet(setId)!;
  const groups = useMemo(() => Array.from(new Set(set.cases.map((c) => c.group))), [set]);
  const [statusFilter, setStatusFilter] = useState<AlgStatus | 'All'>('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(set.cases.map((c) => c.id)));

  const visible = useMemo(() => {
    let list = groupFilter === 'All' ? set.cases : set.cases.filter((c) => c.group === groupFilter);
    if (statusFilter !== 'All') list = list.filter((c) => (prefs[c.id]?.status ?? 'NEW') === statusFilter);
    return list;
  }, [set, groupFilter, statusFilter, prefs]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    const allVisible = visible.map((c) => c.id);
    const allOn = allVisible.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      allVisible.forEach((id) => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const selectedCases = set.cases.filter((c) => selected.has(c.id));

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1">
          <Icon name="arrowLeft" size={14} /> Sets
        </button>
        <span className="text-muted">/</span>
        <span className="font-semibold">{set.name}</span>
        <span className="text-muted">/</span>
        <span className="font-semibold">Select Cases</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {['All', ...groups].map((g) => (
            <button key={g} onClick={() => setGroupFilter(g)}
              className={clsx('px-2.5 py-1 rounded text-xs font-semibold',
                groupFilter === g ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['All', 'NEW', 'LEARNING', 'LEARNED'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                statusFilter === s
                  ? s === 'All' ? 'bg-accent text-white' : STATUS_COLORS[s] + ' ring-1 ring-current'
                  : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
              {s === 'All' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button onClick={toggleAll} className="btn-ghost text-xs">
          {visible.every((c) => selected.has(c.id)) ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-muted">{selectedCases.length} case{selectedCases.length !== 1 ? 's' : ''} selected</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-6">
        {visible.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={clsx(
                'card p-2 flex flex-col items-center gap-1 transition-colors text-center text-xs',
                on ? 'border-accent/60 bg-accent/5' : 'opacity-50',
              )}
            >
              <div className="pointer-events-none"><CaseImage c={c} set={set} size={64} pref={prefs[c.id]} /></div>
              <div className="font-semibold leading-tight">{c.name}</div>
              {prefs[c.id]?.status && prefs[c.id].status !== 'NEW' && (
                <StatusBadge status={prefs[c.id].status} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => selectedCases.length > 0 && onStart(selectedCases)}
          disabled={selectedCases.length === 0}
          className="btn-primary px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Training ({selectedCases.length})
        </button>
      </div>
    </div>
  );
}

// Training session
function parseMoves(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}

function formatTime(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

interface TrainerSettings {
  inputMethod: 'keyboard' | 'manual';
  showCaseName: boolean;
}

function TrainingSession({
  cases, setId, prefs, onBack,
}: {
  cases: AlgCase[];
  setId: string;
  prefs: PrefsMap;
  onBack: () => void;
}) {
  const set = getSet(setId)!;

  const [settings, setSettings] = useState<TrainerSettings>({ inputMethod: 'keyboard', showCaseName: true });
  const [showSettings, setShowSettings] = useState(false);

  const [caseIndex, setCaseIndex] = useState(() => Math.floor(Math.random() * cases.length));
  const currentCase = cases[caseIndex];
  const preferredAlg = effectiveAlg(currentCase, prefs[currentCase.id]);

  // Use an alternate as the scramble so it's never the preferred alg.
  const randomAlg = useMemo(() => {
    const alts = currentCase.alts ?? [];
    const pool = alts.length > 0 ? alts : [currentCase.moves];
    return pool[Math.floor(Math.random() * pool.length)];
  }, [currentCase]);

  const scramble = useMemo(() => invertAlg(randomAlg), [randomAlg]);
  const moves = useMemo(() => parseMoves(preferredAlg), [preferredAlg]);

  const [revealed, setRevealed] = useState(0);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const startTime = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  const nextCase = useCallback(() => {
    setCaseIndex(Math.floor(Math.random() * cases.length));
    setRevealed(0);
    setTimerState('idle');
    setElapsed(0);
    setManualInput('');
  }, [cases]);

  // Timer loop
  useEffect(() => {
    if (timerState === 'running') {
      const tick = () => {
        setElapsed(Date.now() - startTime.current);
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
      return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }
  }, [timerState]);

  // Keyboard handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setRevealed((r) => Math.min(r + 1, moves.length));
        return;
      }
      if (settings.inputMethod !== 'keyboard') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (timerState === 'idle') {
          startTime.current = Date.now();
          setTimerState('running');
        } else if (timerState === 'running') {
          setElapsed(Date.now() - startTime.current);
          setTimerState('stopped');
        } else {
          nextCase();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timerState, nextCase, moves.length, settings.inputMethod]);

  const submitManual = () => {
    const val = parseFloat(manualInput.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      setElapsed(Math.round(val * 1000));
      setTimerState('stopped');
      setManualInput('');
    }
  };

  const setSetting = <K extends keyof TrainerSettings>(key: K, val: TrainerSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: val }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onBack} className="btn-ghost flex items-center gap-1">
            <Icon name="arrowLeft" size={14} /> Cases
          </button>
          <span className="text-muted">/</span>
          <span className="font-semibold">{set.name} Trainer</span>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={clsx('btn-ghost flex items-center gap-1.5 text-sm', showSettings && 'text-accent')}
        >
          <Icon name="gear" size={15} /> Settings
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card p-5 mb-6 flex flex-col gap-5">
          <div>
            <div className="label mb-2">Input Method</div>
            <div className="flex gap-2">
              {(['keyboard', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSetting('inputMethod', m)}
                  className={clsx('px-3 py-1.5 rounded text-sm font-semibold capitalize transition-colors',
                    settings.inputMethod === m ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}
                >
                  {m === 'keyboard' ? 'Keyboard (spacebar)' : 'Manual input'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">After Stopping</div>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setSetting('showCaseName', v)}
                  className={clsx('px-3 py-1.5 rounded text-sm font-semibold transition-colors',
                    settings.showCaseName === v ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}
                >
                  {v ? 'Show case name' : 'Hide case name'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: diagram + scramble + move reveal */}
        <div className="flex flex-col items-center gap-4">
          <div className="card p-5 flex flex-col items-center gap-3 w-full">
            <RotatingCaseDiagram
              alg={randomAlg}
              size={280}
              defaultLat={30}
              puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
              diagramPrefix={currentCase.diagramPrefix}
              stickering={rotatingStickering(set.kind)}
            />
            <div className="font-mono text-base font-semibold text-primary text-center leading-relaxed break-all">
              {scramble}
            </div>
          </div>

          {/* Move reveal */}
          <div className="card p-4 w-full">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Solution — <kbd className="kbd">→</kbd> to reveal</span>
              <span className="text-accent">{revealed}/{moves.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {moves.map((m, i) => (
                <span
                  key={i}
                  className={clsx(
                    'font-mono text-sm font-semibold px-1.5 py-0.5 rounded transition-colors',
                    i < revealed ? 'text-primary bg-accent/10' : 'text-muted/40',
                  )}
                >
                  {i < revealed ? m : '—'}
                </span>
              ))}
            </div>
          </div>

          {timerState === 'stopped' && settings.showCaseName && (
            <div className="card p-3 w-full text-center text-sm text-muted">
              <span className="font-bold text-primary">{currentCase.name}</span>
              <span className="mx-2">·</span>
              {currentCase.group}
            </div>
          )}
        </div>

        {/* Right: timer */}
        <div className="flex flex-col items-center justify-center gap-6">
          <div className={clsx(
            'text-8xl font-mono font-bold tracking-tight transition-colors tabular-nums',
            timerState === 'running' ? 'text-accent' : 'text-primary',
          )}>
            {formatTime(elapsed)}
          </div>

          {settings.inputMethod === 'keyboard' ? (
            <div className="flex flex-col items-center gap-2 text-sm text-muted">
              {timerState === 'idle' && <span>Press <kbd className="kbd">Space</kbd> to start</span>}
              {timerState === 'running' && <span>Press <kbd className="kbd">Space</kbd> to stop</span>}
              {timerState === 'stopped' && <span>Press <kbd className="kbd">Space</kbd> for next case</span>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {timerState !== 'stopped' ? (
                <div className="flex gap-2">
                  <input
                    autoFocus={timerState === 'idle'}
                    type="text"
                    placeholder="e.g. 12.34"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    className="input w-36 text-center font-mono text-lg"
                  />
                  <button onClick={submitManual} className="btn-primary px-4 py-2">Set</button>
                </div>
              ) : (
                <button onClick={nextCase} className="btn-primary px-6 py-2.5">
                  Next case
                </button>
              )}
            </div>
          )}

          {settings.inputMethod === 'keyboard' && timerState === 'stopped' && (
            <button onClick={nextCase} className="btn-primary px-6 py-2.5">
              Next case
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Trainer view state machine
type TrainerView =
  | { screen: 'puzzles' }
  | { screen: 'sets'; puzzle: string }
  | { screen: 'select'; puzzle: string; setId: string }
  | { screen: 'session'; puzzle: string; setId: string; cases: AlgCase[] };

function TrainerTab({ isAuthed }: { isAuthed: boolean }) {
  const [view, setView] = useState<TrainerView>({ screen: 'puzzles' });
  const [prefs, setPrefs] = useState<PrefsMap>({});

  const setId = 'setId' in view ? view.setId : null;

  useEffect(() => {
    if (!setId || !isAuthed) return;
    api.get<AlgPref[]>(`/alg/prefs/${setId}`)
      .then((r) => {
        const map: PrefsMap = {};
        for (const p of r.data) map[p.caseId] = p;
        setPrefs(map);
      })
      .catch(() => {});
  }, [setId, isAuthed]);

  if (view.screen === 'puzzles') {
    return (
      <PuzzleLanding
        subtitle="Select a puzzle to start training."
        onSelect={(puzzle) => setView({ screen: 'sets', puzzle })}
      />
    );
  }

  if (view.screen === 'sets') {
    return (
      <SetPicker
        puzzle={view.puzzle}
        onBack={() => setView({ screen: 'puzzles' })}
        onSelect={(setId) => setView({ screen: 'select', puzzle: view.puzzle, setId })}
      />
    );
  }

  if (view.screen === 'select') {
    return (
      <CaseSelector
        setId={view.setId}
        prefs={prefs}
        onBack={() => setView({ screen: 'sets', puzzle: view.puzzle })}
        onStart={(cases) => setView({ screen: 'session', puzzle: view.puzzle, setId: view.setId, cases })}
      />
    );
  }

  // session
  const sv = view as { screen: 'session'; puzzle: string; setId: string; cases: AlgCase[] };
  return (
    <TrainingSession
      cases={sv.cases}
      setId={sv.setId}
      prefs={prefs}
      onBack={() => setView({ screen: 'select', puzzle: sv.puzzle, setId: sv.setId })}
    />
  );
}

// ---------------------------------------------------------------------------
// Library view state machine
// ---------------------------------------------------------------------------

type LibraryView =
  | { screen: 'puzzles' }
  | { screen: 'sets'; puzzle: string }
  | { screen: 'cases'; puzzle: string; setId: string };

function LibraryTab({ isAuthed }: { isAuthed: boolean }) {
  const [view, setView] = useState<LibraryView>({ screen: 'puzzles' });
  const setId = view.screen === 'cases' ? view.setId : null;
  const { prefs, upsert } = useAlgPrefs(setId, isAuthed);

  const handlePrefChange = (caseId: string, patch: Partial<Pick<AlgPref, 'status' | 'preferredAlg'>>) => {
    if (setId) upsert(setId, caseId, patch);
  };

  if (view.screen === 'puzzles') {
    return (
      <PuzzleLanding
        subtitle="Select a puzzle to browse algorithms."
        onSelect={(puzzle) => setView({ screen: 'sets', puzzle })}
      />
    );
  }

  if (view.screen === 'sets') {
    return (
      <SetPicker
        puzzle={view.puzzle}
        onBack={() => setView({ screen: 'puzzles' })}
        onSelect={(sid) => setView({ screen: 'cases', puzzle: view.puzzle, setId: sid })}
      />
    );
  }

  const cv = view as { screen: 'cases'; puzzle: string; setId: string };
  return (
    <CaseBrowser
      setId={cv.setId}
      onBack={() => setView({ screen: 'sets', puzzle: cv.puzzle })}
      prefs={prefs}
      onPrefChange={handlePrefChange}
      isAuthed={isAuthed}
    />
  );
}

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function AlgTrainerPage() {
  const { user } = useAuth();
  const isAuthed = !!user;
  const [tab, setTab] = useState<'library' | 'trainer'>('library');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['library', 'trainer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary',
            )}
          >
            {t === 'library' ? 'Library' : 'Trainer'}
          </button>
        ))}
      </div>
      {tab === 'library' ? <LibraryTab isAuthed={isAuthed} /> : <TrainerTab isAuthed={isAuthed} />}
    </div>
  );
}
