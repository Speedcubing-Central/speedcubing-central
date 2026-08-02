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

// Distinguishes solves that exist locally but not yet on the server. A counter
// rather than a random id so it is obvious in a log what it is, and module
// scope so two mounts of this hook cannot mint the same one.
let tempSolveSeq = 0;

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

  // ── Recording a solve does not wait for the server ────────────────────────
  //
  // It used to. The POST was awaited before the solve reached the list, and
  // everything downstream waited with it: the stats panel kept showing the
  // previous solve and the previous ao5, the PB overlay held back, the next
  // scramble was not even requested yet, and `inputBlocked` stayed true, so the
  // next attempt could not start. On a phone talking to production that is a
  // few hundred milliseconds of the app looking like it missed the solve,
  // every solve, at the exact moment a cuber is reaching to start the next one.
  //
  // So the solve is inserted locally the instant the timer stops, under a
  // temporary id, and the request goes out behind it. Failure removes it again
  // and says why. This is the same trade the edits below make, and the same one
  // the guest path has always made (its "server" is synchronous local storage).
  //
  // The temporary id is the one real hazard: a penalty tapped on a solve whose
  // create is still in flight would PATCH an id the server has never heard of.
  // `pendingCreates` closes that. Any mutation resolves its id through it first,
  // so an edit made in the gap waits for the create it belongs to and then goes
  // out against the real id. Nothing in the UI has to know a solve is pending.
  const pendingCreates = useRef(new Map<string, Promise<SolveDTO>>());

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

      if (isGuest) {
        const solve = guestStore.addSolve(id, time, penalty, plusTwoCount, scramble, solution);
        setSolves((prev) => [solve, ...prev]);
        setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, solveCount: (s.solveCount ?? 0) + 1 } : s)));
        setLastSessionForEvent(eventId, id);
        return solve;
      }

      const tempId = `pending-${++tempSolveSeq}`;
      const optimistic: SolveDTO = {
        id: tempId,
        sessionId: id,
        userId: user?.id ?? '',
        time,
        penalty,
        plusTwoCount: penalty === 'DNF' ? 0 : plusTwoCount,
        scramble,
        solution,
        // The server stamps its own, and the reconcile below adopts it. This
        // one only has to order correctly against the solves already in the
        // list, which are all older.
        createdAt: new Date().toISOString(),
      };
      setSolves((prev) => [optimistic, ...prev]);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, solveCount: (s.solveCount ?? 0) + 1 } : s)));
      setLastSessionForEvent(eventId, id);

      const request = api
        .post<SolveDTO>(`/sessions/${id}/solves`, { time, penalty, plusTwoCount, scramble, solution })
        .then((r) => r.data);
      // Kept for the life of the hook rather than deleted on settle. Deleting
      // would open a race of its own: React applies the id swap below on its
      // own schedule, so for a moment the UI can still be holding the temporary
      // id after the entry is gone, and a tap in that moment would send it.
      pendingCreates.current.set(tempId, request);

      request.then(
        (saved) => {
          // Identity from the server, everything else from the local copy,
          // because the local copy is the one that may have been edited while
          // the request was in flight. Those edits are already on their way
          // separately (see resolveSolveId), so taking the server's body here
          // would show them being undone and then reappearing.
          setSolves((prev) =>
            prev.map((s) =>
              s.id === tempId ? { ...s, id: saved.id, sessionId: saved.sessionId, createdAt: saved.createdAt } : s,
            ),
          );
        },
        (e) => {
          setSolves((prev) => prev.filter((s) => s.id !== tempId));
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, solveCount: Math.max(0, (s.solveCount ?? 0) - 1) } : s)),
          );
          Alert.alert('Solve not saved', apiError(e, 'Please try again.'));
        },
      );

      return optimistic;
    },
    [currentId, isGuest, eventId, setLastSessionForEvent, user?.id],
  );

  // Resolves once this solve exists on the server, rejects if its create
  // failed. Instant for a guest solve or one that was saved a while ago.
  //
  // For the one caller that has something of its own to undo when a save fails:
  // the Timer moves to the next scramble the moment an attempt ends, and if the
  // save then fails it wants that scramble back. Removing the solve and saying
  // why is this hook's job and is already done by the time this rejects.
  const whenSaved = useCallback(async (solveId: string): Promise<void> => {
    const pending = pendingCreates.current.get(solveId);
    if (pending) await pending;
  }, []);

  // The id the server knows this solve by, waiting for its create if that is
  // still in flight. Null means the create failed, so the solve no longer
  // exists to edit and the caller should quietly stop: the failure has already
  // been reported once by addSolve, and saying it twice helps nobody.
  const resolveSolveId = useCallback(async (solveId: string): Promise<string | null> => {
    const pending = pendingCreates.current.get(solveId);
    if (!pending) return solveId;
    try {
      return (await pending).id;
    } catch {
      return null;
    }
  }, []);

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
      send: (serverId: string) => Promise<unknown>,
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
        // The solve may exist only locally still, so `send` is given the id the
        // server knows rather than the one the UI is holding. On a solve that
        // was already saved this resolves in the same tick.
        const serverId = await resolveSolveId(solveId);
        if (serverId === null) return;
        await send(serverId);
      } catch (e) {
        if (previous) {
          const restore = previous;
          setSolves((prev) => prev.map((s) => (s.id === solveId ? restore : s)));
        }
        report(e, failure);
      }
    },
    [currentId, report, resolveSolveId],
  );

  const updatePenalty = useCallback(
    async (solveId: string, penalty: Penalty, plusTwoCount: number) => {
      if (!currentId) return;
      const count = penalty === 'DNF' ? 0 : plusTwoCount;
      await patchSolve(
        solveId,
        (s) => ({ ...s, penalty, plusTwoCount: count }),
        async (serverId) => {
          if (isGuest) guestStore.updatePenalty(currentId, solveId, penalty, count);
          else await api.patch(`/solves/${serverId}`, { penalty, plusTwoCount: count });
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
        async (serverId) => {
          if (isGuest) guestStore.updateTime(currentId, solveId, time);
          else await api.patch(`/solves/${serverId}`, { time });
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
        async (serverId) => {
          if (isGuest) guestStore.updateComment(currentId, solveId, comment);
          else await api.patch(`/solves/${serverId}`, { comment });
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
        if (isGuest) {
          guestStore.deleteSolve(currentId, solveId);
        } else {
          // Same reason as patchSolve: a solve deleted seconds after it was
          // timed may still be on its way to the server.
          const serverId = await resolveSolveId(solveId);
          if (serverId === null) return;
          await api.delete(`/solves/${serverId}`);
        }
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
    [currentId, isGuest, report, resolveSolveId],
  );

  const deleteSolves = useCallback(
    async (solveIds: string[]) => {
      if (!currentId || solveIds.length === 0) return;
      // Sent before it is applied, unlike the single-solve edits above. This one
      // is already behind a confirmation dialog, so there is no "I tapped and
      // nothing happened" to solve, and reverting it would mean restoring
      // several positions in a newest-first list rather than one.
      try {
        if (isGuest) {
          guestStore.deleteSolvesBulk(currentId, solveIds);
        } else {
          // A selection can include a solve whose create is still in flight.
          // Nulls are creates that failed, so there is nothing to delete.
          const serverIds = (await Promise.all(solveIds.map(resolveSolveId))).filter(
            (id): id is string => id !== null,
          );
          if (serverIds.length > 0) await api.post('/solves/bulk-delete', { ids: serverIds });
        }
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
    [currentId, isGuest, report, resolveSolveId],
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
      // Solves still on their way to the server are not in this response, and
      // dropping them would make a solve that just finished vanish from the
      // list until the next refresh. They keep their place at the front; the
      // list is newest first and they are the newest things there are.
      setSolves((prev) => [...prev.filter((s) => pendingCreates.current.has(s.id)), ...data]);
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
    whenSaved,
    updatePenalty,
    updateTime,
    updateComment,
    deleteSolve,
    deleteSolves,
    reload,
  };
}

export type TimerData = ReturnType<typeof useTimerData>;
