import { useEffect, useRef, useState } from 'react';
import { RotatingCaseDiagram } from '../../components/CubeDiagram';
import type { AlgCase, AlgSet } from '../../data/algSets';
import { IS_2x2, rotatingStickering } from './algDiagram';

const MIN_DIAGRAM = 90;
const MAX_DIAGRAM = 480;
const CARD_PADDING_H = 48; // p-6, left + right
// p-6 padding (48px) + one gap-4 (16px) between the diagram and the text
// below it — matches this card's own className, so update if that changes.
const FIXED_OVERHEAD = 64;

// The trainer's diagram + scramble-text card. Unlike Timer's ScramblePanel
// (which shrinks to a *preferred* size but never grows past it, since a
// short scramble legitimately doesn't need much room), the trainer wants
// its tiles to actively fill whatever space is available — so this grows
// the diagram up to MAX_DIAGRAM whenever the column has the room, and only
// shrinks (down to MIN_DIAGRAM) when it doesn't. Sized against the card's
// own width (via ResizeObserver, so window/column resizes are caught) and
// an externally-supplied height budget (`maxHeight`, from the column's
// measured leftover space — see TrainingLeftColumn).
export function CaseDiagramPanel({
  set,
  c,
  alg,
  scrambleText,
  maxHeight,
  resetSignal,
}: {
  set: AlgSet;
  c: AlgCase;
  alg: string;
  scrambleText: string;
  maxHeight?: number;
  resetSignal?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [diagramSize, setDiagramSize] = useState(280);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const recompute = () => {
      const widthCap = card.clientWidth - CARD_PADDING_H;
      if (maxHeight === undefined) {
        setDiagramSize(Math.max(MIN_DIAGRAM, Math.min(widthCap, MAX_DIAGRAM)));
        return;
      }
      const textHeight = textRef.current?.scrollHeight ?? 0;
      const heightCap = maxHeight - FIXED_OVERHEAD - textHeight;
      setDiagramSize(Math.max(MIN_DIAGRAM, Math.min(widthCap, heightCap, MAX_DIAGRAM)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(card);
    return () => ro.disconnect();
  }, [maxHeight, alg, scrambleText]);

  return (
    <div ref={cardRef} className="card p-6 shrink-0 overflow-hidden flex flex-col items-center justify-center gap-4">
      <RotatingCaseDiagram
        alg={alg}
        size={diagramSize}
        defaultLat={30}
        puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
        diagramPrefix={c.diagramPrefix}
        stickering={rotatingStickering(set.kind)}
        resetSignal={resetSignal}
      />
      <div ref={textRef} className="font-mono text-base font-semibold text-primary text-center leading-relaxed break-all w-full">
        {scrambleText}
      </div>
    </div>
  );
}
