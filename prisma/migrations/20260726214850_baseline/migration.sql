-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GUEST', 'USER');

-- CreateEnum
CREATE TYPE "Penalty" AS ENUM ('NONE', 'DNF');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "RelayStatus" AS ENUM ('LOBBY', 'ASSIGNING', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "AlgStatus" AS ENUM ('NEW', 'LEARNING', 'LEARNED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "wcaId" TEXT,
    "displayName" TEXT NOT NULL,
    "country" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "betaAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solve" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "penalty" "Penalty" NOT NULL DEFAULT 'NONE',
    "plusTwoCount" INTEGER NOT NULL DEFAULT 0,
    "scramble" TEXT NOT NULL,
    "solution" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlgSolve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "penalty" "Penalty" NOT NULL DEFAULT 'NONE',
    "plusTwoCount" INTEGER NOT NULL DEFAULT 0,
    "scramble" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlgSolve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL DEFAULT '333',
    "algSetId" TEXT,
    "hostParticipantId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "scramble" TEXT NOT NULL DEFAULT '',
    "roundNumber" INTEGER NOT NULL DEFAULT 0,
    "status" "BattleStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "time" INTEGER,
    "penalty" "Penalty",
    "plusTwoCount" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAlgPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "AlgStatus" NOT NULL DEFAULT 'NEW',
    "preferredAlg" TEXT,

    CONSTRAINT "UserAlgPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlgSetSelection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "caseIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlgSetSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlgProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlgProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconstruction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "eventId" TEXT NOT NULL,
    "scramble" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "timeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reconstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRelay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomRelay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relayName" TEXT NOT NULL,
    "totalTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelayAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayAttemptLeg" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scramble" TEXT NOT NULL,
    "splitMs" INTEGER,

    CONSTRAINT "RelayAttemptLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "hostParticipantId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "presetId" TEXT,
    "customRelayId" TEXT,
    "status" "RelayStatus" NOT NULL DEFAULT 'LOBBY',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelayRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayRoomLeg" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scramble" TEXT NOT NULL DEFAULT '',
    "assignedToId" TEXT,
    "splitMs" INTEGER,

    CONSTRAINT "RelayRoomLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RelayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_wcaId_key" ON "User"("wcaId");

-- CreateIndex
CREATE INDEX "User_wcaId_idx" ON "User"("wcaId");

-- CreateIndex
CREATE INDEX "Session_userId_eventId_idx" ON "Session"("userId", "eventId");

-- CreateIndex
CREATE INDEX "Solve_sessionId_createdAt_idx" ON "Solve"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlgSolve_userId_setId_idx" ON "AlgSolve"("userId", "setId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleRoom_code_key" ON "BattleRoom"("code");

-- CreateIndex
CREATE INDEX "BattleParticipant_roomId_idx" ON "BattleParticipant"("roomId");

-- CreateIndex
CREATE INDEX "UserAlgPref_userId_setId_idx" ON "UserAlgPref"("userId", "setId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAlgPref_userId_setId_caseId_key" ON "UserAlgPref"("userId", "setId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "AlgSetSelection_userId_setId_key" ON "AlgSetSelection"("userId", "setId");

-- CreateIndex
CREATE UNIQUE INDEX "AlgProgress_userId_setId_caseId_key" ON "AlgProgress"("userId", "setId", "caseId");

-- CreateIndex
CREATE INDEX "Reconstruction_userId_idx" ON "Reconstruction"("userId");

-- CreateIndex
CREATE INDEX "CustomRelay_userId_idx" ON "CustomRelay"("userId");

-- CreateIndex
CREATE INDEX "RelayAttempt_userId_idx" ON "RelayAttempt"("userId");

-- CreateIndex
CREATE INDEX "RelayAttemptLeg_attemptId_idx" ON "RelayAttemptLeg"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "RelayRoom_code_key" ON "RelayRoom"("code");

-- CreateIndex
CREATE INDEX "RelayRoomLeg_roomId_idx" ON "RelayRoomLeg"("roomId");

-- CreateIndex
CREATE INDEX "RelayParticipant_roomId_idx" ON "RelayParticipant"("roomId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solve" ADD CONSTRAINT "Solve_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solve" ADD CONSTRAINT "Solve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlgSolve" ADD CONSTRAINT "AlgSolve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "BattleRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAlgPref" ADD CONSTRAINT "UserAlgPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlgSetSelection" ADD CONSTRAINT "AlgSetSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlgProgress" ADD CONSTRAINT "AlgProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconstruction" ADD CONSTRAINT "Reconstruction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRelay" ADD CONSTRAINT "CustomRelay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayAttempt" ADD CONSTRAINT "RelayAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayAttemptLeg" ADD CONSTRAINT "RelayAttemptLeg_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RelayAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayRoomLeg" ADD CONSTRAINT "RelayRoomLeg_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RelayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayParticipant" ADD CONSTRAINT "RelayParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RelayRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayParticipant" ADD CONSTRAINT "RelayParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

