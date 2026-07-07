import { useRef } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { ScrambleImage } from './ScrambleImage';
import { ScrambleText } from './ScrambleText';
import { useScrambleTextFit } from './useScrambleTextFit';

// Per-puzzle preferred diagram size, in px — only overridden for the two
// events with real visual tuning (sq1's 3D render is legible small;
// megaminx's 2D net needs to be bigger to read). Everything else falls back
// to ScrambleImage's own SIZE_MAP defaults. The diagram is never distorted
// or cropped to hit a size — useScrambleTextFit only ever reduces this
// plain numeric value as a last resort on very short windows, which
// ScrambleImage renders undistorted at whatever size it's given.
const DIAGRAM_SIZE: Record<string, number> = { sq1: 180, minx: 230 };
const DEFAULT_DIAGRAM_SIZE = 250;

// The scramble diagram and its formatted text, used by both the Timer page
// and Battle Mode so there's one implementation instead of duplicated
// per-event markup.
//
// `fitText` enables dynamic sizing against the card's own rendered height —
// only correct (and only ever pass `true`) when the caller makes this card a
// genuine flex-grow item (flex-basis 0, min-height 0), so its height comes
// from CSS layout math rather than from its own content. See
// useScrambleTextFit for why this distinction matters. When omitted/false, a
// simple static font tier is used instead (Battle Mode's card and the Timer
// page's mobile layout both let the card size to its content, where dynamic
// fitting would be circular).
export function ScramblePanel({
  eventId,
  scramble,
  loading = false,
  onRefresh,
  fitText = false,
  className,
}: {
  eventId: string;
  scramble: string;
  loading?: boolean;
  onRefresh?: () => void;
  fitText?: boolean;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const preferredDiagram = DIAGRAM_SIZE[eventId] ?? DEFAULT_DIAGRAM_SIZE;

  const { diagramSize, fontPx } = useScrambleTextFit(cardRef, textRef, btnRef, fitText, scramble, eventId, preferredDiagram, [
    eventId,
    scramble,
    loading,
  ]);

  return (
    <div
      ref={cardRef}
      className={clsx('card p-4 shrink-0 overflow-hidden flex flex-col items-center justify-center gap-4', className)}
    >
      <ScrambleImage eventId={eventId} scramble={scramble} size={fitText ? diagramSize : preferredDiagram} />
      <div
        ref={textRef}
        className="font-mono tracking-wide leading-snug w-full text-center"
        style={{ fontSize: fontPx }}
      >
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
