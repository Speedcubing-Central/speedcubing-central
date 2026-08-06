import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { ScrambleImage, DIAGRAM_ASPECT } from './ScrambleImage';
import { ScrambleText } from './ScrambleText';
import { useDiagramFit } from './useDiagramFit';
import { validateCustomScramble } from '../lib/customScramble';

// Per-puzzle preferred diagram HEIGHT, in px — the size used whenever there's
// room for it. sq1's 3D render is legible small; megaminx's 2D net needs to
// be bigger to read; everything else gets a generously-sized default. Width
// follows from the puzzle's net shape (ScrambleImage's DIAGRAM_ASPECT), so
// these stay the budget for the scarce dimension: vertical space is what the
// panel has to share with the timer card below it.
//
// fto is the one puzzle where the default height buys too much diagram. Its
// net is a 2.1:1 strip, so a height that gives a 4:3 cube net a sensible
// diagram gives FTO one about twice as wide as it was before it stopped being
// letterboxed, which is more than the panel wants to give it. 180 lands it
// modestly above its old size (a 324x154 net against the old 278x132) rather
// than at the 541x257 the shared default produces.
const DIAGRAM_SIZE: Record<string, number> = { sq1: 200, minx: 320, fto: 180 };
const DEFAULT_DIAGRAM_SIZE = 300;

// Extra space (px) inserted between the diagram and the text below it, on
// top of the standard gap-4. sq1's 3D render doesn't sit centered in its
// box the way the 2D top-down views do — the visible cube extends close to
// the bottom of its bounding square — so the standard gap alone reads as
// almost no space at all between the cube and the scramble text, even
// though the box itself is unchanged.
const EXTRA_GAP: Record<string, number> = { sq1: 24 };

// Text size is a simple, static tier based on how much the scramble
// actually has — not fit to any available space, just what reads well.
function textSize(scramble: string, eventId: string): number {
  if (eventId === 'minx') return 13;
  if (eventId === 'sq1') return 16;
  const n = scramble.length;
  if (n <= 30) return 36;
  if (n <= 50) return 30;
  if (n <= 80) return 24;
  if (n <= 140) return 20;
  return 18;
}

// The scramble diagram and its formatted text, used by both the Timer page
// and Battle Mode so there's one implementation instead of duplicated
// per-event markup. Different events are allowed to produce
// differently-sized panels (a short 3x3 scramble and a 7-line megaminx one
// legitimately need different amounts of room) — text is always its
// preferred static size, and the diagram renders at its preferred size too
// UNLESS the caller supplies `maxHeight`, in which case the diagram shrinks
// (never crops) to fit that budget. See useDiagramFit for why `maxHeight`
// must come from measurements independent of this panel's own size.
export function ScramblePanel({
  eventId,
  scramble,
  loading = false,
  onRefresh,
  onGoBack,
  canGoBack = false,
  onCustomScramble,
  maxHeight,
  className,
}: {
  eventId: string;
  scramble: string;
  loading?: boolean;
  onRefresh?: () => void;
  // Both optional and independent of onRefresh — a caller with no back
  // history to offer (Battle Mode, which doesn't pass onRefresh either)
  // simply omits them and only the "new scramble" button renders.
  onGoBack?: () => void;
  canGoBack?: boolean;
  // Also optional and independent of onRefresh/onGoBack, same opt-in
  // pattern: Battle Mode never passes this either, so it never gets the
  // edit button.
  onCustomScramble?: (scramble: string) => void;
  maxHeight?: number;
  className?: string;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const preferredDiagram = DIAGRAM_SIZE[eventId] ?? DEFAULT_DIAGRAM_SIZE;
  const font = textSize(scramble, eventId);
  const extraGap = EXTRA_GAP[eventId] ?? 0;

  const aspect = DIAGRAM_ASPECT[eventId] ?? 1;

  const diagramSize = useDiagramFit(textRef, btnRef, maxHeight, preferredDiagram, [eventId, scramble, loading, font], extraGap, aspect);

  function openEditor() {
    setDraft('');
    setError('');
    setEditing(true);
  }

  async function submitCustomScramble() {
    setValidating(true);
    const result = await validateCustomScramble(eventId, draft);
    setValidating(false);
    if (!result.ok) {
      setError(result.error ?? 'Invalid scramble');
      return;
    }
    onCustomScramble?.(result.scramble);
    setEditing(false);
  }

  return (
    <div className={clsx('card p-6 shrink-0 overflow-hidden flex flex-col items-center justify-end gap-4', className)}>
      <ScrambleImage eventId={eventId} scramble={scramble} size={diagramSize} />
      <div
        ref={textRef}
        className="font-mono tracking-wide leading-snug w-full text-center"
        style={{ fontSize: font, marginTop: extraGap }}
      >
        {loading ? <span className="text-muted text-base">Scrambling…</span> : <ScrambleText scramble={scramble} eventId={eventId} />}
      </div>
      {onRefresh && (
        <div ref={btnRef} className="flex items-center gap-3">
          {onGoBack && (
            <button
              className="text-xs text-accent inline-flex items-center gap-1 disabled:text-muted disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onGoBack}
              disabled={!canGoBack}
              title="Previous scramble"
            >
              <Icon name="arrowLeft" size={13} /> previous
            </button>
          )}
          <button className="text-xs text-accent inline-flex items-center gap-1" onClick={onRefresh}>
            <Icon name="refresh" size={13} /> new scramble
          </button>
          {onCustomScramble && (
            <button className="text-xs text-accent inline-flex items-center gap-1" onClick={openEditor} title="Enter a custom scramble">
              <Icon name="pencil" size={13} /> edit
            </button>
          )}
        </div>
      )}

      {onCustomScramble && (
        <Modal open={editing} onClose={() => setEditing(false)} title="Custom scramble" size="sm">
          <div className="flex flex-col gap-3">
            <textarea
              className="input font-mono text-sm w-full resize-y"
              rows={4}
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
              placeholder="e.g. R U R' U' F2 D L"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitCustomScramble();
              }}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button className="btn-primary" onClick={submitCustomScramble} disabled={validating}>
              {validating ? 'Checking…' : 'Use this scramble'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
