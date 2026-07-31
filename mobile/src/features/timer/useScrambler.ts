import { useCallback, useEffect, useRef, useState } from 'react';
import { getScramble } from '../../lib/scramble';

// Port of client/src/features/timer/useScrambler.ts. Same prefetch queue, same
// never-the-same-scramble-twice guarantee, same single-level back button.
// Prefetching matters more on mobile than on web, if anything: the same
// random-state generation latency applies (a couple of seconds for square-1,
// 4x4+, megaminx) and it's now over a phone's network.

const QUEUE_SIZE = 3;

// Never hand back a scramble identical to the one it's about to replace.
// Reuses the already-queued value in the overwhelming common case; only pays
// for an extra round-trip on an actual collision. Bounded so a low-entropy
// event can't spin forever.
const MAX_DEDUP_ATTEMPTS = 5;
async function ensureDifferent(candidate: Promise<string>, exclude: string, eventId: string): Promise<string> {
  let s = await candidate;
  for (let i = 0; exclude && s === exclude && i < MAX_DEDUP_ATTEMPTS; i++) {
    s = await getScramble(eventId);
  }
  return s;
}

export function useScrambler(eventId: string, sessionId: string | null = null) {
  const [scramble, setScramble] = useState('');
  const [previous, setPrevious] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queueRef = useRef<Promise<string>[]>([]);
  const reqId = useRef(0);
  // Mirrors `scramble` synchronously so advance()/refresh() can read "the
  // scramble about to be replaced" without needing it in their dependency
  // arrays (which would churn every effect that depends on them).
  const scrambleRef = useRef('');
  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  const enqueue = useCallback(() => {
    // A rejected prefetch promise sitting in the queue would surface as an
    // unhandled rejection; getScramble retries internally and never rejects,
    // but attach a guard so a future change can't turn this into a crash.
    queueRef.current.push(getScramble(eventId).catch(() => ''));
  }, [eventId]);

  const fillQueue = useCallback(() => {
    while (queueRef.current.length < QUEUE_SIZE) {
      enqueue();
    }
  }, [enqueue]);

  const advance = useCallback(async () => {
    const id = ++reqId.current;
    if (queueRef.current.length === 0) enqueue();
    const pending = queueRef.current.shift()!;
    fillQueue();
    setLoading(true);
    const s = await ensureDifferent(pending, scrambleRef.current, eventId);
    if (id === reqId.current) {
      setPrevious(scrambleRef.current);
      setScramble(s);
      setLoading(false);
    }
  }, [enqueue, fillQueue, eventId]);

  const fetchFresh = useCallback(async () => {
    const id = ++reqId.current;
    queueRef.current = [];
    setLoading(true);
    const s = await ensureDifferent(getScramble(eventId), scrambleRef.current, eventId);
    if (id === reqId.current) {
      setScramble(s);
      setLoading(false);
      fillQueue();
    }
  }, [eventId, fillQueue]);

  const refresh = useCallback(() => {
    setPrevious(scrambleRef.current);
    return fetchFresh();
  }, [fetchFresh]);

  // Returns to the scramble active before the last advance()/refresh(). A
  // single level of undo, not a full history stack.
  const goBack = useCallback(() => {
    setPrevious((prev) => {
      if (prev === null) return prev;
      setScramble(prev);
      return null;
    });
  }, []);

  // (Re)initialise whenever the event changes. A full context switch, so any
  // pending "go back" target is discarded rather than carried over from a
  // different puzzle type.
  useEffect(() => {
    setPrevious(null);
    fetchFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setPrevious(null);
  }, [sessionId]);

  // Replaces the current scramble with one the user typed. The queue is left
  // alone on purpose: the custom scramble applies to this attempt only, and the
  // already-prefetched next one is still perfectly good. Bumping reqId cancels
  // any generation still in flight, so a slow fetch can't land afterwards and
  // overwrite what was just entered.
  const setCustom = useCallback((value: string) => {
    reqId.current++;
    setPrevious(scrambleRef.current);
    setScramble(value);
    setLoading(false);
  }, []);

  return { scramble, previous, loading, refresh, advance, goBack, setCustom };
}
