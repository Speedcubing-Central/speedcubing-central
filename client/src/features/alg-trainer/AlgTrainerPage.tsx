import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import '@cubing/icons';
import { PageHeader, Badge } from '../../components/ui';
import {
  OllDiagram, PllDiagram, CollDiagram, F2LDiagram, TwoByTwoDiagram,
  RotatingCaseDiagram, invertAlg, simplifyAlg, stripLeadingRotation, stripTrailingRotation,
  restrictToFaces, eliminateWideMoves,
} from '../../components/CubeDiagram';
import { ALG_SETS, getSet, type AlgCase, type AlgSet } from '../../data/algSets';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { formatTime as fmtTime, type Penalty, type AlgSolveDTO } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { copyText } from '../../lib/clipboard';
import { IS_2x2, rotatingStickering } from './algDiagram';
import { CaseDiagramPanel } from './CaseDiagramPanel';
import { useAlgTrainerData } from './useAlgTrainerData';
import { useTimerEngine, type TimerPhase } from '../timer/useTimerEngine';
import { guestAlgSelectionStore } from './algLocalStore';
import { TrainerSettings } from './TrainerSettings';
import { AlgSolveDetail } from './AlgSolveDetail';
import { SET_TO_URL, URL_TO_SET } from './algUrls';
import { useElementHeight, useIsDesktop } from '../../components/useLayoutHelpers';
import { useFillViewportHeight } from '../../components/useFillViewportHeight';

const COLUMN_GAP = 12; // gap-3
const TIMER_MIN_HEIGHT = 160;

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

// Drag-to-rotate (no idle auto-spin — see RotatingCaseDiagram), matching the
// popup and Trainer's live diagram. `defaultLat={72}` reproduces the more
// top-down framing the old static per-kind diagrams used here, vs. the more
// three-quarter default angle used elsewhere.
function CaseImage({ c, set, size = 80, pref, resetSignal }: { c: AlgCase; set: AlgSet; size?: number; pref?: AlgPref; resetSignal?: number }) {
  const alg = effectiveAlg(c, pref);
  return (
    <RotatingCaseDiagram
      alg={alg}
      size={size}
      defaultLat={72}
      puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
      diagramPrefix={c.diagramPrefix}
      stickering={rotatingStickering(set.kind)}
      resetSignal={resetSignal}
    />
  );
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
  const cards = is3x3 ? SET_CARDS_3x3 : SET_CARDS_2x2;

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
      <div className={clsx('grid gap-4', is3x3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {cards.map((s) => (
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
      {simplifyAlg(alg)}
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
  c, set, pref, onSelect, resetSignal,
}: {
  c: AlgCase; set: AlgSet; pref: AlgPref | undefined; onSelect: (c: AlgCase) => void; resetSignal?: number;
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
      <div className="shrink-0"><CaseImage c={c} set={set} size={80} pref={pref} resetSignal={resetSignal} /></div>
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
  // Every case thumbnail is drag-to-rotate; bumping this snaps them all back
  // to their default viewing angle in one click (see CaseImage/RotatingCaseDiagram).
  const [resetSignal, setResetSignal] = useState(0);

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
      <PageHeader
        title={set.name}
        subtitle={set.description}
        action={
          <button
            onClick={() => setResetSignal((n) => n + 1)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Reset every case's diagram back to its default viewing angle"
          >
            <Icon name="refresh" size={15} /> Reset Perspective
          </button>
        }
      />

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
          <CaseCard key={c.id} c={c} set={set} pref={prefs[c.id]} onSelect={setSelected} resetSignal={resetSignal} />
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

// Case selection screen (single set). Group and status filters are
// multi-select (toggle any combination on) rather than pick-one, so e.g.
// "Learning" + "Done" or several OLL subgroups at once can be filtered
// together.
function CaseSelector({
  setId, prefs, onStart, onBack, initialSelectedIds,
}: {
  setId: string;
  prefs: PrefsMap;
  onStart: (cases: AlgCase[]) => void;
  onBack: () => void;
  // Pre-check the last-saved selection (see TrainerTab) instead of
  // defaulting to every case, so revisiting this screen to tweak a
  // selection starts from what was actually last drilled.
  initialSelectedIds?: string[] | null;
}) {
  const set = getSet(setId)!;
  const hasGroups = useMemo(() => set.cases.some((c) => c.group), [set]);
  const groups = useMemo(() => Array.from(new Set(set.cases.map((c) => c.group).filter(Boolean))), [set]);
  const [statusFilter, setStatusFilter] = useState<Set<AlgStatus>>(new Set());
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds && initialSelectedIds.length > 0 ? initialSelectedIds : set.cases.map((c) => c.id)),
  );

  const visible = useMemo(() => {
    let list = set.cases;
    if (groupFilter.size > 0) list = list.filter((c) => groupFilter.has(c.group));
    if (statusFilter.size > 0) list = list.filter((c) => statusFilter.has(prefs[c.id]?.status ?? 'NEW'));
    return list;
  }, [set, groupFilter, statusFilter, prefs]);

  const toggleInSet = <T,>(s: Set<T>, id: T) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const toggle = (id: string) => setSelected((prev) => toggleInSet(prev, id));
  const toggleGroup = (g: string) => setGroupFilter((prev) => toggleInSet(prev, g));
  const toggleStatus = (st: AlgStatus) => setStatusFilter((prev) => toggleInSet(prev, st));

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
            {groups.map((g) => (
              <button key={g} onClick={() => toggleGroup(g)}
                className={clsx('px-2.5 py-1 rounded text-xs font-semibold',
                  groupFilter.has(g) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
                {g}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(['NEW', 'LEARNING', 'LEARNED'] as const).map((st) => (
            <button key={st} onClick={() => toggleStatus(st)}
              className={clsx('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                statusFilter.has(st)
                  ? STATUS_COLORS[st] + ' ring-1 ring-current' : 'bg-gray-100 dark:bg-card-hover text-muted hover:text-primary')}>
              {STATUS_LABELS[st]}
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

// True if the algorithm's first or last move is a bare whole-cube rotation
// (y/y'/y2/x/.../z2). Used to prefer alternates without this shape when an
// equally-valid one exists. A leading rotation isn't necessarily a problem
// on its own — stripLeadingRotation removes it outright when that's proven
// safe (y-axis, or no AUF) — but an x/z-axis leading rotation combined with
// a non-empty AUF, or ANY trailing rotation, can't be stripped safely (see
// those functions' doc comments), so for those shapes avoiding the alternate
// entirely (when a clean one is available) is the only fix.
function startsOrEndsWithRotation(alg: string): boolean {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const isRotation = (t: string) => /^[xyz]['2]?$/.test(t);
  return tokens.length > 0 && (isRotation(tokens[0]) || isRotation(tokens[tokens.length - 1]));
}

const AUF_MOVES = ['', 'U', "U'", 'U2'];
// 2x2 scrambles are restricted to R/U/F — see restrictToFaces.
const RUF_FACES = new Set(['R', 'U', 'F']);

// Live display while the timer is running, precision gated by the
// `timerUpdate` setting — mirrors TimerPage's runningStr.
function runningDisplay(ms: number, timerUpdate: string): string {
  if (timerUpdate === 'hidden') return 'solving…';
  if (timerUpdate === 'seconds') return fmtTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
  if (timerUpdate === 'deciseconds') return fmtTime(Math.floor(ms / 100) * 100, 'NONE', 1);
  return fmtTime(Math.floor(ms / 10) * 10, 'NONE', 2);
}

function TrainingSession({
  cases, setId, puzzle, prefs, onBack,
}: {
  cases: AlgCase[];
  setId: string;
  puzzle: string;
  prefs: PrefsMap;
  onBack: () => void;
}) {
  const set = getSet(setId)!;
  const s = useSettings();
  const data = useAlgTrainerData(useMemo(() => [setId], [setId]));
  const navigate = useNavigate();

  const [showSettings, setShowSettings] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const anyModalOpen = showSettings || detailIndex !== null;
  // The live diagram is drag-to-rotate and (unlike the popup) stays mounted
  // across every case in the session, so a drag on one case would otherwise
  // carry over into the next ones — bumping this snaps it back to default.
  const [diagramResetSignal, setDiagramResetSignal] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => undefined);
  }

  const outerRef = useRef<HTMLDivElement>(null);
  const fillHeight = useFillViewportHeight(outerRef);
  const headerRef = useRef<HTMLDivElement>(null);
  // Safe to measure directly (unlike the row's own height): the header's
  // size is driven purely by its own text/buttons, never by anything sized
  // from `fillHeight` downstream — so there's no settling cascade for a
  // ResizeObserver to miss here, the way there was when the row height used
  // to be re-derived a layer further down (see TrainingLeftColumn).
  const headerHeight = useElementHeight(headerRef);
  const isDesktop = useIsDesktop();
  const rowHeight = isDesktop && fillHeight !== undefined && headerHeight > 0
    ? fillHeight - headerHeight - COLUMN_GAP
    : undefined;

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
    // Prefer candidates that don't start/end with a rotation (see
    // startsOrEndsWithRotation) so the scramble reads like an ordinary
    // scramble whenever an equally-valid alternate makes that possible;
    // fall back to the full pool if every candidate has that shape rather
    // than over-restricting variety.
    const clean = pool.filter((alg) => !startsOrEndsWithRotation(alg));
    const candidates = clean.length > 0 ? clean : pool;
    const alg = candidates[Math.floor(Math.random() * candidates.length)];
    const a = s.trainerRandomAUF ? AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)] : '';
    return { randomAlg: alg, auf: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCase, s.trainerRandomAUF]);

  // simplifyAlg collapses a prepended AUF into whatever move the algorithm
  // itself already starts with (e.g. auf "U'" + alg starting "U ..." would
  // otherwise render as a literal, redundant "U' U ..." — mathematically a
  // no-op but visibly confusing). stripLeadingRotation removes a leading
  // rotation from randomAlg first when that's provably safe (see its doc
  // comment) — this is what eliminates the reported "y U" pattern: the
  // scramble's own trailing "y' U'" collapses to just "U'" once the
  // now-redundant rotation is gone before the AUF is even attached.
  const solvingAlg = simplifyAlg(
    auf ? `${auf} ${stripLeadingRotation(randomAlg, auf)}` : stripLeadingRotation(randomAlg, auf),
  );
  // Restricting to a smaller move set only makes sense on the final,
  // terminal scramble text (not on solvingAlg before it gets inverted) —
  // see restrictToFaces'/eliminateWideMoves' doc comment for why a rotation
  // can only be safely dropped once nothing remains after it to relabel,
  // which is only true once the scramble is fully built.
  const scramble = useMemo(() => {
    const raw = invertAlg(solvingAlg);
    if (IS_2x2(set.kind)) return restrictToFaces(raw, RUF_FACES);
    return eliminateWideMoves(raw);
  }, [solvingAlg, set.kind]);
  // stripTrailingRotation removes a trailing rotation from the solution
  // algorithm — always safe (it's the literal last move of the sequence),
  // unlike a leading one, so no AUF-dependent condition is needed here.
  const strippedPreferredAlg = stripTrailingRotation(preferredAlg);
  const moves = useMemo(
    () => parseMoves(simplifyAlg(auf ? `${auf} ${strippedPreferredAlg}` : strippedPreferredAlg)),
    [strippedPreferredAlg, auf],
  );

  const [revealed, setRevealed] = useState(0);
  const [manualInput, setManualInput] = useState('');
  // The case just solved, kept around briefly for the name-reveal card below
  // — since stopping now advances immediately, `currentCase` has already
  // moved on to the next case by the time anything re-renders, so the
  // reveal can't just read it off `currentCase` the way it used to.
  const [justSolved, setJustSolved] = useState<AlgCase | null>(null);
  const justSolvedTimeout = useRef<number | null>(null);
  const flashSolved = useCallback((c: AlgCase) => {
    if (justSolvedTimeout.current) clearTimeout(justSolvedTimeout.current);
    setJustSolved(c);
    justSolvedTimeout.current = window.setTimeout(() => setJustSolved(null), 2000);
  }, []);
  useEffect(() => () => { if (justSolvedTimeout.current) clearTimeout(justSolvedTimeout.current); }, []);

  const nextCase = useCallback(() => {
    setCaseIndex((prev) => {
      if (cases.length <= 1) return prev;
      let next = Math.floor(Math.random() * cases.length);
      while (next === prev) next = Math.floor(Math.random() * cases.length);
      return next;
    });
    setRevealed(0);
    setManualInput('');
  }, [cases]);

  // Hold-to-start (shared with Timer/Battle's own engine, including the
  // user's holdToStart/holdDuration setting) — Space no longer starts a
  // solve instantly on press; the timer only arms once held for the
  // configured duration, so a stray tap can't start one by accident.
  // Stopping (any key while running) records the solve and immediately
  // advances to the next case — no separate "press again" step.
  const engine = useTimerEngine({
    inspection: false,
    inspectionDirection: 'down',
    inspectionVoice: false,
    holdToStart: s.holdToStart,
    holdDuration: s.holdDuration,
    enabled: s.entryMode === 'keyboard' && !anyModalOpen,
    onComplete: (timeMs, penalty) => {
      flashSolved(currentCase);
      data.addSolve(setId, currentCase.id, timeMs, penalty, scramble);
      nextCase();
    },
  });

  // Reset the engine's own phase/display whenever the case changes
  // (including right after nextCase() advances one automatically) so the
  // next case starts from a clean idle state instead of the previous
  // solve's leftover "stopped" display lingering for a moment.
  useEffect(() => {
    engine.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIndex]);

  // Left/Right arrows step the move reveal — disabled while actually
  // running (hands are on the cube by then, matching Timer/Battle, where
  // any key press while running stops the solve instead).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isTextTarget = e.target instanceof HTMLInputElement;
      if (anyModalOpen || isTextTarget || engine.phase === 'running') return;
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setRevealed((r) => Math.min(r + 1, moves.length));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setRevealed((r) => Math.max(r - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen, engine.phase, moves.length]);

  const submitManual = () => {
    const parsed = parseTimeInput(manualInput, s.solvePrecision);
    if (!parsed) return;
    flashSolved(currentCase);
    data.addSolve(setId, currentCase.id, parsed.time, parsed.penalty, scramble);
    nextCase();
  };

  return (
    <div ref={outerRef} className="flex flex-col" style={{ height: fillHeight }}>
      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onBack} className="btn-ghost flex items-center gap-1">
            <Icon name="arrowLeft" size={14} /> Cases
          </button>
          <span className="text-muted">/</span>
          <span className="font-semibold">{set.name} Trainer</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/algorithms/trainer/${puzzle}/${SET_TO_URL[setId] ?? setId.toLowerCase()}/stats`)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Icon name="target" size={15} /> Stats
          </button>
          <button
            onClick={() => setDiagramResetSignal((n) => n + 1)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Reset the diagram back to its default viewing angle"
          >
            <Icon name="refresh" size={15} /> Reset Perspective
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Icon name="gear" size={15} /> Settings
          </button>
          <button onClick={toggleFullscreen} className="btn-ghost flex items-center gap-1.5 text-sm" title="Fullscreen">
            <Icon name={isFullscreen ? 'x' : 'plus'} size={15} />
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
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
          justSolved={s.trainerShowCaseName ? justSolved : null}
          availableHeight={rowHeight}
          resetSignal={diagramResetSignal}
        />

        {/* Right: timer tile (grows to fill) + solves tile (fills remaining space, scrolls internally) */}
        <TrainingRightColumn
          phase={engine.phase}
          elapsed={engine.elapsed}
          entryMode={s.entryMode}
          timerUpdate={s.timerUpdate}
          solvePrecision={s.solvePrecision}
          manualInput={manualInput}
          setManualInput={setManualInput}
          submitManual={submitManual}
          solves={data.solves}
          onOpenSolve={(i) => setDetailIndex(i)}
          availableHeight={rowHeight}
        />
      </div>

      <TrainerSettings open={showSettings} onClose={() => setShowSettings(false)} />
      {detailIndex !== null && (
        <AlgSolveDetail
          open
          onClose={() => setDetailIndex(null)}
          solves={data.solves}
          index={detailIndex}
          onUpdatePenalty={data.updatePenalty}
          onUpdateTime={data.updateTime}
          onDelete={data.deleteSolve}
        />
      )}
    </div>
  );
}

// Left column: fills the available column height, diagram GROWING to use
// whatever's left (see CaseDiagramPanel) after the move-reveal card and
// case-name reveal below it. `availableHeight` is the row's total height,
// derived directly from the outer container's fillHeight (see
// TrainingSession) — not re-measured here via a second ResizeObserver hop,
// since that indirection was observed to go stale after the outer's height
// settles asynchronously (the column's own clientHeight update never
// re-fired the observer reliably). The "below" block is still measured
// directly, since its own height genuinely doesn't depend on anything sized
// from `availableHeight` — no settling cascade there.
function TrainingLeftColumn({
  set, currentCase, solvingAlg, scramble, moves, revealed, justSolved, availableHeight, resetSignal,
}: {
  set: AlgSet;
  currentCase: AlgCase;
  solvingAlg: string;
  scramble: string;
  moves: string[];
  revealed: number;
  // The just-completed case (already null'd out by the caller if the
  // "show case name" setting is off), briefly flashed below the move
  // reveal — see TrainingSession's flashSolved.
  justSolved: AlgCase | null;
  availableHeight: number | undefined;
  resetSignal?: number;
}) {
  const belowRef = useRef<HTMLDivElement>(null);
  const belowHeight = useElementHeight(belowRef);
  const [diagramMaxHeight, setDiagramMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (availableHeight === undefined || belowHeight <= 0) {
      setDiagramMaxHeight(undefined);
      return;
    }
    const budget = availableHeight - belowHeight - COLUMN_GAP;
    const timeout = setTimeout(() => setDiagramMaxHeight(budget), 150);
    return () => clearTimeout(timeout);
  }, [availableHeight, belowHeight]);

  return (
    <div className="flex flex-col gap-3 md:flex-[3] min-h-0">
      <CaseDiagramPanel set={set} c={currentCase} alg={solvingAlg} scrambleText={scramble} maxHeight={diagramMaxHeight} resetSignal={resetSignal} />

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
          {justSolved && (
            <div className="case-reveal-enter flex items-center gap-2 text-sm">
              <span className="font-bold text-accent">{justSolved.name}</span>
              {justSolved.group && <span className="text-muted">{justSolved.group}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TRAINER_SOLVE_GRID = 'grid grid-cols-[1.8rem_1fr_4.5rem_1.25rem] gap-2 items-center';

// Right column: a timer tile stacked above a Solves tile (fills whatever's
// left, scrolls internally) — the same two-tile composition Timer uses for
// its own right column. `availableHeight` is the row's total height (see
// TrainingSession); the timer card's own height is derived directly from it
// (both tiles are equal flex-1, so it's just half the remaining space,
// protected by TIMER_MIN_HEIGHT) rather than re-measured via the timer
// card's own ResizeObserver — see the note on TrainingLeftColumn for why
// that indirection goes stale here. The digit's font size is fit against
// this same explicit height, only using a live ResizeObserver for width
// (which doesn't have that staleness problem).
function TrainingRightColumn({
  phase, elapsed, entryMode, timerUpdate, solvePrecision,
  manualInput, setManualInput, submitManual, solves, onOpenSolve, availableHeight,
}: {
  phase: TimerPhase;
  elapsed: number;
  entryMode: 'keyboard' | 'typing';
  timerUpdate: string;
  solvePrecision: 2 | 3;
  manualInput: string;
  setManualInput: (v: string) => void;
  submitManual: () => void;
  solves: AlgSolveDTO[];
  onOpenSolve: (index: number) => void;
  availableHeight: number | undefined;
}) {
  const isDesktop = useIsDesktop();
  const timerCardRef = useRef<HTMLDivElement>(null);
  const timerCardHeight = availableHeight !== undefined
    ? Math.max(TIMER_MIN_HEIGHT, (availableHeight - COLUMN_GAP) / 2)
    : undefined;

  const [digitFontSize, setDigitFontSize] = useState(144);
  useEffect(() => {
    const el = timerCardRef.current;
    if (!el) return;
    const reservedBelow = entryMode === 'keyboard' ? 68 : 96;
    const recompute = () => {
      const widthCap = el.clientWidth * 0.34;
      const heightCap = (timerCardHeight ?? el.clientHeight) - reservedBelow;
      setDigitFontSize(Math.max(40, Math.min(heightCap, widthCap, 144)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timerCardHeight, entryMode]);

  const display = phase === 'running'
    ? runningDisplay(elapsed, timerUpdate)
    : phase === 'stopped'
      ? fmtTime(Math.round(elapsed), 'NONE', solvePrecision)
      : fmtTime(0, 'NONE', solvePrecision);
  const colorClass = phase === 'ready' ? 'text-green-500'
    : phase === 'holding' ? 'text-red-500'
    : phase === 'running' ? 'text-accent'
    : 'text-primary';

  const hint = (() => {
    if (phase === 'holding') return 'Keep holding…';
    if (phase === 'ready') return 'Release to start!';
    if (phase === 'running') return 'Press any key to stop';
    return <>Hold <kbd className="kbd">Space</kbd> to start</>;
  })();

  return (
    <div className="flex flex-col gap-3 md:flex-[2] min-h-0">
      <div
        ref={timerCardRef}
        className="card overflow-y-auto flex flex-col items-center justify-center gap-6"
        style={{ height: timerCardHeight, minHeight: isDesktop ? TIMER_MIN_HEIGHT : undefined }}
      >
        <div
          className={clsx('font-mono font-bold tracking-tight transition-colors tabular-nums leading-none text-center px-4 shrink-0', colorClass)}
          style={{ fontSize: digitFontSize }}
        >
          {display}
        </div>

        {entryMode === 'keyboard' ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted shrink-0">
            <span>{hint}</span>
          </div>
        ) : (
          <div className="flex gap-2 shrink-0">
            <input
              autoFocus
              type="text"
              placeholder="e.g. 1234 or 12.34"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              className="input w-40 text-center font-mono text-lg"
            />
            <button onClick={submitManual} className="btn-primary px-4 py-2">Set</button>
          </div>
        )}
      </div>

      {/* Solves — fills remaining vertical space, scrolls internally, same
          pattern as Timer's own Solves card. */}
      <div className="card p-5 flex flex-col flex-1 min-h-0">
        <h3 className="font-bold text-lg mb-3 shrink-0">Solves ({solves.length})</h3>
        {solves.length === 0 ? (
          <p className="text-muted text-sm">No solves yet. Start the timer.</p>
        ) : (
          <>
            <div className={`${TRAINER_SOLVE_GRID} text-xs font-semibold text-muted px-1 pb-1.5 border-b border-border shrink-0`}>
              <span className="text-right">#</span>
              <span>case</span>
              <span className="text-right">time</span>
              <span />
            </div>
            <div className="divide-y divide-border/60 overflow-y-auto flex-1 min-h-0">
              {solves.map((sv, i) => (
                <TrainerSolveRow
                  key={sv.id}
                  index={i}
                  solve={sv}
                  total={solves.length}
                  precision={solvePrecision}
                  onOpen={() => onOpenSolve(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrainerSolveRow({
  index, solve, total, precision, onOpen,
}: {
  index: number;
  solve: AlgSolveDTO;
  total: number;
  precision: number;
  onOpen: () => void;
}) {
  // Each solve already carries its own setId, so this resolves the case
  // straight off the solve rather than needing a set passed down as a prop.
  const c = getSet(solve.setId)?.cases.find((cc) => cc.id === solve.caseId);
  return (
    <div className={`${TRAINER_SOLVE_GRID} px-1 py-2 text-sm`}>
      <span className="text-muted text-xs text-right">{total - index}.</span>
      <button onClick={onOpen} className="text-left font-medium truncate hover:text-accent">
        {c?.name ?? solve.caseId}
      </button>
      <button
        onClick={onOpen}
        className={clsx('font-mono text-sm font-semibold hover:text-accent text-right', solve.penalty === 'DNF' && 'text-red-400')}
      >
        {fmtTime(solve.time, solve.penalty, precision)}
      </button>
      <button
        onClick={() => copyText(fmtTime(solve.time, solve.penalty, precision), 'Time copied')}
        title="Copy time"
        className="text-muted hover:text-accent justify-self-end"
      >
        <Icon name="copy" size={14} />
      </button>
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
  // Gates rendering CaseSelector until we know whether a saved selection
  // exists for this set — otherwise it'd flash empty/all-selected for a
  // moment before the pre-check lands.
  const [selectionChecked, setSelectionChecked] = useState(false);
  // Kept separately from sessionCases so CaseSelector can still pre-check
  // the last-saved selection when the user goes back to "Cases" to tweak
  // it, even though sessionCases itself gets cleared to show that screen.
  const [savedCaseIds, setSavedCaseIds] = useState<string[] | null>(null);

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

  // Fetch the case selection the user last drilled in this set (if any) so
  // CaseSelector can pre-check it — the user still lands on CaseSelector
  // every visit and picks "Start Training" themselves; this only saves them
  // from having to re-check the same boxes again. See CaseSelector's "Start
  // Training" handler below, which is what saves the selection in the first place.
  useEffect(() => {
    setSessionCases(null);
    setSavedCaseIds(null);
    setSelectionChecked(false);
    if (!setId) {
      setSelectionChecked(true);
      return;
    }
    const applySavedIds = (caseIds: string[] | null | undefined) => {
      if (caseIds && caseIds.length > 0) setSavedCaseIds(caseIds);
      setSelectionChecked(true);
    };
    if (isAuthed) {
      api.get<{ caseIds: string[] } | null>(`/alg/selection/${setId}`)
        .then((r) => applySavedIds(r.data?.caseIds))
        .catch(() => setSelectionChecked(true));
    } else {
      applySavedIds(guestAlgSelectionStore.get(setId));
    }
  }, [setId, isAuthed]);

  function saveSelection(cases: AlgCase[]) {
    if (!setId) return;
    const caseIds = cases.map((c) => c.id);
    setSavedCaseIds(caseIds);
    if (isAuthed) {
      api.put('/alg/selection', { setId, caseIds }).catch(() => {});
    } else {
      guestAlgSelectionStore.set(setId, caseIds);
    }
  }

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
  if (!selectionChecked) {
    return <div className="p-8 text-muted text-sm">Loading…</div>;
  }
  if (sessionCases) {
    return (
      <TrainingSession
        cases={sessionCases}
        setId={setId}
        puzzle={puzzle}
        prefs={prefs}
        onBack={() => setSessionCases(null)}
      />
    );
  }
  return (
    <CaseSelector
      setId={setId}
      prefs={prefs}
      initialSelectedIds={savedCaseIds}
      onBack={() => navigate(`/algorithms/trainer/${puzzle}`)}
      onStart={(cases) => {
        saveSelection(cases);
        setSessionCases(cases);
      }}
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
