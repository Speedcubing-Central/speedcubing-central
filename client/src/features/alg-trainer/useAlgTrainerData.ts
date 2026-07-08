import { useCallback, useEffect, useState } from 'react';
import type { AlgSolveDTO, Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { guestAlgStore } from './algLocalStore';

// Unified alg-trainer solve history. Uses the server when authenticated,
// otherwise localStorage — same guest/authed split as features/timer/
// useTimerData.ts, but scoped to (user, setId) instead of a session, since
// per-case PBs need the full history for a set rather than one practice run.
export function useAlgTrainerData(setId: string | null) {
  const { user } = useAuth();
  const isGuest = !user;

  const [solves, setSolves] = useState<AlgSolveDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!setId) {
      setSolves([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = isGuest
        ? guestAlgStore.listSolves(setId)
        : (await api.get<AlgSolveDTO[]>(`/alg-solves/${setId}`)).data;
      if (!cancelled) {
        setSolves(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId, isGuest]);

  const addSolve = useCallback(
    async (caseId: string, time: number, penalty: Penalty, scramble: string) => {
      if (!setId) return;
      const solve = isGuest
        ? guestAlgStore.addSolve(setId, caseId, time, penalty, scramble)
        : (await api.post<AlgSolveDTO>('/alg-solves', { setId, caseId, time, penalty, scramble })).data;
      setSolves((prev) => [solve, ...prev]);
      return solve;
    },
    [setId, isGuest],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty) => {
      if (!setId) return;
      if (isGuest) guestAlgStore.updatePenalty(setId, solveId, penalty);
      else await api.patch(`/alg-solves/${solveId}`, { penalty });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, penalty } : s)));
    },
    [setId, isGuest],
  );

  const updateTime = useCallback(
    async (solveId: string, time: number) => {
      if (!setId) return;
      if (isGuest) guestAlgStore.updateTime(setId, solveId, time);
      else await api.patch(`/alg-solves/${solveId}`, { time });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, time } : s)));
    },
    [setId, isGuest],
  );

  const deleteSolve = useCallback(
    async (solveId: string) => {
      if (!setId) return;
      if (isGuest) guestAlgStore.deleteSolve(setId, solveId);
      else await api.delete(`/alg-solves/${solveId}`);
      setSolves((prev) => prev.filter((s) => s.id !== solveId));
    },
    [setId, isGuest],
  );

  return { isGuest, loading, solves, addSolve, updatePenalty, updateTime, deleteSolve };
}
