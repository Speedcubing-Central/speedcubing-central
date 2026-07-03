import type { User, Solve, Session, Reconstruction } from '@prisma/client';
import type { PublicUser, SolveDTO, SessionDTO, ReconstructionDTO } from '@scc/shared';

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    wcaId: u.wcaId,
    displayName: u.displayName,
    country: u.country,
    avatarUrl: u.avatarUrl,
    role: u.role,
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
