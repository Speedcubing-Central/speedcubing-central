import { useEffect, useRef, useState } from 'react';
import { getScramble } from '../../lib/scramble';

export interface RelayLegScramble {
  eventId: string;
  order: number;
  scramble: string;
}

// Generates every scramble a relay needs up front, in parallel — mirrors
// useScrambler's loading-gate convention (the caller blocks starting until
// this settles) rather than the queue/prefetch shape that hook uses, since a
// relay needs all N scrambles before the attempt can begin at all, not a
// rolling queue of "next one".
export function useRelayScrambles(legEventIds: string[]) {
  const [legs, setLegs] = useState<RelayLegScramble[] | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setLegs(null);
    Promise.all(legEventIds.map((eventId) => getScramble(eventId))).then((scrambles) => {
      if (requestId.current !== id) return; // a newer request superseded this one
      setLegs(legEventIds.map((eventId, order) => ({ eventId, order, scramble: scrambles[order] })));
      setLoading(false);
    });
    // legEventIds is a fresh array each render from the caller — join it so
    // this only actually re-fires when the events themselves change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legEventIds.join(',')]);

  return { legs, loading };
}
