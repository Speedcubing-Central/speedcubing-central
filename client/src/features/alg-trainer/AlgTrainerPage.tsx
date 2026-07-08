import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import '@cubing/icons';
import { PageHeader, Badge } from '../../components/ui';
import {
  OllDiagram, PllDiagram, CollDiagram, F2LDiagram, TwoByTwoDiagram,
  RotatingCaseDiagram, invertAlg,
} from '../../components/CubeDiagram';
import { ALG_SETS, getSet, type AlgCase, type AlgSet } from '../../data/algSets';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { formatTime as fmtTime, type Penalty } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { IS_2x2, rotatingStickering, twoByTwoStickering } from './algDiagram';
import { CaseDiagramPanel } from './CaseDiagramPanel';
import { useAlgTrainerData } from './useAlgTrainerData';
import { TrainerSettings } from './TrainerSettings';
import { AlgStatsModal } from './AlgStatsModal';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';

const COLUMN_GAP = 12; // gap-3

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

// URL slug ↔ internal set ID mappings
const SET_TO_URL: Record<string, string> = {
  OLL: 'oll', PLL: 'pll', F2L: 'f2l', COLL: 'coll',
  EG1: 'eg-1', EG2: 'eg-2', CLL: 'cll',
  OrtegaOLL: 'ortega-oll', OrtegaPBL: 'ortega-pbl',
};
const URL_TO_SET: Record<string, string> = Object.fromEntries(
  Object.entries(SET_TO_URL).map(([k, v]) => [v, k]),
);

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
  { id: 'EG1',       label: 'EG-1', description: 'Erik-Gunnar 1', count: 42,
    preview: <TwoByTwoDiagram alg="U R U' R' F' U' F2 R U' R'" size={80} /> },
  { id: 'EG2',       label: 'EG-2', description: 'Erik-Gunnar 2', count: 42,
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
  const hasGroups = useMemo(() => set.cases.some((c) => c.group), [set]);
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

      {hasGroups && (
        <div className="flex flex-wrap gap-2 mb-4">
          {groups.map((g) => (
            <button key={g} onClick={() => setGroup(g)}
              className={clsx('px-2.5 py-1 rounded text-xs font-semibold',
                group === g ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
              {g}
            </button>
          ))}
        </div>
      )}

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
  const hasGroups = useMemo(() => set.cases.some((c) => c.group), [set]);
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
        {hasGroups && (
          <div className="flex flex-wrap gap-2">
            {['All', ...groups].map((g) => (
              <button key={g} onClick={() => setGroupFilter(g)}
                className={clsx('px-2.5 py-1 rounded text-xs font-semibold',
                  groupFilter === g ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
                {g}
              </button>
            ))}
          </div>
        )}
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

const AUF_MOVES = ['', 'U', "U'", 'U2'];

// Live display while the timer is running, precision gated by the
// `timerUpdate` setting — mirrors TimerPage's runningStr.
function runningDisplay(ms: number, timerUpdate: string): string {
  if (timerUpdate === 'hidden') return 'solving…';
  if (timerUpdate === 'seconds') return fmtTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
  if (timerUpdate === 'deciseconds') return fmtTime(Math.floor(ms / 100) * 100, 'NONE', 1);
  return fmtTime(Math.floor(ms / 10) * 10, 'NONE', 2);
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
  const s = useSettings();
  const data = useAlgTrainerData(setId);

  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const anyModalOpen = showSettings || showStats;

  const [caseIndex, setCaseIndex] = useState(() => Math.floor(Math.random() * cases.length));
  const currentCase = cases[caseIndex];
  const preferredAlg = effectiveAlg(currentCase, prefs[currentCase.id]);

  // Pick an alternate (never the preferred alg, so it's not given away) plus
  // a random AUF, so the same case doesn't always render as one of a small
  // fixed set of scrambles — see the plan's scramble-generation note. The
  // AUF is prepended to whichever algorithm is used (both here and for the
  // revealed solution below) so the two stay consistent with each other.
  const { randomAlg, auf } = useMemo(() => {
    const alts = currentCase.alts ?? [];
    const pool = alts.length > 0 ? alts : [currentCase.moves];
    const alg = pool[Math.floor(Math.random() * pool.length)];
    const a = s.trainerRandomAUF ? AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)] : '';
    return { randomAlg: alg, auf: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCase, s.trainerRandomAUF]);

  const solvingAlg = auf ? `${auf} ${randomAlg}` : randomAlg;
  const scramble = useMemo(() => invertAlg(solvingAlg), [solvingAlg]);
  const moves = useMemo(() => parseMoves(auf ? `${auf} ${preferredAlg}` : preferredAlg), [preferredAlg, auf]);

  const [revealed, setRevealed] = useState(0);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>('NONE');
  const [manualInput, setManualInput] = useState('');
  const startTime = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  const nextCase = useCallback(() => {
    setCaseIndex(Math.floor(Math.random() * cases.length));
    setRevealed(0);
    setTimerState('idle');
    setElapsed(0);
    setPenalty('NONE');
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

  // Keyboard handler: Left/Right arrows step the move reveal; Space or
  // Enter start/stop the timer (keyboard entry mode) or advance to the next
  // case once stopped (either mode — in manual mode the typed-time input
  // has its own Enter-to-submit handler and is excluded here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isTextTarget = e.target instanceof HTMLInputElement;
      if (anyModalOpen) return;
      if (!isTextTarget && e.code === 'ArrowRight') {
        e.preventDefault();
        setRevealed((r) => Math.min(r + 1, moves.length));
        return;
      }
      if (!isTextTarget && e.code === 'ArrowLeft') {
        e.preventDefault();
        setRevealed((r) => Math.max(r - 1, 0));
        return;
      }
      if (isTextTarget || (e.code !== 'Space' && e.key !== 'Enter')) return;

      if (s.entryMode !== 'keyboard') {
        if (timerState === 'stopped') {
          e.preventDefault();
          nextCase();
        }
        return;
      }
      e.preventDefault();
      if (timerState === 'idle') {
        startTime.current = Date.now();
        setTimerState('running');
      } else if (timerState === 'running') {
        const finalMs = Math.round(Date.now() - startTime.current);
        setElapsed(finalMs);
        setTimerState('stopped');
        data.addSolve(currentCase.id, finalMs, 'NONE', scramble);
      } else {
        nextCase();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timerState, nextCase, moves.length, s.entryMode, anyModalOpen, currentCase, scramble, data]);

  const submitManual = () => {
    const parsed = parseTimeInput(manualInput, s.solvePrecision);
    if (!parsed) return;
    setElapsed(parsed.time);
    setPenalty(parsed.penalty);
    setTimerState('stopped');
    setManualInput('');
    data.addSolve(currentCase.id, parsed.time, parsed.penalty, scramble);
  };

  return (
    <div className="flex flex-col md:h-[calc(100dvh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onBack} className="btn-ghost flex items-center gap-1">
            <Icon name="arrowLeft" size={14} /> Cases
          </button>
          <span className="text-muted">/</span>
          <span className="font-semibold">{set.name} Trainer</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStats(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Icon name="target" size={15} /> Stats
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Icon name="gear" size={15} /> Settings
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* Left: diagram + scramble + move reveal + case-name reveal */}
        <TrainingLeftColumn
          set={set}
          currentCase={currentCase}
          solvingAlg={solvingAlg}
          scramble={scramble}
          moves={moves}
          revealed={revealed}
          timerState={timerState}
          showCaseName={s.trainerShowCaseName}
        />

        {/* Right: timer */}
        <div className="flex flex-col items-center justify-center gap-6 md:flex-[2] min-h-0">
          <div className={clsx(
            'text-8xl font-mono font-bold tracking-tight transition-colors tabular-nums',
            timerState === 'running' ? 'text-accent' : 'text-primary',
          )}>
            {timerState === 'running'
              ? runningDisplay(elapsed, s.timerUpdate)
              : fmtTime(elapsed, penalty, s.solvePrecision)}
          </div>

          {s.entryMode === 'keyboard' ? (
            <div className="flex flex-col items-center gap-2 text-sm text-muted">
              {timerState === 'idle' && <span>Press <kbd className="kbd">Space</kbd> to start</span>}
              {timerState === 'running' && <span>Press <kbd className="kbd">Space</kbd> to stop</span>}
              {timerState === 'stopped' && <span>Press <kbd className="kbd">Space</kbd> or <kbd className="kbd">Enter</kbd> for next case</span>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {timerState !== 'stopped' ? (
                <div className="flex gap-2">
                  <input
                    autoFocus={timerState === 'idle'}
                    type="text"
                    placeholder="e.g. 1234 or 12.34"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    className="input w-40 text-center font-mono text-lg"
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

          {s.entryMode === 'keyboard' && timerState === 'stopped' && (
            <button onClick={nextCase} className="btn-primary px-6 py-2.5">
              Next case
            </button>
          )}
        </div>
      </div>

      <TrainerSettings open={showSettings} onClose={() => setShowSettings(false)} />
      <AlgStatsModal
        open={showStats}
        onClose={() => setShowStats(false)}
        setId={setId}
        solves={data.solves}
        onUpdatePenalty={data.updatePenalty}
        onUpdateTime={data.updateTime}
        onDelete={data.deleteSolve}
      />
    </div>
  );
}

// Left column: fills the available column height, diagram shrinking (never
// cropping) to leave room for the move-reveal card and case-name reveal
// below it — same budget pattern as Timer's scramble panel (see
// useDiagramFit), just with the "below" block measured directly since its
// height doesn't depend on the diagram's own size.
function TrainingLeftColumn({
  set, currentCase, solvingAlg, scramble, moves, revealed, timerState, showCaseName,
}: {
  set: AlgSet;
  currentCase: AlgCase;
  solvingAlg: string;
  scramble: string;
  moves: string[];
  revealed: number;
  timerState: 'idle' | 'running' | 'stopped';
  showCaseName: boolean;
}) {
  const leftColRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const colHeight = useElementHeight(leftColRef);
  const isDesktop = useIsDesktop();
  const [diagramMaxHeight, setDiagramMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isDesktop || colHeight <= 0) {
      setDiagramMaxHeight(undefined);
      return;
    }
    const belowH = belowRef.current?.offsetHeight ?? 0;
    const budget = colHeight - belowH - COLUMN_GAP;
    const timeout = setTimeout(() => setDiagramMaxHeight(budget), 150);
    return () => clearTimeout(timeout);
  }, [isDesktop, colHeight, revealed, moves.length, timerState]);

  const revealShown = timerState === 'stopped' && showCaseName;

  return (
    <div ref={leftColRef} className="flex flex-col gap-3 md:flex-[3] min-h-0">
      <CaseDiagramPanel set={set} c={currentCase} alg={solvingAlg} scrambleText={scramble} maxHeight={diagramMaxHeight} />

      <div ref={belowRef} className="flex flex-col gap-3 shrink-0">
        {/* Move reveal */}
        <div className="card p-4 w-full shrink-0">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Solution — <kbd className="kbd">←</kbd><kbd className="kbd">→</kbd> to reveal</span>
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

        {/* Case-name reveal — an inline, animated line rather than a
            separate bordered tile, so it reads as part of the flow instead
            of popping in as its own disconnected block. */}
        <div className="h-5 shrink-0 flex items-center justify-center">
          {revealShown && (
            <div className="case-reveal-enter flex items-center gap-2 text-sm">
              <span className="font-bold text-accent">{currentCase.name}</span>
              {currentCase.group && <span className="text-muted">{currentCase.group}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trainer tab — URL-driven
// ---------------------------------------------------------------------------

function TrainerTab({
  puzzle, setId, isAuthed,
}: {
  puzzle: string | null;
  setId: string | null;
  isAuthed: boolean;
}) {
  const navigate = useNavigate();
  const [sessionCases, setSessionCases] = useState<AlgCase[] | null>(null);
  const [prefs, setPrefs] = useState<PrefsMap>({});

  // Clear active session when the set changes
  useEffect(() => { setSessionCases(null); }, [puzzle, setId]);

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

  if (!puzzle) {
    return (
      <PuzzleLanding
        subtitle="Select a puzzle to start training."
        onSelect={(p) => navigate(`/algorithms/trainer/${p}`)}
      />
    );
  }
  if (!setId) {
    return (
      <SetPicker
        puzzle={puzzle}
        onBack={() => navigate('/algorithms/trainer')}
        onSelect={(sid) => navigate(`/algorithms/trainer/${puzzle}/${SET_TO_URL[sid] ?? sid.toLowerCase()}`)}
      />
    );
  }
  if (sessionCases) {
    return (
      <TrainingSession
        cases={sessionCases}
        setId={setId}
        prefs={prefs}
        onBack={() => setSessionCases(null)}
      />
    );
  }
  return (
    <CaseSelector
      setId={setId}
      prefs={prefs}
      onBack={() => navigate(`/algorithms/trainer/${puzzle}`)}
      onStart={(cases) => setSessionCases(cases)}
    />
  );
}

// ---------------------------------------------------------------------------
// Library tab — URL-driven
// ---------------------------------------------------------------------------

function LibraryTab({
  puzzle, setId, isAuthed,
}: {
  puzzle: string | null;
  setId: string | null;
  isAuthed: boolean;
}) {
  const navigate = useNavigate();
  const { prefs, upsert } = useAlgPrefs(setId, isAuthed);

  const handlePrefChange = (caseId: string, patch: Partial<Pick<AlgPref, 'status' | 'preferredAlg'>>) => {
    if (setId) upsert(setId, caseId, patch);
  };

  if (!puzzle) {
    return (
      <PuzzleLanding
        subtitle="Select a puzzle to browse algorithms."
        onSelect={(p) => navigate(`/algorithms/library/${p}`)}
      />
    );
  }
  if (!setId) {
    return (
      <SetPicker
        puzzle={puzzle}
        onBack={() => navigate('/algorithms/library')}
        onSelect={(sid) => navigate(`/algorithms/library/${puzzle}/${SET_TO_URL[sid] ?? sid.toLowerCase()}`)}
      />
    );
  }
  return (
    <CaseBrowser
      setId={setId}
      onBack={() => navigate(`/algorithms/library/${puzzle}`)}
      prefs={prefs}
      onPrefChange={handlePrefChange}
      isAuthed={isAuthed}
    />
  );
}

// ---------------------------------------------------------------------------
// Root page — URL is the source of truth for tab / puzzle / set
// ---------------------------------------------------------------------------

export default function AlgTrainerPage() {
  const { user } = useAuth();
  const isAuthed = !!user;
  const {
    tab: tabParam,
    puzzle: puzzleParam,
    setId: setSlug,
  } = useParams<{ tab?: string; puzzle?: string; setId?: string }>();
  const navigate = useNavigate();

  const tab: 'library' | 'trainer' = tabParam === 'trainer' ? 'trainer' : 'library';
  const puzzle = puzzleParam ?? null;
  const setId = setSlug ? (URL_TO_SET[setSlug] ?? null) : null;

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['library', 'trainer'] as const).map((t) => (
          <button
            key={t}
            onClick={() => navigate(`/algorithms/${t}`)}
            className={clsx(
              'px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary',
            )}
          >
            {t === 'library' ? 'Library' : 'Trainer'}
          </button>
        ))}
      </div>
      {tab === 'library'
        ? <LibraryTab puzzle={puzzle} setId={setId} isAuthed={isAuthed} />
        : <TrainerTab puzzle={puzzle} setId={setId} isAuthed={isAuthed} />
      }
    </div>
  );
}
