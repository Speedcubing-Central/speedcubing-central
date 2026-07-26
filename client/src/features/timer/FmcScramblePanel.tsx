import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrambleImage } from '../../components/ScrambleImage';
import { ScrambleText } from '../../components/ScrambleText';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

// Matches ScrambleImage's own default size for 333fm (see its SIZE_MAP) —
// the size used whenever there's room for it.
const PREFERRED_DIAGRAM = 250;
const MIN_DIAGRAM = 90;
// pt-3 (12px) + pb-6 (24px) — deliberately less padding above the diagram
// than below the bullets, since the diagram already reads as having margin
// of its own (its bounding box isn't fully filled by the drawn cube net) —
// plus the two gap-4's the panel's flex column now has: one between the
// Notes button row and the diagram, one between the diagram and the
// text-and-bullets block below it. Must stay in sync with the classNames
// below, same convention as useDiagramFit's own FIXED_OVERHEAD.
const FIXED_OVERHEAD = 12 + 24 + 16 + 16;

// FMC-only — deliberately not a reuse of the shared ScramblePanel. That
// component anchors its content to the bottom (`justify-end`), which makes
// sense when it shares a column with a timer card below it, but here it
// gets the entire column to itself, and `justify-end` just left most of
// that height as dead space above the diagram. Pinning the scramble to the
// top instead, and filling the reclaimed space below with the official
// TNoodle scorecard instructions, uses the space and doubles as the actual
// rules a competitor would see on a real WCA scoresheet.
//
// The diagram shrinks (never crops) to whatever's left after the text and
// instruction list — both a fixed, non-shrinking size — so the panel never
// needs to scroll on an ordinary desktop viewport. Measuring the panel's
// own rendered height here isn't the usual "circular sizing" trap (see
// useDiagramFit's warning about that) specifically because this panel's
// height comes from its parent's `h-full` column, not from its own
// content — it's an externally fixed budget, just read directly instead of
// threaded down as a prop.
export function FmcScramblePanel({ scramble }: { scramble: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const aboveRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const [diagramSize, setDiagramSize] = useState(PREFERRED_DIAGRAM);
  const [notesOpen, setNotesOpen] = useState(false);
  // Scratch space only — deliberately never persisted (no localStorage,
  // no store, no server) and never read by useFmcEngine or the real
  // solution input in FmcMoveInput. Survives closing/reopening the
  // notepad within one attempt, but reset below whenever the scramble
  // changes, so it never carries over into the next attempt.
  const [notes, setNotes] = useState('');

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const above = aboveRef.current;
    const below = belowRef.current;
    if (!panel || !above || !below) return;
    const recompute = () => {
      const available = panel.clientHeight - FIXED_OVERHEAD - above.scrollHeight - below.scrollHeight;
      setDiagramSize(Math.max(MIN_DIAGRAM, Math.min(PREFERRED_DIAGRAM, available)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(panel);
    ro.observe(above);
    ro.observe(below);
    return () => ro.disconnect();
  }, [scramble]);

  useEffect(() => {
    setNotes('');
  }, [scramble]);

  return (
    // overflow-y-auto stays as a last-resort fallback (e.g. an unusually
    // short window) — MIN_DIAGRAM keeps the diagram legible rather than
    // shrinking it to nothing to force a fit, so on a genuinely cramped
    // viewport a small, harmless scrollbar is the correct outcome, not a bug.
    <div ref={panelRef} className="card h-full pt-3 pb-6 px-6 flex flex-col items-center gap-4 overflow-y-auto">
      <div ref={aboveRef} className="w-full shrink-0 flex justify-center">
        <button
          className="btn-ghost text-muted hover:text-accent transition-colors flex items-center gap-1.5 text-sm px-3 py-1.5"
          onClick={() => setNotesOpen(true)}
        >
          <Icon name="pencil" size={15} />
          Notes
        </button>
      </div>
      <ScrambleImage eventId="333fm" scramble={scramble} size={diagramSize} />
      <div ref={belowRef} className="w-full shrink-0">
        <div className="font-mono tracking-wide leading-snug w-full text-center text-2xl">
          <ScrambleText scramble={scramble} eventId="333fm" />
        </div>
        <ul className="text-sm text-muted space-y-2 list-disc pl-5 w-full max-w-lg mx-auto mt-8">
          <li>You have 60 minutes to find and type a solution.</li>
          <li>Your solution must not be directly derived from any part of the scrambling algorithm.</li>
          <li>Your solution must be at most 80 moves, including rotations.</li>
          <li>Your result will be counted in OBTM.</li>
          <li>Allowed moves: U, D, L, R, F, and B, each optionally followed by a prime or a 2.</li>
          <li>Wide moves are allowed as Rw, Fw, and so on, not as a lowercase letter on its own.</li>
          <li>Rotations (x, y, z) are also allowed and never count toward your move total.</li>
        </ul>
      </div>

      <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="Notes" size="lg">
        <p className="text-xs text-muted mb-2">
          Scratch space for this attempt only, not saved anywhere, and cleared on your next attempt.
        </p>
        <textarea
          className="input font-mono text-sm w-full resize-y"
          rows={12}
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot down anything about the scramble…"
        />
      </Modal>
    </div>
  );
}
