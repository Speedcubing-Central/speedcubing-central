import pkg from 'scrambow';
import { Worker } from 'node:worker_threads';
import { getEvent, normalizeScramble } from '@scc/shared';

// scrambow is CommonJS; grab the Scrambow class via interop default.
const { Scrambow } = pkg as unknown as { Scrambow: typeof import('scrambow').Scrambow };

// Events where scrambow produces the correct WCA-format output and cubing.js
// does not: 2x2 WCA scrambles use only R/U/F moves (DLB corner fixed), but
// cubing.js generates valid random-state scrambles using all 6 faces.
// Clock scrambles also use scrambow — both produce equivalent output but
// scrambow is synchronous and avoids WASM overhead for this simple puzzle.
const SCRAMBOW_PREFERRED = new Set(['222', 'clock']);

// Synchronous scrambow scramble — random-state for 222, random-move fallback otherwise.
export function generateScramble(eventId: string): string {
  const ev = getEvent(eventId);
  const type = ev?.scrambowType;
  if (!type) return ''; // no scrambow support for this event
  try {
    const scrambles = new Scrambow().setType(type).get(1);
    let s = normalizeScramble(scrambles[0]?.scramble_string ?? '');
    // WCA no longer requires pre-set pins; strip trailing pin tokens (UR/DR/DL/UL).
    if (eventId === 'clock') s = s.replace(/(\s+(UR|DR|DL|UL))+$/, '');
    return s;
  } catch (e) {
    console.warn('[scramble] generation failed for', eventId, e);
    return '';
  }
}

// A live, reproduced issue: a long-lived server progressively got *slower
// per call* at generating kilominx scrambles — not from concurrent calls
// competing for CPU, but from something inside cubing.js's own kilominx
// WASM solver ("twips") degrading the more times it runs in the same
// process (a fresh process: ~13-1600ms each; the same process after ~5-6
// calls: multiple seconds and climbing, then every subsequent call pegged
// at the 15s timeout). A per-event serialization queue alone (an earlier
// attempt at this fix) does NOT help — it only guarantees calls don't run
// concurrently, but the underlying degradation happens regardless and just
// backs up: once one call exceeds the timeout, every call queued behind it
// times out too, in a cascade that measurably reproduces on a sustained
// load test even with serialization in place.
//
// The actual fix: run generation for each event in its own worker_threads
// Worker (scrambleWorker.ts) and periodically *terminate and respawn* that
// worker — a fresh worker gets a fresh V8 isolate and thus fresh WASM
// linear memory, discarding whatever accumulated state was causing the
// slowdown. Recycling triggers on: a call taking longer than
// RECYCLE_AFTER_MS (catches degradation early, before it cascades), a call
// count ceiling (belt-and-suspenders in case degradation is ever silent
// per-call), or any error/timeout (the worker's state is suspect either
// way). Terminating on timeout also means a slow call is genuinely
// cancelled now, instead of the old Promise.race behavior where a "lost"
// race kept running in the background forever, orphaned.
//
// Calls are still serialized per event (only one in-flight message per
// worker at a time) — sending two concurrent messages to the same worker
// would just recreate the original concurrent-WASM-calls contention inside
// that one thread instead of across threads.
//
// TIMEOUT_MS is deliberately short (not the old 15s): termination now
// genuinely cancels a stuck call instead of abandoning it to run forever in
// the background, so there's no cost to giving up early and retrying fresh
// — and giving up early matters a lot here, because retries are serialized
// per event. Waiting out a single slow call used to also force every call
// *queued behind it* to wait just as long, compounding linearly with queue
// depth under any burst of concurrent requests (reproduced directly: a
// burst of 5 concurrent calls where the first genuinely took the full old
// 15s timeout meant the last of the 5 didn't resolve until ~60s in).
//
// A recycled worker is swapped in from `spareWorkers` (pre-spawned in the
// background, see ensureSpare) rather than spawned synchronously on the
// next call, so paying cubing.js's WASM load/init cost happens off the
// critical path in the common case instead of adding it on top of whatever
// caller is unlucky enough to trigger the recycle.
const TIMEOUT_MS = 5_000;
const RECYCLE_AFTER_MS = 1_200;
const RECYCLE_AFTER_CALLS = 6;

interface WorkerEntry {
  worker: Worker;
  calls: number;
  nextId: number;
  pending: Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>;
}

const activeWorkers = new Map<string, WorkerEntry>();
const spareWorkers = new Map<string, WorkerEntry>();
const queueTail = new Map<string, Promise<unknown>>();

function createWorker(): WorkerEntry {
  const worker = new Worker(new URL('./scrambleWorker.js', import.meta.url));
  const entry: WorkerEntry = { worker, calls: 0, nextId: 0, pending: new Map() };
  worker.on('message', (msg: { id: number; scramble?: string; error?: string }) => {
    const p = entry.pending.get(msg.id);
    if (!p) return;
    entry.pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error));
    else p.resolve(msg.scramble ?? '');
  });
  const failAll = (eventId: string, err: Error) => {
    for (const p of entry.pending.values()) p.reject(err);
    entry.pending.clear();
    if (activeWorkers.get(eventId) === entry) activeWorkers.delete(eventId);
    if (spareWorkers.get(eventId) === entry) spareWorkers.delete(eventId);
  };
  worker.on('error', (err) => {
    for (const [eventId, e] of [...activeWorkers, ...spareWorkers]) {
      if (e === entry) failAll(eventId, err);
    }
  });
  worker.on('exit', (code) => {
    if (code === 0) return;
    const err = new Error(`scramble worker exited with code ${code}`);
    for (const [eventId, e] of [...activeWorkers, ...spareWorkers]) {
      if (e === entry) failAll(eventId, err);
    }
  });
  return entry;
}

// Keeps one pre-spawned, already-loading worker on hand per event so a
// recycle can swap it in instantly instead of paying WASM init cost inline.
function ensureSpare(eventId: string): void {
  if (!spareWorkers.has(eventId)) spareWorkers.set(eventId, createWorker());
}

function getActiveWorker(eventId: string): WorkerEntry {
  let entry = activeWorkers.get(eventId);
  if (!entry) {
    entry = spareWorkers.get(eventId) ?? createWorker();
    spareWorkers.delete(eventId);
    activeWorkers.set(eventId, entry);
  }
  ensureSpare(eventId);
  return entry;
}

function recycle(eventId: string, entry: WorkerEntry): void {
  if (activeWorkers.get(eventId) === entry) activeWorkers.delete(eventId);
  entry.worker.terminate().catch(() => {});
}

async function runInWorker(eventId: string): Promise<string> {
  const entry = getActiveWorker(eventId);
  const id = entry.nextId++;
  entry.calls++;
  const t0 = Date.now();
  const result = new Promise<string>((resolve, reject) => entry.pending.set(id, { resolve, reject }));
  entry.worker.postMessage({ id, eventId });

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      entry.pending.delete(id);
      recycle(eventId, entry);
      reject(new Error('cubing.js timeout'));
    }, TIMEOUT_MS);
  });

  try {
    const scramble = await Promise.race([result, timeout]);
    clearTimeout(timer!);
    if (Date.now() - t0 > RECYCLE_AFTER_MS || entry.calls >= RECYCLE_AFTER_CALLS) {
      recycle(eventId, entry);
    }
    return scramble;
  } catch (e) {
    clearTimeout(timer!);
    throw e;
  }
}

async function getCubingJsScramble(eventId: string): Promise<string> {
  const previous = queueTail.get(eventId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(() => runInWorker(eventId).then(normalizeScramble));
  queueTail.set(eventId, run.catch(() => {}));
  return run;
}

// Pre-initialize cubing.js on server startup so the first real scramble
// request (timer page load, Battle round start) doesn't pay the cold-start
// cost of loading the WASM module and spawning worker threads. '333' alone
// only warms the shared cubing/scramble dynamic import and the generic
// worker-thread machinery — kilominx (its own WASM "twips" module) and FTO
// (its own dedicated solver chunk) are each loaded on first use of that
// specific event, independent of '333' having already run. Without warming
// them too, the first kilominx/FTO scramble a user ever requests can take
// long enough to hit the client's 5s timeout, which silently falls back to
// a random-move scramble instead — so this isn't just slowness, it can
// transiently defeat random-state scrambling entirely for those events.
const WARM_UP_EVENTS = ['333', 'kilominx', 'fto'];
export async function warmUpScrambler(): Promise<void> {
  await Promise.all(WARM_UP_EVENTS.map(async (eventId) => {
    try {
      await getCubingJsScramble(eventId);
      console.log('[scramble] cubing.js warmed up for', eventId);
    } catch (e) {
      console.warn('[scramble] warm-up failed for', eventId, '(non-fatal):', e instanceof Error ? e.message : e);
    }
  }));
}

// WCA-quality random-state scramble. Scrambow-preferred events use scrambow
// with cubing.js as fallback; all others use cubing.js with scrambow as fallback.
export async function getScramble(eventId: string): Promise<string> {
  if (SCRAMBOW_PREFERRED.has(eventId)) {
    const s = generateScramble(eventId);
    if (s) return s;
    console.warn('[scramble] scrambow failed for', eventId, '— trying cubing.js');
    try { return await getCubingJsScramble(eventId); } catch (e) {
      console.warn('[scramble] cubing.js fallback also failed for', eventId, e instanceof Error ? e.message : e);
    }
    return '';
  }
  try {
    return await getCubingJsScramble(eventId);
  } catch (e) {
    console.warn('[scramble] cubing.js failed, falling back:', e instanceof Error ? e.message : e);
  }
  return generateScramble(eventId);
}
