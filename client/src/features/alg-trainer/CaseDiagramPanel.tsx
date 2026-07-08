import { useRef } from 'react';
import { RotatingCaseDiagram } from '../../components/CubeDiagram';
import { useDiagramFit } from '../../components/useDiagramFit';
import type { AlgCase, AlgSet } from '../../data/algSets';
import { IS_2x2, rotatingStickering } from './algDiagram';

const PREFERRED_DIAGRAM_SIZE = 280;

// The trainer's diagram + scramble-text card, sized the same way
// ScramblePanel sizes the Timer's diagram — shrink (never crop) to fit an
// externally-supplied height budget. Same p-6/gap-4 structure as
// ScramblePanel so useDiagramFit's fixed overhead assumption still holds.
export function CaseDiagramPanel({
  set,
  c,
  alg,
  scrambleText,
  maxHeight,
}: {
  set: AlgSet;
  c: AlgCase;
  alg: string;
  scrambleText: string;
  maxHeight?: number;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const diagramSize = useDiagramFit(textRef, btnRef, maxHeight, PREFERRED_DIAGRAM_SIZE, [set.id, c.id, scrambleText]);

  return (
    <div className="card p-6 shrink-0 overflow-hidden flex flex-col items-center justify-end gap-4">
      <RotatingCaseDiagram
        alg={alg}
        size={diagramSize}
        defaultLat={30}
        puzzle={IS_2x2(set.kind) ? '2x2x2' : '3x3x3'}
        diagramPrefix={c.diagramPrefix}
        stickering={rotatingStickering(set.kind)}
      />
      <div ref={textRef} className="font-mono text-base font-semibold text-primary text-center leading-relaxed break-all w-full">
        {scrambleText}
      </div>
    </div>
  );
}
