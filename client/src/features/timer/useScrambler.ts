import { useCallback, useEffect, useRef, useState } from 'react';
import { getScramble } from '../../lib/scramble';

// How many scrambles to keep pre-fetched and ready. All requests in the queue
// fire concurrently, so on a fast event they all resolve nearly simultaneously.
const QUEUE_SIZE = 3;

// Manages the current scramble and keeps a queue of pre-fetched next ones so
// the wait for slow random-state events (4x4+) is hidden while the user is
// solving. Rapid skips stay instant as long as the queue hasn't been drained.
//
// Also tracks a single-level "previous scramble" for the Timer's back
// button: whichever scramble was active gets remembered whenever advance()
// or refresh() replaces it, and goBack() can return to it exactly once —
// after that there's nothing left to go back to until the next
// advance/refresh creates a new one. `sessionId` (session switch) and
// `eventId` (puzzle-type change) both discard any pending "previous" — a
// scramble from a different session or event never makes sense as a valid
// back target, even though the *current* scramble/queue intentionally
// persist across a session switch (unchanged, pre-existing behavior).
export function useScrambler(eventId: string, sessionId: string | null = null) {
  const [scramble, setScramble] = useState('');
  const [previous, setPrevious] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queueRef = useRef<Promise<string>[]>([]);
  const reqId = useRef(0);
  // Mirrors `scramble` synchronously so advance()/refresh() can read "the
  // scramble about to be replaced" without needing `scramble` itself in
  // their own dependency arrays (which would change their identity on every
  // scramble change, churning every effect/callback that depends on them —
  // e.g. TimerPage's Enter-hotkey listener).
  const scrambleRef = useRef('');
  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  // Start one new prefetch request and push it to the back of the queue.
  const enqueue = useCallback(() => {
    queueRef.current.push(getScramble(eventId));
  }, [eventId]);

  // Top up the queue to QUEUE_SIZE concurrent in-flight requests.
  const fillQueue = useCallback(() => {
    while (queueRef.current.length < QUEUE_SIZE) {
      enqueue();
    }
  }, [enqueue]);

  // Advance to the next queued scramble (instant if already resolved), then
  // refill so there's always something ready for the following advance.
  const advance = useCallback(async () => {
    const id = ++reqId.current;
    if (queueRef.current.length === 0) enqueue();
    const pending = queueRef.current.shift()!;
    fillQueue();
    setLoading(true);
    const s = await pending;
    if (id === reqId.current) {
      setPrevious(scrambleRef.current);
      setScramble(s);
      setLoading(false);
    }
  }, [enqueue, fillQueue]);

  // Fetch a fresh scramble bypassing the queue and repopulate it — shared by
  // refresh() (the button's action) and the eventId-change effect below,
  // which differ only in whether they remember a "previous" to go back to.
  const fetchFresh = useCallback(async () => {
    const id = ++reqId.current;
    queueRef.current = [];
    setLoading(true);
    const s = await getScramble(eventId);
    if (id === reqId.current) {
      setScramble(s);
      setLoading(false);
      fillQueue();
    }
  }, [eventId, fillQueue]);

  // Used when the user explicitly requests a new scramble via the button.
  const refresh = useCallback(() => {
    setPrevious(scrambleRef.current);
    return fetchFresh();
  }, [fetchFresh]);

  // Returns to the scramble that was active before the last advance()/
  // refresh() — a single level of undo, not a full history stack.
  const goBack = useCallback(() => {
    setPrevious((prev) => {
      if (prev === null) return prev;
      setScramble(prev);
      return null;
    });
  }, []);

  // (Re)initialise whenever the event changes — a full context switch, so
  // any pending "go back" target is discarded rather than carried over from
  // a different puzzle type.
  useEffect(() => {
    setPrevious(null);
    fetchFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setPrevious(null);
  }, [sessionId]);

  return { scramble, previous, loading, refresh, advance, goBack };
}
