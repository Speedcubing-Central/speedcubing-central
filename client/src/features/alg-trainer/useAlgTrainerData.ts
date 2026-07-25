import { useCallback, useEffect, useState } from 'react';
import type { AlgSolveDTO, Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { api } from '../../lib/api';
import { guestAlgStore } from './algLocalStore';

// Unified alg-trainer solve history. Uses the server when authenticated,
// otherwise localStorage — same guest/authed split as features/timer/
// useTimerData.ts, but scoped to (user, setId) instead of a session, since
// per-case PBs need the full history for a set rather than one practice run.
//
// Takes an array of setIds (callers currently only ever pass one) so the
// same hook covers both the Trainer session and the Stats page without a
// separate code path for each. Each AlgSolveDTO already carries its own
// `setId`, so only addSolve (which creates a brand new solve) needs the
// caller to say which set it belongs to — updatePenalty/updateTime/
// deleteSolve look it up from the existing solve instead.
export function useAlgTrainerData(setIds: string[]) {
  const { user } = useAuth();
  const isGuest = !user;
  const key = setIds.slice().sort().join(',');

  const [solves, setSolves] = useState<AlgSolveDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (setIds.length === 0) {
      setSolves([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const lists = await Promise.all(
        setIds.map((id) => (isGuest
          ? Promise.resolve(guestAlgStore.listSolves(id))
          : api.get<AlgSolveDTO[]>(`/alg-solves/${id}`).then((r) => r.data))),
      );
      if (!cancelled) {
        const merged = lists.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSolves(merged);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isGuest]);

  const addSolve = useCallback(
    async (setId: string, caseId: string, time: number, penalty: Penalty, plusTwoCount: number, scramble: string) => {
      const solve = isGuest
        ? guestAlgStore.addSolve(setId, caseId, time, penalty, plusTwoCount, scramble)
        : (await api.post<AlgSolveDTO>('/alg-solves', { setId, caseId, time, penalty, plusTwoCount, scramble })).data;
      setSolves((prev) => [solve, ...prev]);
      return solve;
    },
    [isGuest],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty, plusTwoCount: number) => {
      const target = solves.find((s) => s.id === solveId);
      if (!target) return;
      const count = penalty === 'DNF' ? 0 : plusTwoCount;
      if (isGuest) guestAlgStore.updatePenalty(target.setId, solveId, penalty, count);
      else await api.patch(`/alg-solves/${solveId}`, { penalty, plusTwoCount: count });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, penalty, plusTwoCount: count } : s)));
    },
    [isGuest, solves],
  );

  const updateTime = useCallback(
    async (solveId: string, time: number) => {
      const target = solves.find((s) => s.id === solveId);
      if (!target) return;
      if (isGuest) guestAlgStore.updateTime(target.setId, solveId, time);
      else await api.patch(`/alg-solves/${solveId}`, { time });
      setSolves((prev) => prev.map((s) => (s.id === solveId ? { ...s, time } : s)));
    },
    [isGuest, solves],
  );

  const deleteSolve = useCallback(
    async (solveId: string) => {
      const target = solves.find((s) => s.id === solveId);
      if (!target) return;
      if (isGuest) guestAlgStore.deleteSolve(target.setId, solveId);
      else await api.delete(`/alg-solves/${solveId}`);
      setSolves((prev) => prev.filter((s) => s.id !== solveId));
    },
    [isGuest, solves],
  );

  return { isGuest, loading, solves, addSolve, updatePenalty, updateTime, deleteSolve };
}
