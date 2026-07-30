import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDTO, SolveDTO, Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { api } from '../../lib/api';
import { guestStore, hydrateGuestStore } from './guestStore';

// Port of client/src/features/timer/useTimerData.ts. Same endpoints, same
// session-selection rules, same optimistic list updates. This is the piece
// that makes cross-platform data identity fall out naturally: a logged-in user
// reads and writes solves and sessions straight through to
// /api/sessions and /api/solves, with nothing cached client-side that could
// drift from what the web client sees. The guest branch (localStorage on web,
// AsyncStorage here) is the only local-only path, and it only ever applies when
// there's no account to sync to.
export function useTimerData(eventId: string) {
  const { user } = useAuth();
  const isGuest = !user;
  const lastSessionByEvent = useSettings((s) => s.lastSessionByEvent);
  const setLastSessionForEvent = useSettings((s) => s.setLastSessionForEvent);

  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [solves, setSolves] = useState<SolveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [solvesLoading, setSolvesLoading] = useState(true);

  // Whether `currentId` was picked automatically by the effect below (a
  // fallback/preferred guess) rather than an explicit user action, only
  // automatic picks are ever corrected once a real lastSessionByEvent value
  // becomes available. Persisted settings rehydration and this event's session
  // list can finish in either order; without this, a valid-but-guessed pick
  // could lock in before the real preference arrived and never be corrected.
  const autoSelectedRef = useRef(false);
  const setCurrentId = useCallback((id: string) => {
    autoSelectedRef.current = false;
    setCurrentIdState(id);
  }, []);

  const eventSessions = sessions.filter((s) => s.eventId === eventId);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    if (isGuest) {
      await hydrateGuestStore();
      setSessions([...guestStore.listSessions()]);
    } else {
      const { data } = await api.get<SessionDTO[]>('/sessions');
      setSessions(data);
    }
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    loadSessions().catch(() => setLoading(false));
  }, [loadSessions]);

  // Keep a valid current session for the selected event. Prefers whichever
  // session the user most recently solved in for this event over the
  // newest-created one, so the Timer lands where practice actually happened.
  useEffect(() => {
    const forEvent = sessions.filter((s) => s.eventId === eventId);
    if (forEvent.length === 0) {
      setCurrentIdState(null);
      return;
    }
    const preferred = lastSessionByEvent[eventId];
    const currentIsValid = !!currentId && forEvent.some((s) => s.id === currentId);
    if (!currentIsValid) {
      autoSelectedRef.current = true;
      setCurrentIdState(preferred && forEvent.some((s) => s.id === preferred) ? preferred : forEvent[0].id);
      return;
    }
    if (autoSelectedRef.current && preferred && preferred !== currentId && forEvent.some((s) => s.id === preferred)) {
      setCurrentIdState(preferred);
    }
  }, [sessions, eventId, currentId, lastSessionByEvent]);

  // Load solves whenever the current session changes. Tracked separately from
  // `loading` so the timer can refuse to start a solve until the session's
  // history has actually landed. Otherwise a fast tap could record against
  // stale/empty stats on a slow connection.
  useEffect(() => {
    if (!currentId) {
      setSolves([]);
      setSolvesLoading(false);
      return;
    }
    let cancelled = false;
    setSolvesLoading(true);
    (async () => {
      try {
        if (isGuest) {
          await hydrateGuestStore();
          if (!cancelled) setSolves([...guestStore.listSolves(currentId)]);
        } else {
          const { data } = await api.get<SolveDTO[]>(`/sessions/${currentId}/solves`);
          if (!cancelled) setSolves(data);
        }
      } finally {
        if (!cancelled) setSolvesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId, isGuest]);

  const createSession = useCallback(
    async (name: string, subset?: string) => {
      let created: SessionDTO;
      if (isGuest) {
        await hydrateGuestStore();
        created = guestStore.createSession(name, eventId, subset);
      } else {
        created = (await api.post<SessionDTO>('/sessions', { name, eventId, subset })).data;
      }
      setSessions((prev) => [created, ...prev]);
      setCurrentId(created.id);
      setSolves([]);
      return created;
    },
    [isGuest, eventId, setCurrentId],
  );

  const renameSession = useCallback(
    async (id: string, name: string) => {
      if (isGuest) guestStore.renameSession(id, name);
      else await api.patch(`/sessions/${id}`, { name });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    },
    [isGuest],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (isGuest) guestStore.deleteSession(id);
      else await api.delete(`/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [isGuest],
  );

  const addSolve = useCallback(
    async (
      time: number,
      penalty: Penalty,
      plusTwoCount: number,
      scramble: string,
      sessionId?: string,
      solution?: string,
    ) => {
      const id = sessionId ?? currentId;
      if (!id) return;
      let solve: SolveDTO;
      if (isGuest) {
        solve = guestStore.addSolve(id, time, penalty, plusTwoCount, scramble, solution);
      } else {
        solve = (
          await api.post<SolveDTO>(`/sessions/${id}/solves`, { time, penalty, plusTwoCount, scramble, solution })
        ).data;
      }
      setSolves((prev) => [solve, ...prev]);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, solveCount: (s.solveCount ?? 0) + 1 } : s)));
      setLastSessionForEvent(eventId, id);
      return solve;
    },
    [currentId, isGuest, eventId, setLastSessionForEvent],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty, plusTwoCount: number) => {
      if (!currentId) return;
      const count = penalty === 'DNF' ? 0 : plusTwoCount;
      if (isGuest) guestStore.updatePenalty(currentId, solveId, penalty, count);
      else await api.patch(`/solves/${solveId}`, { penalty, plusTwoCount: count });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, penalty, plusTwoCount: count } : s)));
    },
    [currentId, isGuest],
  );

  const updateTime = useCallback(
    async (solveId: string, time: number) => {
      if (!currentId) return;
      if (isGuest) guestStore.updateTime(currentId, solveId, time);
      else await api.patch(`/solves/${solveId}`, { time });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, time } : s)));
    },
    [currentId, isGuest],
  );

  const updateComment = useCallback(
    async (solveId: string, comment: string) => {
      if (!currentId) return;
      if (isGuest) guestStore.updateComment(currentId, solveId, comment);
      else await api.patch(`/solves/${solveId}`, { comment });
      const trimmed = comment.trim() || undefined;
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, comment: trimmed } : s)));
    },
    [currentId, isGuest],
  );

  const deleteSolve = useCallback(
    async (solveId: string) => {
      if (!currentId) return;
      if (isGuest) guestStore.deleteSolve(currentId, solveId);
      else await api.delete(`/solves/${solveId}`);
      setSolves((prev) => prev.filter((s) => s.id !== solveId));
    },
    [currentId, isGuest],
  );

  const deleteSolves = useCallback(
    async (solveIds: string[]) => {
      if (!currentId || solveIds.length === 0) return;
      if (isGuest) {
        guestStore.deleteSolvesBulk(currentId, solveIds);
      } else {
        await api.post('/solves/bulk-delete', { ids: solveIds });
      }
      const idSet = new Set(solveIds);
      setSolves((prev) => prev.filter((s) => !idSet.has(s.id)));
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId ? { ...s, solveCount: Math.max(0, (s.solveCount ?? 0) - solveIds.length) } : s,
        ),
      );
    },
    [currentId, isGuest],
  );

  // Re-reads the current session's solves from the server. Used when returning
  // to the Timer after the Solves/Stats sub-screens may have changed things,
  // and available as a pull-to-refresh action so a user who just solved on the
  // web can pull the same session up to date on their phone.
  const reload = useCallback(async () => {
    await loadSessions();
    if (!currentId) return;
    if (isGuest) {
      setSolves([...guestStore.listSolves(currentId)]);
    } else {
      const { data } = await api.get<SolveDTO[]>(`/sessions/${currentId}/solves`);
      setSolves(data);
    }
  }, [loadSessions, currentId, isGuest]);

  return {
    isGuest,
    loading,
    solvesLoading,
    sessions: eventSessions,
    allSessions: sessions,
    currentId,
    setCurrentId,
    solves,
    createSession,
    renameSession,
    deleteSession,
    addSolve,
    updatePenalty,
    updateTime,
    updateComment,
    deleteSolve,
    deleteSolves,
    reload,
  };
}

export type TimerData = ReturnType<typeof useTimerData>;
