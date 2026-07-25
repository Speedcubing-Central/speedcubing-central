import { useState } from 'react';
import clsx from 'clsx';
import type { Penalty } from '@scc/shared';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { FmcScramblePanel } from './FmcScramblePanel';
import { FmcMoveInput } from './FmcMoveInput';
import { verifyFmcSolution, type FmcVerifyResult } from '../../lib/fmc';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A rotation (x/y/z, any modifier) never counts toward the move total — see
// lib/fmc.ts's ROTATION_FAMILIES, the authoritative version of this same
// rule applied to the parsed Alg at submit time. This is just the live,
// purely-arithmetic count shown while typing; it deliberately never calls
// the real verifier (see the component doc comment below).
const ROTATION_RE = /^[xyz]/;
function countedMoves(moves: string[]): number {
  return moves.filter((m) => m && !ROTATION_RE.test(m)).length;
}

// The real check is usually near-instant (a local cube simulation), which
// made the "checking" screen just flash by — barely readable, and not
// enough to actually feel like something happened. Padding it out to a
// minimum visible duration (racing the real check against a plain timer)
// makes the moment of submitting feel deliberate without ever slowing down
// a check that's genuinely slower than this.
const MIN_CHECK_MS = 900;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Phase = 'entering' | 'checking' | 'result';

// The whole-page "attempt in progress" view — mounted instead of TimerPage's
// normal two-column layout for the entire duration of an FMC attempt (see
// TimerPage's top-level branch), not just a swapped-out card, so Stats/
// Solves/the controls bar are all genuinely unmounted rather than hidden —
// nothing here needs to coexist with them.
//
// Deliberately never reveals solved/not-solved before Submit: the live
// counter below is pure arithmetic on the typed boxes, not a call to
// verifyFmcSolution (only ever invoked once, inside handleSubmit). Before
// this rule, a live "✓ solves / ✗ doesn't solve" check while typing
// effectively turned the checker into a hint system — you could just try
// endings until the checkmark appeared instead of actually finding a
// solution up front, the way a real FMC attempt requires. After Submit,
// this shows an explicit "checking…" popup and then the verdict (with the
// checker's own reason text — e.g. the literal-inverse case explains
// itself) before actually committing the result and returning to the
// normal Timer layout, so there's no jarring instant cut back to the
// ordinary page mid-thought.
export function FmcAttemptView({
  scramble,
  remainingMs,
  finish,
  onSubmit,
}: {
  scramble: string;
  remainingMs: number;
  finish: () => void;
  // `solution` is the exact text that was checked — omitted for a give-up,
  // since nothing was ever submitted to record. Persisted with the solve so
  // SolveDetail can show a past attempt's actual solution later. FMC never
  // carries a +2 (no time-based penalty concept — see plusTwoCount's doc
  // comment in shared/src/index.ts), so plusTwoCount is always 0 here; it's
  // still a required param purely to match useTimerEngine's onComplete shape
  // (TimerPage passes the same onComplete callback to both).
  onSubmit: (moveCount: number, penalty: Penalty, plusTwoCount: number, solution?: string) => void;
}) {
  const [moves, setMoves] = useState<string[]>(['']);
  const [phase, setPhase] = useState<Phase>('entering');
  const [result, setResult] = useState<FmcVerifyResult | null>(null);
  const [submittedSolutionText, setSubmittedSolutionText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  // Snapshot of remainingMs the instant Submit is pressed — displayed
  // instead of the live prop from `checking` onward so the countdown reads
  // as genuinely stopped, without actually calling `finish()` until
  // Continue. Calling finish() any earlier would flip fmcEngine.status away
  // from 'running' immediately, which is what TimerPage keys off of to
  // render this view at all — doing that before Continue would unmount
  // this component (losing the checking/result popups) the instant Submit
  // is clicked, before either ever had a chance to render.
  const [frozenMs, setFrozenMs] = useState<number | null>(null);
  const displayMs = frozenMs ?? remainingMs;
  const lowTime = displayMs < 5 * 60 * 1000;
  const total = countedMoves(moves);

  async function handleSubmit() {
    if (total === 0 || phase !== 'entering') return;
    setFrozenMs(remainingMs);
    setPhase('checking');
    const solutionText = moves.filter(Boolean).join(' ');
    setSubmittedSolutionText(solutionText);
    const [verifyResult] = await Promise.all([verifyFmcSolution(scramble, solutionText), sleep(MIN_CHECK_MS)]);
    setResult(verifyResult);
    setPhase('result');
  }

  function handleGiveUp() {
    finish();
    onSubmit(0, 'DNF', 0);
  }

  function handleContinue() {
    if (!result) return;
    finish();
    onSubmit(result.moveCount, result.ok ? 'NONE' : 'DNF', 0, submittedSolutionText);
  }

  return (
    <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0 md:h-[calc(100dvh-2rem)]">
      {/* LEFT: scramble diagram+text pinned to the top, WCA scoresheet
          instructions filling the rest of the column below it. */}
      <div className="md:flex-[3] min-h-0">
        <FmcScramblePanel scramble={scramble} />
      </div>

      {/* RIGHT: timer-only panel on top, solution-entry panel below */}
      <div className="flex flex-col gap-3 md:flex-[2] min-h-0">
        <div className="card shrink-0 flex items-center justify-center py-6">
          <div
            className={clsx(
              'font-mono font-bold tabular-nums leading-none text-5xl',
              lowTime ? 'text-red-500' : 'text-gray-900 dark:text-gray-100',
            )}
          >
            {formatCountdown(displayMs)}
          </div>
        </div>

        <div className="card flex-1 min-h-0 flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between shrink-0">
            <p className="font-semibold text-sm">Moves: {total}</p>
            <button
              className="text-muted hover:text-accent transition-colors"
              onClick={() => setShowInfo(true)}
              title="How to enter your solution"
              aria-label="How to enter your solution"
            >
              <Icon name="info" size={18} />
            </button>
          </div>

          {/* The only part of this view that ever scrolls internally — a
              long solution shouldn't be able to push the Submit/Give up
              buttons out of view; this box always has room for them
              regardless of how many moves get typed. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <FmcMoveInput moves={moves} onChange={setMoves} disabled={phase !== 'entering'} />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="btn-primary px-6 py-2.5" onClick={handleSubmit} disabled={total === 0 || phase !== 'entering'}>
              Submit
            </button>
            <button
              className="btn-ghost text-red-400 hover:text-red-300 text-sm"
              onClick={handleGiveUp}
              disabled={phase !== 'entering'}
            >
              Give up
            </button>
          </div>
        </div>
      </div>

      <Modal open={phase === 'checking'} onClose={() => {}} size="sm">
        <div className="flex flex-col items-center gap-3 py-4">
          <Icon name="refresh" size={32} className="animate-spin text-accent" />
          <p className="text-muted text-sm">Checking your solution…</p>
        </div>
      </Modal>

      <Modal open={phase === 'result' && !!result} onClose={handleContinue} size="sm">
        {result && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {result.ok ? (
              <>
                <Icon name="check" size={40} className="text-green-500" />
                <div className="text-2xl font-bold">Solved in {result.moveCount} moves!</div>
              </>
            ) : (
              <>
                <Icon name="x" size={40} className="text-red-400" />
                <div className="text-2xl font-bold text-red-400">DNF</div>
                {result.error && <p className="text-muted text-sm max-w-sm">{result.error}</p>}
              </>
            )}
            <button className="btn-primary px-6 py-2.5 mt-2" onClick={handleContinue}>
              Continue
            </button>
          </div>
        )}
      </Modal>

      <Modal open={showInfo} onClose={() => setShowInfo(false)} title="How to enter your solution" size="md">
        <ul className="text-sm space-y-2.5 list-disc pl-4">
          <li>Allowed moves: U, D, L, R, F, and B, each optionally followed by a prime or a 2 (e.g. R, R', R2).</li>
          <li>
            Wide moves are allowed as a letter followed by <span className="font-mono">w</span> (Rw, Fw, and so
            on), not as a lowercase letter on its own.
          </li>
          <li>
            Rotations (x, y, z) are allowed anywhere and shown dimmed. They reorient the whole cube instead of
            turning a face, so they never count toward your move total.
          </li>
          <li>
            Add <span className="font-mono">'</span> or <span className="font-mono">2</span> right after a letter
            (or after a wide move's <span className="font-mono">w</span>) for a prime or double turn, e.g. R then{' '}
            <span className="font-mono">'</span> for R', or Rw then <span className="font-mono">2</span> for Rw2.
          </li>
          <li>Typing a new letter automatically moves on to the next box. No need to press Enter or click anything in between.</li>
          <li>
            Forgot a move? Click into any box and press <span className="font-mono">Space</span> to insert a new
            empty box right after it, then type the missing move.
          </li>
          <li>Backspace clears the current box. Pressing it again from an already-empty box removes that box and steps back to the end of the previous one, leaving its content untouched.</li>
        </ul>
      </Modal>
    </div>
  );
}
