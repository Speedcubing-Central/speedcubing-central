import { InteractionManager } from 'react-native';
import { parse, type JsxAST } from 'react-native-svg';
import { hasScrambleImage, renderScrambleImage } from './cubingSvg';

// ── Scramble drawings, prepared before they are needed ─────────────────────
//
// Turning a scramble into something react-native-svg will draw is two steps,
// and both of them are plain JS work on the same thread that runs the timer:
//
//   1. renderScrambleImage (lib/cubingSvg): apply the scramble to a KPuzzle and
//      repaint every sticker in the artwork. Measured in Node: 0.35ms for a
//      3x3, 1.05ms for a 7x7.
//   2. parse: turn that SVG source into the React element tree SvgXml renders.
//      This is the expensive half. The output is 81 elements for a 3x3 and 313
//      for a 7x7, each of which becomes a native view.
//
// Both used to happen in the frame the timer stops, because that is when the
// Timer moves to the next scramble. It is the worst possible moment: the same
// frame is already recording the solve, bringing back the chrome that was
// hidden during the attempt, and re-laying out the column.
//
// Nothing about that work has to happen then. The scrambler prefetches a queue,
// so the *next* scramble is known seconds in advance, and this module is where
// it gets turned into a drawing ahead of time. By the time the timer stops, the
// answer is a Map lookup.
//
// `parse` and the AST are used rather than `SvgXml` deliberately. SvgXml
// memoises its parse per component instance and keyed on the xml string, so a
// new scramble always pays for the parse inside the render that shows it, which
// is exactly the cost being moved. `SvgAst` takes the already-parsed tree.

export interface ScrambleDrawing {
  /** Pre-parsed, ready for react-native-svg's SvgAst. */
  ast: JsxAST | null;
  /** width / height of the drawing. */
  aspect: number;
}

// Entries hold a React element tree, so this is not free memory. Eight covers
// what is actually reachable at once: the scramble on screen, the prewarmed
// next one, the one "previous scramble" can go back to, and a few from before
// an event switch.
const MAX_ENTRIES = 8;

// Successes only. A drawing that failed to build is deliberately not recorded,
// so the next attempt retries instead of being handed the failure again: see
// prepareScrambleDrawing, and the same rule one layer down in cubingSvg's
// loadCached, which is where a single failure used to poison a whole puzzle for
// the life of the app.
const drawings = new Map<string, ScrambleDrawing>();
const inFlight = new Map<string, Promise<ScrambleDrawing | null>>();

function keyFor(eventId: string, scramble: string): string {
  return `${eventId}|${scramble}`;
}

function remember(key: string, drawing: ScrambleDrawing): void {
  // Re-insert on write so iteration order is least-recently-used first.
  drawings.delete(key);
  drawings.set(key, drawing);
  while (drawings.size > MAX_ENTRIES) {
    const oldest = drawings.keys().next();
    if (oldest.done) break;
    drawings.delete(oldest.value);
  }
}

/**
 * The drawing for this scramble if it is already prepared.
 *
 * `undefined` means "not prepared", which is distinct from `null` ("prepared,
 * and there is no drawing for this event"). Callers use that difference to tell
 * a cache miss from a genuine absence, so the first must not be reported as the
 * second.
 *
 * A pure lookup, deliberately: this is called during render, so it must not
 * reorder the cache on the way past. Nothing is lost by that. Entries are only
 * ever evicted on a write, writes happen about once per solve, and the entry
 * being displayed is always the second newest (the newest is the prewarm for
 * the scramble after it), so it is never near the end of the queue.
 */
export function preparedScrambleDrawing(eventId: string, scramble: string): ScrambleDrawing | null | undefined {
  if (!scramble || !hasScrambleImage(eventId)) return null;
  return drawings.get(keyFor(eventId, scramble));
}

/** Prepares the drawing, reusing an in-flight preparation of the same one. */
export function prepareScrambleDrawing(eventId: string, scramble: string): Promise<ScrambleDrawing | null> {
  if (!scramble || !hasScrambleImage(eventId)) return Promise.resolve(null);
  const key = keyFor(eventId, scramble);

  const ready = drawings.get(key);
  if (ready !== undefined) return Promise.resolve(ready);

  const running = inFlight.get(key);
  if (running) return running;

  const work = renderScrambleImage(eventId, scramble)
    .then((image) => {
      // parse throws on malformed input rather than returning null, and a
      // scramble that cannot be drawn must leave the previous drawing up
      // rather than take down the screen it is a decoration on.
      let ast: JsxAST | null = null;
      try {
        ast = image ? parse(image.xml) : null;
      } catch {
        ast = null;
      }
      if (!image || !ast) {
        // Not cached. A failure here is usually the puzzle's artwork having
        // failed to load, which is transient, so the next scramble gets a fresh
        // attempt rather than inheriting this one's bad luck.
        return null;
      }
      const drawing: ScrambleDrawing = { ast, aspect: image.aspect };
      remember(key, drawing);
      return drawing;
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, work);
  return work;
}

/**
 * Prepares a scramble the app expects to show soon, off the critical path.
 *
 * Deferred until interactions have finished on purpose. The upcoming scramble
 * becomes known at the moment the previous one is swapped in, which is the
 * frame the timer stops, so doing this eagerly would just move the cost from
 * one stop frame to another. After interactions it lands in the quiet stretch
 * where the solver is reading their time.
 */
export function prewarmScrambleDrawing(eventId: string, scramble: string): () => void {
  if (!scramble || !hasScrambleImage(eventId)) return () => undefined;
  if (drawings.has(keyFor(eventId, scramble))) return () => undefined;

  const handle = InteractionManager.runAfterInteractions(() => {
    void prepareScrambleDrawing(eventId, scramble);
  });
  return () => handle.cancel();
}
