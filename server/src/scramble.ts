import pkg from 'scrambow';
import { getEvent, normalizeScramble } from '@scc/shared';

// scrambow is CommonJS; grab the Scrambow class via interop default.
const { Scrambow } = pkg as unknown as { Scrambow: typeof import('scrambow').Scrambow };

// Events where scrambow produces the correct WCA-format output and cubing.js
// does not: 2x2 WCA scrambles use only R/U/F moves (DLB corner fixed), but
// cubing.js generates valid random-state scrambles using all 6 faces.
const SCRAMBOW_PREFERRED = new Set(['222']);

// Synchronous scrambow scramble — random-state for 222, random-move fallback otherwise.
export function generateScramble(eventId: string): string {
  const ev = getEvent(eventId);
  const type = ev?.scrambowType;
  if (!type) return ''; // no scrambow support for this event
  try {
    const scrambles = new Scrambow().setType(type).get(1);
    return normalizeScramble(scrambles[0]?.scramble_string ?? '');
  } catch (e) {
    console.warn('[scramble] generation failed for', eventId, e);
    return '';
  }
}

// Pre-initialize cubing.js on server startup so the first real scramble
// request (timer page load, Battle round start) doesn't pay the cold-start
// cost of loading the WASM module and spawning worker threads.
export async function warmUpScrambler(): Promise<void> {
  if (SCRAMBOW_PREFERRED.has('333')) return; // shouldn't happen, but guard
  try {
    const { randomScrambleForEvent } = await import('cubing/scramble');
    await randomScrambleForEvent('333');
    console.log('[scramble] cubing.js warmed up');
  } catch (e) {
    console.warn('[scramble] warm-up failed (non-fatal):', e instanceof Error ? e.message : e);
  }
}

// WCA-quality random-state scramble via cubing.js; scrambow fallback.
export async function getScramble(eventId: string): Promise<string> {
  if (SCRAMBOW_PREFERRED.has(eventId)) {
    return generateScramble(eventId);
  }
  try {
    const timeoutMs = 15_000;
    const { randomScrambleForEvent } = await import('cubing/scramble');
    const alg = await Promise.race([
      randomScrambleForEvent(eventId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('cubing.js timeout')), timeoutMs),
      ),
    ]);
    return normalizeScramble(alg.toString());
  } catch (e) {
    console.warn('[scramble] cubing.js failed, falling back:', e instanceof Error ? e.message : e);
  }
  return generateScramble(eventId);
}
