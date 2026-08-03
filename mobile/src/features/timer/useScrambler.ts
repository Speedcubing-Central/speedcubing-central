import { useCallback, useEffect, useRef, useState } from 'react';
import { getScramble } from '../../lib/scramble';

// Port of client/src/features/timer/useScrambler.ts. Same prefetch queue, same
// never-the-same-scramble-twice guarantee, same single-level back button.
// Prefetching matters more on mobile than on web, if anything: the same
// random-state generation latency applies (a couple of seconds for square-1,
// 4x4+, megaminx) and it's now over a phone's network.

const QUEUE_SIZE = 3;

/**
 * A prefetch in the queue, and its value once it has arrived.
 *
 * The value is recorded alongside the promise rather than only awaited, because
 * "is the next scramble already here" has to be answerable *synchronously*, in
 * the moment a solve ends. Awaiting a promise that has already settled still
 * costs a microtask, and a microtask is a render: the screen would blank and
 * come back, which is precisely the flicker this exists to avoid.
 */
interface Queued {
  promise: Promise<string>;
  value: string | null;
}

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

export function useScrambler(
  eventId: string,
  sessionId: string | null = null,
  /**
   * Called with the scramble at the front of the prefetch queue, as soon as it
   * is known, so a caller can do whatever preparation that scramble needs
   * before it is on screen. The Timer uses it to build the scramble image.
   *
   * Deliberately a callback rather than a returned value: it fires seconds
   * before the scramble is displayed, and routing it through state would spend
   * a render of the whole Timer on a fact nothing renders.
   */
  onUpcoming?: (eventId: string, scramble: string) => void,
) {
  const [scramble, setScramble] = useState('');
  const [previous, setPrevious] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queueRef = useRef<Queued[]>([]);
  const reqId = useRef(0);
  const upcomingRef = useRef(onUpcoming);
  upcomingRef.current = onUpcoming;
  // Mirrors `scramble` synchronously so advance()/refresh() can read "the
  // scramble about to be replaced" without needing it in their dependency
  // arrays (which would churn every effect that depends on them).
  const scrambleRef = useRef('');
  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  const announceUpcoming = useCallback(() => {
    const head = queueRef.current[0];
    if (head?.value) upcomingRef.current?.(eventId, head.value);
  }, [eventId]);

  const enqueue = useCallback(() => {
    const entry: Queued = { value: null, promise: Promise.resolve('') };
    // A rejected prefetch promise sitting in the queue would surface as an
    // unhandled rejection; getScramble retries internally and never rejects,
    // but attach a guard so a future change can't turn this into a crash.
    entry.promise = getScramble(eventId).then(
      (s) => {
        entry.value = s;
        // Only the front of the queue is announced. Anything behind it gets its
        // turn when it reaches the front, and preparing three scrambles ahead
        // would be work for two that may never be shown.
        if (queueRef.current[0] === entry) announceUpcoming();
        return s;
      },
      () => '',
    );
    queueRef.current.push(entry);
  }, [eventId, announceUpcoming]);

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
    const outgoing = scrambleRef.current;

    // ── The queue was warm: swap straight to the next scramble ──
    //
    // Which is the overwhelmingly common case, since the queue is filled while
    // the previous solve is still being done. It matters for more than the
    // wait it saves. The path below clears the display first, and that clearing
    // is what forced the scramble image to be torn down and rebuilt on every
    // single solve: a few hundred SVG elements unmounted for a blank frame,
    // then a few hundred created again, in the frame the timer stopped.
    //
    // Going straight from one scramble to the next skips all of it, and since
    // the drawing was prepared when this scramble reached the front of the
    // queue, the new cube arrives in the same commit as the new text.
    //
    // The safety property below is kept, not traded away: the old scramble is
    // never what stays on screen. It is replaced by the real next one rather
    // than by a placeholder, which is strictly better at the same job.
    if (pending.value && pending.value !== outgoing) {
      setPrevious(outgoing);
      // Eagerly, so a second advance in the same tick sees the right outgoing
      // value; the effect below would not have run yet.
      scrambleRef.current = pending.value;
      setScramble(pending.value);
      setLoading(false);
      announceUpcoming();
      return;
    }

    // Clear the display now, rather than leaving the old scramble up until the
    // replacement lands.
    //
    // That wait is not a neutral pause. A scramble on screen after a solve
    // reads as the next one, so people pick the cube up and apply it, and then
    // have to undo a scramble they should never have been shown. It cost real
    // solves before this. An honest "working on it" is worse to look at and
    // better to obey, and the timer is already blocked meanwhile (`loading`
    // feeds the Timer's inputBlocked), so nothing can be recorded against the
    // gap either.
    //
    // `outgoing` was captured above rather than re-read here, because
    // scrambleRef follows what is displayed and that is about to be nothing.
    setPrevious(outgoing);
    setScramble('');
    setLoading(true);
    const s = await ensureDifferent(pending.promise, outgoing, eventId);
    if (id === reqId.current) {
      setScramble(s);
      setLoading(false);
      announceUpcoming();
    }
  }, [enqueue, fillQueue, eventId, announceUpcoming]);

  const fetchFresh = useCallback(async () => {
    const id = ++reqId.current;
    queueRef.current = [];
    setLoading(true);
    const s = await ensureDifferent(getScramble(eventId), scrambleRef.current, eventId);
    if (id === reqId.current) {
      setScramble(s);
      setLoading(false);
      fillQueue();
      announceUpcoming();
    }
  }, [eventId, fillQueue, announceUpcoming]);

  const refresh = useCallback(() => {
    // Only when there is something to go back to. Between an advance() and its
    // replacement landing there isn't, and recording that emptiness as the
    // previous scramble would arm the back button with a blank.
    if (scrambleRef.current) setPrevious(scrambleRef.current);
    return fetchFresh();
  }, [fetchFresh]);

  // Puts a specific scramble back on screen and cancels anything in flight.
  //
  // For undoing an advance() whose reason for happening turned out to fail: the
  // Timer advances as soon as an attempt ends, before the save it triggers has
  // been acknowledged, so a save that then fails has to be able to put the
  // scramble it used back. Distinct from goBack(), which is the user's own
  // single-level undo and clears `previous` as a side effect.
  const restore = useCallback((value: string) => {
    reqId.current++;
    setScramble(value);
    setPrevious(null);
    setLoading(false);
  }, []);

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

  return { scramble, previous, loading, refresh, advance, goBack, setCustom, restore };
}
