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

  // Bulk import (e.g. from a cstimer export). Chunked for authed users since
  // the API caps request bodies at 1mb; the guest store just writes once
  // locally. Switches the view to the destination session once done and
  // refreshes its solves directly — setCurrentId alone isn't enough when
  // importing into a session we *just* created (createSession already set
  // currentId to it, so setting the same id again is a no-op and the
  // solves-loading effect above never re-fires to pick up what we just
  // wrote).
  const IMPORT_CHUNK_SIZE = 1000;
  const importSolves = useCallback(
    async (
      sessionId: string,
      entries: { time: number; penalty: Penalty; scramble: string; createdAt: string }[],
      onProgress?: (done: number, total: number) => void,
    ) => {
      if (isGuest) {
        guestStore.addSolvesBulk(sessionId, entries);
      } else {
        for (let i = 0; i < entries.length; i += IMPORT_CHUNK_SIZE) {
          const chunk = entries.slice(i, i + IMPORT_CHUNK_SIZE);
          await api.post(`/sessions/${sessionId}/solves/bulk`, { solves: chunk });
          onProgress?.(Math.min(i + IMPORT_CHUNK_SIZE, entries.length), entries.length);
        }
      }
      await loadSessions();
      setCurrentId(sessionId);
      if (isGuest) {
        setSolves(guestStore.listSolves(sessionId));
      } else {
        const { data } = await api.get<SolveDTO[]>(`/sessions/${sessionId}/solves`);
        setSolves(data);
      }
    },
    [isGuest, loadSessions],
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
    importSolves,
  };
}
