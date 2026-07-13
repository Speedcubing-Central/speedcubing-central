import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { WCA_EVENTS, UNOFFICIAL_EVENTS, getEvent, type ReconstructionDTO } from '@scc/shared';
import { PageHeader, EmptyState, Skeleton } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ReconstructionPlayer, type ReconstructionHandle, type ReconstructionProgress } from '../../components/CubeDiagram';
import { api, apiError } from '../../lib/api';
import { getScramble } from '../../lib/scramble';
import { copyText } from '../../lib/clipboard';
import { parseMoves, countMoveMetrics, calculateTps, moveIndexAtCursor } from '../../lib/moveMetrics';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { toast } from '../../store/toast';

// Maps a WCA/unofficial event id to the cubing.js puzzle identifier used by
// <twisty-player puzzle="...">. BF/OH events share their base puzzle's shape,
// so they're kept here for old saved/shared links even though they're no
// longer offered in the event picker below.
const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2', '333': '3x3x3', '444': '4x4x4', '555': '5x5x5', '666': '6x6x6', '777': '7x7x7',
  '333oh': '3x3x3', '333bf': '3x3x3', '444bf': '4x4x4', '555bf': '5x5x5',
  minx: 'megaminx', pyram: 'pyraminx', clock: 'clock', skewb: 'skewb', sq1: 'square1',
  kilominx: 'kilominx', fto: 'fto', redi_cube: 'redi_cube',
};
function puzzleForEvent(eventId: string): string {
  return EVENT_TO_PUZZLE[eventId] ?? '3x3x3';
}

// 3x3 one-handed and the blindfolded events use the same puzzle as their main
// event, so there's nothing to reconstruct differently — point people at 333/
// 444/555 instead of offering redundant options.
const REDUNDANT_EVENT_IDS = ['333oh', '333bf', '444bf', '555bf'];
const RECONSTRUCTION_WCA_EVENTS = WCA_EVENTS.filter((e) => !REDUNDANT_EVENT_IDS.includes(e.id));

const SPEEDS = [0.5, 1, 1.5, 2];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// The cube tile is sized to content (not stretched), so it just needs a
// reasonable size per viewport tier — recalculated on resize (e.g. toggling
// the sidebar changes how much width is left for the input column).
function useResponsiveCubeSize(): number {
  const pick = () => (window.innerWidth < 640 ? 240 : window.innerWidth < 1024 ? 300 : 360);
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? 300 : pick()));
  useEffect(() => {
    const onResize = () => setSize(pick());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function ReconstructionPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { focusMode } = useUi();

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('333');
  const [scramble, setScramble] = useState('');
  const [solution, setSolution] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loadingShared, setLoadingShared] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [mine, setMine] = useState<ReconstructionDTO[]>([]);
  const [minePending, setMinePending] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [progress, setProgress] = useState<ReconstructionProgress>({ index: 0, total: 0, playing: false, fraction: 0 });
  const [speed, setSpeed] = useState(1);
  const [scrambling, setScrambling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeInput, setTimeInput] = useState('');

  const handleRef = useRef<ReconstructionHandle>(null);
  const cubeSize = useResponsiveCubeSize();

  // Load a saved reconstruction by id — this is the shareable-by-link path.
  useEffect(() => {
    if (!id) return;
    setLoadingShared(true);
    setNotFound(false);
    api
      .get<ReconstructionDTO>(`/reconstructions/${id}`)
      .then((r) => {
        setTitle(r.data.title);
        setEventId(r.data.eventId);
        setScramble(r.data.scramble);
        setSolution(r.data.solution);
        setTimeInput(r.data.timeMs != null ? String(r.data.timeMs / 1000) : '');
        setSavedId(r.data.id);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingShared(false));
  }, [id]);

  // Prefill from an ad-hoc share link, e.g. /reconstruction?scramble=...&solution=...
  useEffect(() => {
    if (id) return;
    const s = searchParams.get('scramble');
    const sol = searchParams.get('solution');
    if (!s && !sol) return;
    if (s) setScramble(s);
    if (sol) setSolution(sol);
    const ev = searchParams.get('event');
    if (ev) setEventId(ev);
    const t = searchParams.get('title');
    if (t) setTitle(t);
    const time = searchParams.get('time');
    if (time) setTimeInput(time);
    // Only ever consume the initial URL once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMine = useCallback(() => {
    if (!user) {
      setMine([]);
      return;
    }
    setMinePending(true);
    api
      .get<ReconstructionDTO[]>('/reconstructions')
      .then((r) => setMine(r.data))
      .catch(() => {})
      .finally(() => setMinePending(false));
  }, [user]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const puzzle = puzzleForEvent(eventId);
  const moves = useMemo(() => parseMoves(solution), [solution]);
  const metrics = useMemo(() => countMoveMetrics(solution), [solution]);
  const seconds = parseFloat(timeInput.replace(',', '.'));
  const hasValidTime = isFinite(seconds) && seconds > 0;
  const tps = calculateTps(metrics.htm, seconds);

  const handleGenerateScramble = async () => {
    setScrambling(true);
    try {
      setScramble(await getScramble(eventId));
    } finally {
      setScrambling(false);
    }
  };

  // Jumps the player to whichever move the cursor is in/next to, so clicking
  // or arrow-keying around the solution text drives the 3D view directly.
  const handleSolutionCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (moves.length === 0) return;
    const pos = e.currentTarget.selectionStart ?? 0;
    handleRef.current?.jumpToMoveIndex(moveIndexAtCursor(solution, pos));
  };

  const handleShare = () => {
    const origin = window.location.origin;
    if (savedId) {
      copyText(`${origin}/reconstruction/${savedId}`, 'Share link copied');
      return;
    }
    const params = new URLSearchParams();
    params.set('scramble', scramble);
    params.set('solution', solution);
    params.set('event', eventId);
    if (title) params.set('title', title);
    if (hasValidTime) params.set('time', timeInput);
    copyText(`${origin}/reconstruction?${params.toString()}`, 'Share link copied');
  };

  // Saves a brand new reconstruction the first time, then updates that same
  // record in place on every subsequent save.
  const handleSave = async () => {
    if (!user || !solution.trim()) return;
    setSaving(true);
    const timeMs = hasValidTime ? Math.round(seconds * 1000) : null;
    try {
      if (savedId) {
        const { data } = await api.patch<ReconstructionDTO>(`/reconstructions/${savedId}`, {
          title,
          eventId,
          scramble,
          solution,
          timeMs,
        });
        setSavedId(data.id);
        toast.success('Reconstruction updated');
      } else {
        const { data } = await api.post<ReconstructionDTO>('/reconstructions', {
          title,
          eventId,
          scramble,
          solution,
          timeMs,
        });
        setSavedId(data.id);
        toast.success('Reconstruction saved');
        navigate(`/reconstruction/${data.id}`, { replace: true });
      }
      fetchMine();
    } catch (e) {
      toast.error(apiError(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSaved = (r: ReconstructionDTO) => {
    setTitle(r.title);
    setEventId(r.eventId);
    setScramble(r.scramble);
    setSolution(r.solution);
    setTimeInput(r.timeMs != null ? String(r.timeMs / 1000) : '');
    setSavedId(r.id);
    setShowSaved(false);
    navigate(`/reconstruction/${r.id}`);
  };

  const handleDelete = async (r: ReconstructionDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${r.title || 'Untitled'}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/reconstructions/${r.id}`);
      setMine((m) => m.filter((x) => x.id !== r.id));
      if (savedId === r.id) {
        setSavedId(null);
        navigate('/reconstruction', { replace: true });
      }
    } catch (e2) {
      toast.error(apiError(e2, 'Failed to delete'));
    }
  };

  return (
    // The two-column layout only kicks in at lg+, so that's also where we pin
    // the height to the viewport (each column scrolls internally instead of
    // the whole page). Below lg the columns stack and the page scrolls normally.
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-2rem)]">
      {/* Extra left padding when the sidebar is hidden — otherwise the floating
          restore-sidebar button sits directly on top of the page title. */}
      <div className={clsx(focusMode && 'md:pl-10')}>
        <PageHeader
          title="Reconstruction"
          subtitle="3D playback of any scramble + solution, move by move."
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn-ghost" onClick={handleShare}>
                <Icon name="copy" size={16} />
                Share
              </button>
              {user ? (
                <button className="btn-primary" onClick={handleSave} disabled={saving || !solution.trim()}>
                  <Icon name="check" size={16} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <Link to="/login" className="btn-ghost">
                  Log in to save
                </Link>
              )}
              {user && (
                <button className="btn-ghost" onClick={() => setShowSaved(true)}>
                  <Icon name="book" size={16} />
                  My Reconstructions{mine.length > 0 ? ` (${mine.length})` : ''}
                </button>
              )}
            </div>
          }
        />
      </div>

      {notFound && (
        <EmptyState title="Reconstruction not found" hint="This link may be invalid, or the reconstruction was deleted." />
      )}

      {!notFound && (
        // grid-rows-[minmax(0,1fr)] is the key to fitting exactly: without it, the
        // implicit row sizes to its tallest child's natural content height (ignoring
        // the flex-1 height budget above), which is what let both columns overflow
        // the page instead of scrolling internally within their own bounds.
        <div className="grid lg:grid-cols-[1fr_auto] lg:grid-rows-[minmax(0,1fr)] gap-6 flex-1 min-h-0">
          {/* LEFT: inputs — takes up whatever space the visualization doesn't need.
              The solution textarea is the one flexible element, so Move Count & TPS
              stays pinned in view instead of requiring a scroll to reach on a tall
              enough viewport. Only this outer column carries `min-h-0` (needed so
              flex-1 can actually shrink it below content size and hand off to
              overflow-y-auto) — the card and the solution wrapper below deliberately
              do NOT, so their auto-computed minimum height still accounts for the
              textarea's own `min-h-[6rem]` floor. Without that, on a short viewport
              the flex algorithm could size the card smaller than its content needs,
              and — since overflow defaults to visible — the textarea rendered at its
              real minimum height anyway, poking out past the card's own border
              instead of the column scrolling. */}
          <div className="flex flex-col gap-4 min-w-0 min-h-0 overflow-y-auto">
            {loadingShared ? (
              <div className="card p-5 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-10" />
                <Skeleton className="h-20" />
              </div>
            ) : (
              <div className="card p-5 flex flex-col gap-4 flex-1">
                <div className="grid sm:grid-cols-2 gap-4 shrink-0">
                  <div>
                    <label className="label">Title (optional)</label>
                    <input
                      className="input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. My reconstruction"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label className="label">Event</label>
                    <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                      <optgroup label="WCA Events">
                        {RECONSTRUCTION_WCA_EVENTS.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Unofficial Events">
                        {UNOFFICIAL_EVENTS.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Scramble</label>
                    <button
                      onClick={handleGenerateScramble}
                      disabled={scrambling}
                      className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-hover disabled:opacity-50"
                    >
                      <Icon name="refresh" size={13} className={scrambling ? 'animate-spin' : ''} />
                      Generate
                    </button>
                  </div>
                  <textarea
                    className="input font-mono text-sm resize-none"
                    rows={2}
                    value={scramble}
                    onChange={(e) => setScramble(e.target.value)}
                    placeholder="Paste your scramble here..."
                  />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="label mb-0">Solution</label>
                  <textarea
                    className="input font-mono text-sm flex-1 min-h-[6rem] resize-none"
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    onSelect={handleSolutionCursor}
                    onClick={handleSolutionCursor}
                    onKeyUp={handleSolutionCursor}
                    placeholder="Paste your solution here..."
                  />
                </div>
              </div>
            )}

            <div className="card p-5 space-y-3 shrink-0">
              <h3 className="font-bold">Move Count & TPS</h3>
              <div className="grid grid-cols-5 gap-2">
                {(
                  [
                    ['QTM', metrics.qtm],
                    ['HTM', metrics.htm],
                    ['STM', metrics.stm],
                    ['QSTM', metrics.qstm],
                    ['ETM', metrics.etm],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-gray-100 dark:bg-card-hover rounded-lg p-2 text-center">
                    <div className="text-lg font-bold">{moves.length > 0 ? value : '—'}</div>
                    <div className="text-[10px] text-muted font-semibold mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label">Your time (seconds)</label>
                  <input
                    className="input max-w-[140px]"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    placeholder="e.g. 12.34"
                    inputMode="decimal"
                  />
                </div>
                {moves.length > 0 && tps !== null && (
                  <div className="bg-accent/15 text-accent rounded-lg px-4 py-2">
                    <div className="text-2xl font-bold leading-tight">{tps.toFixed(2)}</div>
                    <div className="text-xs font-semibold">TPS (HTM ÷ time)</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: 3D visualization + controls, sized to exactly what it needs. */}
          <div
            className="card p-6 flex flex-col items-center gap-4 min-h-0 overflow-y-auto mx-auto lg:mx-0"
            style={{ width: cubeSize + 48, maxWidth: '100%' }}
          >
            {title && <h2 className="font-bold text-lg text-center shrink-0">{title}</h2>}

            <div className="shrink-0">
              <ReconstructionPlayer
                ref={handleRef}
                scramble={scramble}
                solution={solution}
                puzzle={puzzle}
                size={cubeSize}
                onProgress={setProgress}
              />
            </div>

            {moves.length > 0 && (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="btn-ghost !p-2" title="Jump to start" onClick={() => handleRef.current?.jumpToStart()}>
                    <Icon name="skipBack" size={18} />
                  </button>
                  <button className="btn-ghost !p-2" title="Previous move" onClick={() => handleRef.current?.stepBackward()}>
                    <Icon name="arrowLeft" size={18} />
                  </button>
                  <button
                    className="btn-primary !px-5 !py-2.5"
                    title={progress.playing ? 'Pause' : 'Play'}
                    onClick={() => handleRef.current?.togglePlay()}
                  >
                    <Icon name={progress.playing ? 'pause' : 'play'} size={20} />
                  </button>
                  <button className="btn-ghost !p-2" title="Next move" onClick={() => handleRef.current?.stepForward()}>
                    <Icon name="arrowRight" size={18} />
                  </button>
                  <button className="btn-ghost !p-2" title="Jump to end" onClick={() => handleRef.current?.jumpToEnd()}>
                    <Icon name="skipForward" size={18} />
                  </button>
                </div>

                <div className="w-full flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted font-mono w-10 text-right shrink-0">
                    {progress.index}/{progress.total}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(progress.fraction * 1000)}
                    onChange={(e) => handleRef.current?.seekFraction(Number(e.target.value) / 1000)}
                    className="flex-1 accent-accent min-w-0"
                  />
                  <select
                    className="input !w-auto !py-1 text-xs shrink-0"
                    value={speed}
                    onChange={(e) => {
                      const s = Number(e.target.value);
                      setSpeed(s);
                      handleRef.current?.setTempo(s);
                    }}
                  >
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}×
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={showSaved} onClose={() => setShowSaved(false)} title="My Reconstructions" size="md">
        {minePending && (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        {!minePending && mine.length === 0 && <p className="text-sm text-muted">Nothing saved yet.</p>}
        <div className="space-y-2">
          {mine.map((r) => (
            <button
              key={r.id}
              onClick={() => handleLoadSaved(r)}
              className={clsx(
                'w-full text-left p-3 rounded-lg border transition-colors flex items-start justify-between gap-2',
                savedId === r.id ? 'border-accent bg-accent/10' : 'border-gray-200 dark:border-border hover:bg-gray-100 dark:hover:bg-card-hover',
              )}
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{r.title || 'Untitled'}</div>
                <div className="text-xs text-muted mt-0.5">
                  {getEvent(r.eventId)?.name ?? r.eventId} · {formatDate(r.createdAt)}
                </div>
              </div>
              <button onClick={(e) => handleDelete(r, e)} className="text-muted hover:text-red-400 shrink-0" title="Delete">
                <Icon name="trash" size={16} />
              </button>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
