// Temporary instrumentation for "the Timer hangs for a second or two after a
// solve".
//
// It is here because guessing has not worked. The scramble image was measured at
// about a millisecond and is prewarmed, the chrome's animations are a couple of
// hundred milliseconds, and neither accounts for what is actually being seen. So
// this records when each step of finishing a solve happens on the device and
// prints one line per solve, which reaches the Metro console.
//
// Dev only, and intended to be removed once it has told us where the time goes.
const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

let startedAt = 0;
let solveNo = 0;

// So a silent run can be told apart from an uninstrumented one. The first
// attempt at this produced nothing, and without a line like this there was no
// way to know whether the device was running the traced bundle at all.
if (enabled) console.warn('[solve-trace] armed');

/** Begins a trace. */
export function traceStart(label: string): void {
  if (!enabled) return;
  startedAt = now();
  solveNo++;
  mark(label);
}

/**
 * Records a labelled moment, and prints it immediately.
 *
 * Printed per mark rather than collected and flushed at the end. The batching
 * version needed a timer to fire and the app to still be on the screen when it
 * did, and when the output came back empty there was no way to tell a trace
 * that found nothing from one that never ran. One line per step is noisier and
 * has nothing left to go wrong.
 *
 * console.warn, not console.log: only warn and error are forwarded from the
 * device to the Metro console here, which is what swallowed the first attempt.
 */
export function mark(label: string): void {
  if (!enabled || startedAt === 0) return;
  console.warn(`[solve-trace] #${solveNo} ${Math.round(now() - startedAt)}ms ${label}`);
}
