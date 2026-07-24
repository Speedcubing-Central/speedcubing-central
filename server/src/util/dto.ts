import type { User, Solve, Session, Reconstruction, AlgSolve, CustomRelay, RelayAttempt, RelayAttemptLeg } from '@prisma/client';
import type {
  PublicUser,
  SolveDTO,
  SessionDTO,
  ReconstructionDTO,
  AlgSolveDTO,
  CustomRelayDTO,
  CustomRelayEventEntry,
  RelayAttemptDTO,
} from '@scc/shared';

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    wcaId: u.wcaId,
    displayName: u.displayName,
    country: u.country,
    avatarUrl: u.avatarUrl,
    role: u.role,
    betaAccess: u.betaAccess,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toSolveDTO(s: Solve): SolveDTO {
  return {
    id: s.id,
    sessionId: s.sessionId,
    userId: s.userId,
    time: s.time,
    penalty: s.penalty,
    scramble: s.scramble,
    solution: s.solution ?? undefined,
    comment: s.comment ?? undefined,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toSessionDTO(s: Session & { _count?: { solves: number } }): SessionDTO {
  return {
    id: s.id,
    userId: s.userId,
    eventId: s.eventId,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    solveCount: s._count?.solves,
  };
}

export function toAlgSolveDTO(s: AlgSolve): AlgSolveDTO {
  return {
    id: s.id,
    userId: s.userId,
    setId: s.setId,
    caseId: s.caseId,
    time: s.time,
    penalty: s.penalty,
    scramble: s.scramble,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toReconstructionDTO(r: Reconstruction): ReconstructionDTO {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    eventId: r.eventId,
    scramble: r.scramble,
    solution: r.solution,
    timeMs: r.timeMs,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toCustomRelayDTO(cr: CustomRelay): CustomRelayDTO {
  return {
    id: cr.id,
    userId: cr.userId,
    name: cr.name,
    events: cr.events as unknown as CustomRelayEventEntry[],
    createdAt: cr.createdAt.toISOString(),
  };
}

export function toRelayAttemptDTO(a: RelayAttempt & { legs: RelayAttemptLeg[] }): RelayAttemptDTO {
  return {
    id: a.id,
    userId: a.userId,
    relayName: a.relayName,
    totalTimeMs: a.totalTimeMs,
    createdAt: a.createdAt.toISOString(),
    legs: a.legs
      .sort((x, y) => x.order - y.order)
      .map((l) => ({ id: l.id, eventId: l.eventId, order: l.order, scramble: l.scramble, splitMs: l.splitMs })),
  };
}
