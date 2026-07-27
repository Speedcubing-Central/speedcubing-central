// Validates a user-typed scramble for a given event before it's allowed to
// become the active scramble (see ScramblePanel's edit button). Two distinct
// failure modes both need catching: notation that doesn't parse at all
// (Alg.fromString throws), and notation that parses fine but is illegal for
// this specific puzzle: wrong face names, an unsupported move type, etc.
// (KPuzzle's applyAlg throws). Neither is worth pre-validating with a regex;
// cubing.js's own parser and puzzle-move application are the source of truth.
import { Alg } from 'cubing/alg';
import { eventInfo, puzzles } from 'cubing/puzzles';
import { normalizeScramble } from '@scc/shared';

export interface CustomScrambleResult {
  ok: boolean;
  scramble: string;
  error?: string;
}

export async function validateCustomScramble(eventId: string, input: string): Promise<CustomScrambleResult> {
  const trimmed = normalizeScramble(input);
  if (!trimmed) return { ok: false, scramble: '', error: 'Enter a scramble' };

  let alg: Alg;
  try {
    alg = Alg.fromString(trimmed);
  } catch (e) {
    return { ok: false, scramble: '', error: e instanceof Error ? e.message : 'Could not parse that scramble' };
  }

  const info = eventInfo(eventId);
  const loader = info ? puzzles[info.puzzleID] : undefined;
  if (!loader) return { ok: false, scramble: '', error: 'This event doesn\'t support custom scrambles' };

  try {
    const kpuzzle = await loader.kpuzzle();
    kpuzzle.defaultPattern().applyAlg(alg);
  } catch (e) {
    return { ok: false, scramble: '', error: e instanceof Error ? e.message : 'That scramble is not valid for this puzzle' };
  }

  return { ok: true, scramble: trimmed };
}
