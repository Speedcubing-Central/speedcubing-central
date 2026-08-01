import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { SessionDTO, SolveDTO, Penalty } from '@scc/shared';
import { useAuth } from '../../store/auth';
import { useSettings } from '../../store/settings';
import { api, apiError } from '../../lib/api';
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

  // ── Edits are applied locally first, then sent ────────────────────────────
  //
  // These used to await the server and only then touch local state, so tapping
  // +2 did nothing at all until the round trip came back. On a fast connection
  // that reads as sluggish; on a slow one it reads as broken, and it invites a
  // second tap on a control that has already been pressed.
  //
  // Applying first and reverting on failure is the same trade `addSolve`
  // already makes. The revert restores the exact previous solve rather than
  // re-fetching, so a failed edit cannot reorder the list or lose a concurrent
  // change to a different solve.
  //
  // The revert is necessary but not sufficient, which is what `failure` is for.
  // Every edit here is fired and forgotten by its caller: a penalty button in
  // the stats panel, a comment field's onBlur, a row's delete action. None of
  // them can await a result without inventing per-row pending state, so a
  // rejected write showed only as the row quietly snapping back, which reads as
  // a glitch rather than as a failure, plus an unhandled rejection in the
  // console. So these report for themselves using the server's own message, and
  // resolve rather than reject, because a caller that cannot await also cannot
  // catch.
  //
  // Session mutations deliberately keep throwing. Their callers (SessionsScreen,
  // and TimerScreen's create-on-first-solve) already catch and report, and have
  // their own UI state to unwind on the way.
  const report = useCallback((e: unknown, failure: string) => {
    Alert.alert(failure, apiError(e, 'Please try again.'));
  }, []);

  const patchSolve = useCallback(
    async (
      solveId: string,
      apply: (s: SolveDTO) => SolveDTO,
      send: () => Promise<unknown>,
      failure: string,
    ) => {
      if (!currentId) return;
      let previous: SolveDTO | undefined;
      setSolves((prev) =>
        prev.map((s) => {
          if (s.id !== solveId) return s;
          previous = s;
          return apply(s);
        }),
      );
      try {
        await send();
      } catch (e) {
        if (previous) {
          const restore = previous;
          setSolves((prev) => prev.map((s) => (s.id === solveId ? restore : s)));
        }
        report(e, failure);
      }
    },
    [currentId, report],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty, plusTwoCount: number) => {
      if (!currentId) return;
      const count = penalty === 'DNF' ? 0 : plusTwoCount;
      await patchSolve(
        solveId,
        (s) => ({ ...s, penalty, plusTwoCount: count }),
        async () => {
          if (isGuest) guestStore.updatePenalty(currentId, solveId, penalty, count);
          else await api.patch(`/solves/${solveId}`, { penalty, plusTwoCount: count });
        },
        'Penalty not saved',
      );
    },
    [currentId, isGuest, patchSolve],
  );

  const updateTime = useCallback(
    async (solveId: string, time: number) => {
      if (!currentId) return;
      await patchSolve(
        solveId,
        (s) => ({ ...s, time }),
        async () => {
          if (isGuest) guestStore.updateTime(currentId, solveId, time);
          else await api.patch(`/solves/${solveId}`, { time });
        },
        'Time not saved',
      );
    },
    [currentId, isGuest, patchSolve],
  );

  const updateComment = useCallback(
    async (solveId: string, comment: string) => {
      if (!currentId) return;
      const trimmed = comment.trim() || undefined;
      await patchSolve(
        solveId,
        (s) => ({ ...s, comment: trimmed }),
        async () => {
          if (isGuest) guestStore.updateComment(currentId, solveId, comment);
          else await api.patch(`/solves/${solveId}`, { comment });
        },
        'Comment not saved',
      );
    },
    [currentId, isGuest, patchSolve],
  );

  const deleteSolve = useCallback(
    async (solveId: string) => {
      if (!currentId) return;
      // Captured before the removal so a failed delete can put it back where it
      // was; `solves` is newest-first and that order is load bearing for the
      // rolling averages, so re-appending would be wrong.
      let removed: { solve: SolveDTO; index: number } | null = null;
      setSolves((prev) => {
        const index = prev.findIndex((s) => s.id === solveId);
        if (index === -1) return prev;
        removed = { solve: prev[index], index };
        return prev.filter((s) => s.id !== solveId);
      });
      try {
        if (isGuest) guestStore.deleteSolve(currentId, solveId);
        else await api.delete(`/solves/${solveId}`);
      } catch (e) {
        if (removed) {
          const { solve, index } = removed;
          setSolves((prev) => {
            const next = prev.slice();
            next.splice(Math.min(index, next.length), 0, solve);
            return next;
          });
        }
        // The row reappearing is not an explanation, and the sheet that asked
        // for the delete has already closed by now.
        report(e, 'Solve not deleted');
      }
    },
    [currentId, isGuest, report],
  );

  const deleteSolves = useCallback(
    async (solveIds: string[]) => {
      if (!currentId || solveIds.length === 0) return;
      // Sent before it is applied, unlike the single-solve edits above. This one
      // is already behind a confirmation dialog, so there is no "I tapped and
      // nothing happened" to solve, and reverting it would mean restoring
      // several positions in a newest-first list rather than one.
      try {
        if (isGuest) guestStore.deleteSolvesBulk(currentId, solveIds);
        else await api.post('/solves/bulk-delete', { ids: solveIds });
      } catch (e) {
        report(e, `${solveIds.length === 1 ? 'Solve' : 'Solves'} not deleted`);
        return;
      }
      const idSet = new Set(solveIds);
      setSolves((prev) => prev.filter((s) => !idSet.has(s.id)));
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId ? { ...s, solveCount: Math.max(0, (s.solveCount ?? 0) - solveIds.length) } : s,
        ),
      );
    },
    [currentId, isGuest, report],
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
