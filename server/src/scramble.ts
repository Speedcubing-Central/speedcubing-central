import pkg from 'scrambow';
import { Worker } from 'node:worker_threads';
import { getEvent, normalizeScramble, generateAlgSetScramble } from '@scc/shared';

// scrambow is CommonJS; grab the Scrambow class via interop default.
const { Scrambow } = pkg as unknown as { Scrambow: typeof import('scrambow').Scrambow };

// Events where scrambow is used as the primary generator instead of
// cubing.js. 2x2: WCA scrambles use only R/U/F moves (DLB corner fixed),
// but cubing.js generates valid random-state scrambles using all 6 faces.
// Clock: scrambow is synchronous and avoids WASM overhead for this simple
// puzzle, and produces equivalent output to cubing.js. 6x6: scrambow is
// synchronous (avoids cubing.js's WASM cold-start/timeout risk — 666 isn't
// in WARM_UP_EVENTS below) — see generateScramble's own doc comment for how
// its one known defect (a redundant wide-move pair) is handled now that
// this is the primary path rather than a rare fallback.
const SCRAMBOW_PREFERRED = new Set(['222', 'clock', '666']);

// Detects the specific defect behind a real user report: scrambow's
// move-picker for NxN cubes (444/555/666/777) has no live protection
// against picking two adjacent wide moves on opposite faces of the same
// axis whose depths together span the *entire* cube — e.g. "3Lw' 3Rw" on a
// 6-layer cube. That pair is mathematically a pure whole-cube rotation
// (every layer turns by the same amount in a consistent sense), i.e. a
// wasted move that changes nothing about the puzzle's actual state. This
// holds for ANY complementary depth split (not just an exact half-and-half
// split), as long as the two moves' relative sign is the one that
// reconstructs a single rigid rotation rather than twisting the two halves
// apart — verified against the standard SiGN-notation identity where each
// axis's "positive" reference face (R/U/F, matching x/y/z's own direction)
// paired with its *opposite* face's prime (L'/D'/B') builds a whole-cube
// turn; same-sign pairs (e.g. R + L, both unprimed) do NOT reduce to a
// rotation. Half-turns (the "2" suffix) have no sign distinction, so any
// complementary-depth half-turn pair on opposite faces is always redundant.
// scrambow's own source has a guard shaped exactly like a check for this
// case, but it's gated on a condition that's always false for every
// 444/555/666/777 registration — dead code, not a working filter.
const OPPOSITE_FACE: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', L: 'R', R: 'L' };
// Each axis's positive/reference face, matching x~R, y~U, z~F in SiGN notation.
const AXIS_REFERENCE_FACE = new Set(['U', 'F', 'R']);
const WIDE_MOVE_RE = /^(\d*)([UDFBLR])(w?)(2|')?$/;

interface ParsedWideMove {
  face: string;
  depth: number;
  turns: 1 | 2 | -1; // quarter CW, half, quarter CCW
}

// A bare face letter with no leading digit and no 'w' is a single-layer
// (outer-only) turn; 'w' with no digit defaults to depth 2, matching WCA's
// "Rw" == "2Rw" convention.
function parseWideMove(token: string): ParsedWideMove | null {
  const m = WIDE_MOVE_RE.exec(token);
  if (!m) return null;
  const [, digits, face, wide, suffix] = m;
  const depth = digits ? parseInt(digits, 10) : wide ? 2 : 1;
  const turns = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
  return { face, depth, turns };
}

function isRedundantRotationPair(a: ParsedWideMove, b: ParsedWideMove, layers: number): boolean {
  if (OPPOSITE_FACE[a.face] !== b.face) return false;
  if (a.depth + b.depth !== layers) return false;
  if (a.turns === 2 && b.turns === 2) return true;
  if (Math.abs(a.turns) !== 1 || Math.abs(b.turns) !== 1) return false;
  const refTurn = AXIS_REFERENCE_FACE.has(a.face) ? a.turns : b.turns;
  const oppTurn = AXIS_REFERENCE_FACE.has(a.face) ? b.turns : a.turns;
  return refTurn !== oppTurn; // opposite sign on the ref/opposite pair => a pure rotation
}

function hasRedundantWideRotation(scramble: string, layers: number): boolean {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = parseWideMove(tokens[i]);
    const b = parseWideMove(tokens[i + 1]);
    if (a && b && isRedundantRotationPair(a, b, layers)) return true;
  }
  return false;
}

const NXN_LAYERS: Record<string, number> = { '666': 6 };

// Synchronous scrambow scramble — random-state for 222/333, random-move
// otherwise. For events in NXN_LAYERS (currently just 666, since that's the
// only one scrambow is primary for — see SCRAMBOW_PREFERRED), regenerates
// (cheap: scrambow's own call is synchronous) rather than ever handing back
// a scramble containing the redundant-rotation pair described above.
export function generateScramble(eventId: string): string {
  const ev = getEvent(eventId);
  const type = ev?.scrambowType;
  if (!type) return ''; // no scrambow support for this event
  const layers = NXN_LAYERS[eventId];
  let last = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const scrambles = new Scrambow().setType(type).get(1);
      let s = normalizeScramble(scrambles[0]?.scramble_string ?? '');
      // WCA no longer requires pre-set pins; strip trailing pin tokens (UR/DR/DL/UL).
      if (eventId === 'clock') s = s.replace(/(\s+(UR|DR|DL|UL))+$/, '');
      last = s;
      if (!layers || !hasRedundantWideRotation(s, layers)) return s;
    } catch (e) {
      console.warn('[scramble] generation failed for', eventId, e);
      return '';
    }
  }
  console.warn('[scramble] could not avoid a redundant wide-rotation pair for', eventId, 'after 20 attempts, returning it anyway');
  return last;
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

// Battle Mode's per-round scramble: an algorithm-set battle (algSetId set)
// draws a random case+alt+AUF from that set instead of a full scramble for
// eventId — see shared/src/algScramble.ts, the same pure logic the solo Alg
// Trainer uses to build its own rounds. Both Battle call sites (room
// creation and startRound) go through this one function so the branch only
// exists once. Falls back to a normal full scramble if algSetId is present
// but somehow unrecognized (stale data, a set removed after a room was
// created, etc.) rather than ever returning nothing.
export async function getRoundScramble(eventId: string, algSetId: string | null): Promise<string> {
  if (algSetId) {
    const result = generateAlgSetScramble(algSetId);
    if (result) return result.scramble;
    console.warn('[scramble] algSetId scramble generation failed for', algSetId, '— falling back to full scramble for', eventId);
  }
  return getScramble(eventId);
}
