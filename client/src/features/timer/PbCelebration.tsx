import { useEffect, useMemo } from 'react';
import { formatTime, formatMoveCount } from '@scc/shared';
import type { PbHit } from './stats';

// Kept comfortably under the 3s cap the feature calls for — confetti pieces
// are randomized to finish within this window (see piece duration/delay
// bounds below) so the overlay's removal essentially never has to cut one
// off mid-fall.
const CELEBRATION_MS = 2800;
const CONFETTI_COUNT = 48;
const CONFETTI_COLORS = ['#2b72ff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#facc15'];

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  drift: number;
}

export function PbCelebration({
  hits,
  precision,
  isFmc,
  onDone,
}: {
  hits: PbHit[];
  precision: 2 | 3;
  isFmc?: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    const timeout = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);

  // Regenerated only when a new set of hits comes in (not on every render),
  // so the confetti doesn't restart/jump mid-animation.
  const pieces: ConfettiPiece[] = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.4 + Math.random() * 0.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: 180 + Math.random() * 540,
        drift: (Math.random() - 0.5) * 140,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hits],
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--confetti-drift': `${p.drift}px`,
              '--confetti-rotate': `${p.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bg-black/70 rounded-2xl px-6 py-5 flex flex-col items-center gap-1.5 shadow-2xl">
          {hits.map((h, i) => (
            <div
              key={`${h.label}-${i}`}
              className="pb-text-enter font-mono font-extrabold text-2xl md:text-3xl text-white text-center whitespace-nowrap"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              {isFmc ? formatMoveCount(h.value, 'NONE', h.label === 'single' ? 0 : 2) : formatTime(Math.round(h.value), 'NONE', precision)}{' '}
              <span className="text-accent">PB {h.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
