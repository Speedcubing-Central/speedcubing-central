import { createContext, useContext, type ReactNode } from 'react';
import { useSettings } from '../../store/settings';
import { useTimerData, type TimerData } from './useTimerData';

// The Timer's sessions/solves state, hoisted to the Timer stack so the Timer
// screen and its Stats / Solves / Sessions sub-screens all read and mutate one
// instance.
//
// This matters because of how the mobile redesign split things up. On web all of
// this is one page component, so there's a single useTimerData and a single
// solves array by construction. Splitting the stats table and solves list onto
// their own screens would, without this, give each screen its own hook instance,
// meaning three independent fetches. Worse, a penalty edited on the Solves
// screen wouldn't be reflected in the Timer's live Ao5 until something happened
// to refetch. One provider keeps the invariant the web page gets for free.
const TimerDataCtx = createContext<TimerData | null>(null);

export function TimerDataProvider({ children }: { children: ReactNode }) {
  const event = useSettings((s) => s.currentEvent);
  const data = useTimerData(event);
  return <TimerDataCtx.Provider value={data}>{children}</TimerDataCtx.Provider>;
}

export function useTimerDataContext(): TimerData {
  const ctx = useContext(TimerDataCtx);
  if (!ctx) throw new Error('useTimerDataContext must be used inside a TimerDataProvider');
  return ctx;
}
