import { useRef } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { ScrambleImage } from './ScrambleImage';
import { ScrambleText } from './ScrambleText';
import { useDiagramFit } from './useDiagramFit';

// Per-puzzle preferred diagram size, in px — the size used whenever there's
// room for it. sq1's 3D render is legible small; megaminx's 2D net needs to
// be bigger to read; everything else gets a generously-sized default.
const DIAGRAM_SIZE: Record<string, number> = { sq1: 220, minx: 320 };
const DEFAULT_DIAGRAM_SIZE = 300;

// Text size is a simple, static tier based on how much the scramble
// actually has — not fit to any available space, just what reads well.
function textSize(scramble: string, eventId: string): number {
  if (eventId === 'minx') return 19;
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
  maxHeight,
  className,
}: {
  eventId: string;
  scramble: string;
  loading?: boolean;
  onRefresh?: () => void;
  maxHeight?: number;
  className?: string;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const preferredDiagram = DIAGRAM_SIZE[eventId] ?? DEFAULT_DIAGRAM_SIZE;
  const font = textSize(scramble, eventId);

  const diagramSize = useDiagramFit(textRef, btnRef, maxHeight, preferredDiagram, [eventId, scramble, loading, font]);

  return (
    <div className={clsx('card p-4 shrink-0 overflow-hidden flex flex-col items-center justify-end gap-4', className)}>
      <ScrambleImage eventId={eventId} scramble={scramble} size={diagramSize} />
      <div ref={textRef} className="font-mono tracking-wide leading-snug w-full text-center" style={{ fontSize: font }}>
        {loading ? <span className="text-muted text-base">Scrambling…</span> : <ScrambleText scramble={scramble} eventId={eventId} />}
      </div>
      {onRefresh && (
        <button ref={btnRef} className="text-xs text-accent inline-flex items-center gap-1" onClick={onRefresh}>
          <Icon name="refresh" size={13} /> new scramble
        </button>
      )}
    </div>
  );
}
