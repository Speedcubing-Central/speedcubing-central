import { useCallback, useEffect, useState } from 'react';
import type { SessionDTO, SolveDTO, Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { guestStore } from './localStore';

// Unified sessions+solves data source. Uses the server when authenticated,
// otherwise localStorage. Exposes a single uniform API to the timer page.
export function useTimerData(eventId: string) {
  const { user } = useAuth();
  const isGuest = !user;

  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [solves, setSolves] = useState<SolveDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const eventSessions = sessions.filter((s) => s.eventId === eventId);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    if (isGuest) {
      setSessions(guestStore.listSessions());
    } else {
      const { data } = await api.get<SessionDTO[]>('/sessions');
      setSessions(data);
    }
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Keep a valid current session for the selected event.
  useEffect(() => {
    const forEvent = sessions.filter((s) => s.eventId === eventId);
    if (forEvent.length === 0) {
      setCurrentId(null);
      return;
    }
    if (!currentId || !forEvent.some((s) => s.id === currentId)) {
      setCurrentId(forEvent[0].id);
    }
  }, [sessions, eventId, currentId]);

  // Load solves whenever the current session changes.
  useEffect(() => {
    if (!currentId) {
      setSolves([]);
      return;
    }
    (async () => {
      if (isGuest) {
        setSolves(guestStore.listSolves(currentId));
      } else {
        const { data } = await api.get<SolveDTO[]>(`/sessions/${currentId}/solves`);
        setSolves(data);
      }
    })();
  }, [currentId, isGuest]);

  // Fetch solves for any session (used by the session export). Does not change
  // the currently-selected session.
  const getSolves = useCallback(
    async (sessionId: string): Promise<SolveDTO[]> => {
      if (isGuest) return guestStore.listSolves(sessionId);
      return (await api.get<SolveDTO[]>(`/sessions/${sessionId}/solves`)).data;
    },
    [isGuest],
  );

  const createSession = useCallback(
    async (name: string) => {
      let created: SessionDTO;
      if (isGuest) {
        created = guestStore.createSession(name, eventId);
      } else {
        created = (await api.post<SessionDTO>('/sessions', { name, eventId })).data;
      }
      setSessions((prev) => [created, ...prev]);
      setCurrentId(created.id);
      setSolves([]);
      return created;
    },
    [isGuest, eventId],
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
    async (time: number, penalty: Penalty, scramble: string, sessionId?: string) => {
      const id = sessionId ?? currentId;
      if (!id) return;
      let solve: SolveDTO;
      if (isGuest) {
        solve = guestStore.addSolve(id, time, penalty, scramble);
      } else {
        solve = (await api.post<SolveDTO>(`/sessions/${id}/solves`, { time, penalty, scramble })).data;
      }
      setSolves((prev) => [solve, ...prev]);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, solveCount: (s.solveCount ?? 0) + 1 } : s)),
      );
    },
    [currentId, isGuest],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty) => {
      if (!currentId) return;
      if (isGuest) guestStore.updatePenalty(currentId, solveId, penalty);
      else await api.patch(`/solves/${solveId}`, { penalty });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, penalty } : s)));
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

  const deleteSolve = useCallback(
    async (solveId: string) => {
      if (!currentId) return;
      if (isGuest) guestStore.deleteSolve(currentId, solveId);
      else await api.delete(`/solves/${solveId}`);
      setSolves((prev) => prev.filter((s) => s.id !== solveId));
    },
    [currentId, isGuest],
  );

  return {
    isGuest,
    loading,
    sessions: eventSessions,
    currentId,
    setCurrentId,
    solves,
    getSolves,
    createSession,
    renameSession,
    deleteSession,
    addSolve,
    updatePenalty,
    updateTime,
    deleteSolve,
  };
}
