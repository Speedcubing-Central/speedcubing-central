import { useEffect, useRef } from 'react';
import clsx from 'clsx';

// WCA/SiGN face-turn letters (always stored uppercase) vs. cube-rotation
// letters (always stored lowercase) — kept as two sets since a rotation
// gets a visual "doesn't count" treatment elsewhere (see ROTATION_RE below)
// and the two must never collide regardless of what case the user typed.
// Deliberately no M/E/S: WCA FMC results are scored in Outer Block Turn
// Metric (Regulation E2d), which only counts turns of a block anchored to
// an outer face — a slice move isn't one of those, so real FMC solutions
// are written using only the 6 face letters (plus rotations, which never
// count at all). Accepting M/E/S here would let someone enter and be
// scored on notation that isn't actually part of how FMC is measured.
const FACE_LETTERS = new Set(['U', 'D', 'L', 'R', 'F', 'B']);
const ROTATION_LETTERS = new Set(['X', 'Y', 'Z']);
const ROTATION_RE = /^[xyz]/;

// A box holds: one face letter, optionally a 'w' right after it (wide move
// — Rw, Fw, ... — never lowercase-as-wide, which WCA notation doesn't
// recognize the same way), then optionally one `'`/`2` modifier. Rotations
// never take a 'w'.
function normalizeLetter(key: string): string | null {
  const upper = key.toUpperCase();
  if (FACE_LETTERS.has(upper)) return upper;
  if (ROTATION_LETTERS.has(upper)) return upper.toLowerCase();
  return null;
}

// Whether `cur` is still eligible to take a 'w' suffix — a bare face letter
// with nothing after it yet.
function canTakeWide(cur: string): boolean {
  return cur.length === 1 && FACE_LETTERS.has(cur);
}

// Whether `cur` is still eligible to take a `'`/`2` modifier — a bare
// letter (face or rotation) or a wide move, neither with a modifier yet.
function canTakeModifier(cur: string): boolean {
  return cur.length === 1 || (cur.length === 2 && cur[1] === 'w');
}

// Keeps exactly one empty box at the end at all times — that trailing box
// is what lets typing a letter immediately after finishing the previous
// move "just work" without an explicit "add move" action.
function ensureTrailingEmpty(arr: string[]): string[] {
  return arr.length === 0 || arr[arr.length - 1] !== '' ? [...arr, ''] : arr;
}

export function FmcMoveInput({
  moves,
  onChange,
  disabled,
}: {
  moves: string[];
  onChange: (moves: string[]) => void;
  disabled?: boolean;
}) {
  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Which box to focus after the next render — set inside a key handler,
  // consumed by the effect below. Needed because the box we want to focus
  // sometimes doesn't exist in the DOM yet until `moves` (and thus the
  // rendered box list) actually updates.
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocus.current !== null) {
      const el = boxRefs.current[pendingFocus.current];
      if (el) {
        el.focus();
        // Explicit, since a browser's default caret placement on refocusing
        // an already-populated input isn't guaranteed to be the end —
        // needed for Backspace landing back on a previous box that still
        // has its own content (see the Backspace handler above).
        el.setSelectionRange(el.value.length, el.value.length);
      }
      pendingFocus.current = null;
    }
  });

  function setMoves(mutate: (arr: string[]) => { next: string[]; focus: number }) {
    const { next, focus } = mutate([...moves]);
    pendingFocus.current = focus;
    onChange(ensureTrailingEmpty(next));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    const key = e.key;

    const letter = normalizeLetter(key);
    if (letter && key.length === 1) {
      e.preventDefault();
      setMoves((next) => {
        if (!next[index]) {
          next[index] = letter;
          return { next, focus: index };
        }
        // Box already has a move — leave it as-is and insert a fresh box
        // right after it for the new letter, rather than overwriting
        // whatever box already happened to be next. At the true end of the
        // list that's a no-op difference (the "next" box is just the
        // trailing empty one either way), but it's what makes continuing
        // to type safe immediately after a mid-sequence insertion (see the
        // Space handler below) — without this, typing a second move right
        // after a just-inserted one would clobber the real move that used
        // to follow it instead of making room for both.
        const target = index + 1;
        next.splice(target, 0, letter);
        return { next, focus: target };
      });
      return;
    }

    if (key === 'w' || key === 'W') {
      e.preventDefault();
      setMoves((next) => {
        const cur = next[index] ?? '';
        if (canTakeWide(cur)) next[index] = cur + 'w';
        return { next, focus: index };
      });
      return;
    }

    if (key === "'" || key === '2') {
      e.preventDefault();
      setMoves((next) => {
        const cur = next[index] ?? '';
        // A bare letter or a wide move (no modifier yet) can take one —
        // WCA notation never stacks modifiers (no "R'2", no "Rw'2").
        if (canTakeModifier(cur)) next[index] = cur + key;
        return { next, focus: index };
      });
      return;
    }

    // Inserts a fresh empty box right after this one and focuses it —
    // the way to add a move you forgot in the middle of the sequence
    // without retyping everything after it. Works the same regardless of
    // whether the current box is empty or already has a move.
    if (key === ' ') {
      e.preventDefault();
      setMoves((next) => {
        const target = index + 1;
        next.splice(target, 0, '');
        return { next, focus: target };
      });
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      setMoves((next) => {
        const cur = next[index] ?? '';
        if (cur.length > 0) {
          next[index] = cur.slice(0, -1);
          return { next, focus: index };
        }
        if (index > 0) {
          // The box itself is already empty — remove it outright rather
          // than clearing whatever's in the previous box. Focus lands back
          // on the previous box with its content left exactly as it was
          // (see the focus effect below, which places the cursor at the
          // end of it), the same way backspacing into an empty line in a
          // text editor removes that line without touching the one above.
          next.splice(index, 1);
          return { next, focus: index - 1 };
        }
        return { next, focus: index };
      });
      return;
    }

    if (key === 'ArrowLeft') {
      e.preventDefault();
      if (index > 0) boxRefs.current[index - 1]?.focus();
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      if (index < moves.length - 1) boxRefs.current[index + 1]?.focus();
      return;
    }

    // Anything else (letters that aren't valid moves, digits other than
    // '2', punctuation, ...) never reaches the box at all — every real
    // mutation above already went through e.preventDefault(), so nothing
    // is lost by also blocking everything unrecognized.
    if (key !== 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {moves.map((m, i) => (
        <input
          key={i}
          ref={(el) => { boxRefs.current[i] = el; }}
          className={clsx(
            'input w-12 h-11 text-center font-mono text-base font-bold p-0',
            ROTATION_RE.test(m) && 'text-muted italic font-normal',
          )}
          value={m}
          onChange={() => {
            /* all real mutation happens in onKeyDown; this just satisfies
               React's controlled-input requirement */
          }}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          maxLength={3}
          inputMode="none"
          autoComplete="off"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
