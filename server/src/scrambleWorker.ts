import { parentPort } from 'node:worker_threads';

// Runs cubing.js scramble generation in an isolated worker thread so its
// WASM state (kilominx's "twips" solver in particular) can be thrown away
// by terminating this whole thread — see scramble.ts's worker pool for why
// that's necessary, not optional. Nothing here is exported; this file is
// only ever loaded via `new Worker(...)`.
parentPort?.on('message', async (msg: { id: number; eventId: string }) => {
  try {
    const { randomScrambleForEvent } = await import('cubing/scramble');
    const alg = await randomScrambleForEvent(msg.eventId);
    parentPort!.postMessage({ id: msg.id, scramble: alg.toString() });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: e instanceof Error ? e.message : String(e) });
  }
});
