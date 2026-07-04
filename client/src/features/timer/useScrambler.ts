import { useCallback, useEffect, useRef, useState } from 'react';
import { getScramble } from '../../lib/scramble';

// How many scrambles to keep pre-fetched and ready. All requests in the queue
// fire concurrently, so on a fast event they all resolve nearly simultaneously.
const QUEUE_SIZE = 3;

// Manages the current scramble and keeps a queue of pre-fetched next ones so
// the wait for slow random-state events (4x4+) is hidden while the user is
// solving. Rapid skips stay instant as long as the queue hasn't been drained.
export function useScrambler(eventId: string) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(true);
  const queueRef = useRef<Promise<string>[]>([]);
  const reqId = useRef(0);

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
      setScramble(s);
      setLoading(false);
    }
  }, [enqueue, fillQueue]);

  // Fetch a fresh scramble and repopulate the queue. Used when the event
  // changes or the user explicitly requests a new scramble via the button.
  const refresh = useCallback(async () => {
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

  // (Re)initialise whenever the event changes.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return { scramble, loading, refresh, advance };
}
