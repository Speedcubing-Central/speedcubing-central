import { useEffect, type RefObject } from 'react';
import { MAX_PLUS_TWO_COUNT, type Penalty, type SolveDTO } from '@scc/shared';

function isTextTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

// Ctrl+Shift+1/2/3 mark the last solve OK/+2/DNF (matching PenaltyButtons'
// own left-to-right order), Ctrl+Shift+Backspace removes it, and ? opens
// the help modal. Digit2 stacks another +2 each time it's pressed (same as
// tapping the +2 button — up to MAX_PLUS_TWO_COUNT), rather than always
// setting the count to exactly 1.
//
// 1/2/3 match on e.code ('Digit1'/'Digit2'/'Digit3' — the physical key
// position) rather than e.key. This matters: holding Shift changes what
// e.key reports even when Ctrl is also held — on a US layout, Shift+1
// produces e.key === '!', not '1', regardless of ctrlKey. Matching on e.key
// would silently never fire for a real Ctrl+Shift+1 press. e.code is
// layout/Shift-invariant, so it's the correct thing to match on whenever a
// shortcut combines Shift with a digit. Backspace has no Shift-alternate
// character, so e.code and e.key agree there either way.
//
// None of the Ctrl+Shift combos need the isTextTarget guard — a browser
// never inserts a character (or does its normal editing behavior) into a
// text field for a Ctrl-held keystroke, so there's nothing to special-case
// regardless of what has focus. ? is the one exception (no modifier), so
// it's bypassed for the manual-entry input specifically, since '?' is never
// a valid character there either — every other text field on the page
// (solve comments, session rename, ...) still blocks it.
export function useTimerKeybinds({
  enabled,
  newest,
  isFmc,
  manualEntryRef,
  onUpdatePenalty,
  onDelete,
  onShowHelp,
}: {
  enabled: boolean;
  newest: SolveDTO | undefined;
  isFmc: boolean;
  manualEntryRef: RefObject<HTMLElement>;
  onUpdatePenalty: (solveId: string, penalty: Penalty, plusTwoCount: number) => void;
  onDelete: (solveId: string) => void;
  onShowHelp: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') {
        if (isTextTarget(e.target) && e.target !== manualEntryRef.current) return;
        e.preventDefault();
        onShowHelp();
        return;
      }

      if (!e.ctrlKey || !e.shiftKey || !newest) return;
      if (e.code === 'Digit1') {
        e.preventDefault();
        onUpdatePenalty(newest.id, 'NONE', 0);
      } else if (e.code === 'Digit2' && !isFmc) {
        e.preventDefault();
        const nextCount = newest.penalty === 'DNF' ? 1 : Math.min(MAX_PLUS_TWO_COUNT, newest.plusTwoCount + 1);
        onUpdatePenalty(newest.id, 'NONE', nextCount);
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        onUpdatePenalty(newest.id, 'DNF', 0);
      } else if (e.code === 'Backspace') {
        e.preventDefault();
        if (confirm('Delete this solve? This cannot be undone.')) onDelete(newest.id);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, newest, isFmc, manualEntryRef, onUpdatePenalty, onDelete, onShowHelp]);
}
