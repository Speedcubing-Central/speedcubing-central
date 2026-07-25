-- Add plusTwoCount (stackable +2 count, 0-8) alongside the existing penalty
-- column on every model that has one, then retire the PLUS2 enum value in
-- favor of it: a "+2" solve is now penalty=NONE with plusTwoCount>=1 instead
-- of penalty=PLUS2. Order matters here — the new columns must exist and be
-- backfilled *before* the enum is narrowed, since narrowing first would fail
-- outright on any row still holding the value being dropped.

-- AlterTable: add plusTwoCount, defaulting existing (and future) rows to 0.
ALTER TABLE "Solve" ADD COLUMN     "plusTwoCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AlgSolve" ADD COLUMN     "plusTwoCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BattleParticipant" ADD COLUMN     "plusTwoCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: every existing PLUS2 row becomes "one stacked +2" (penalty NONE,
-- plusTwoCount 1) — the exact single-+2 case the old enum value represented.
UPDATE "Solve" SET "plusTwoCount" = 1, "penalty" = 'NONE' WHERE "penalty" = 'PLUS2';
UPDATE "AlgSolve" SET "plusTwoCount" = 1, "penalty" = 'NONE' WHERE "penalty" = 'PLUS2';
UPDATE "BattleParticipant" SET "plusTwoCount" = 1, "penalty" = 'NONE' WHERE "penalty" = 'PLUS2';

-- AlterEnum: now safe — no remaining row references PLUS2.
BEGIN;
CREATE TYPE "Penalty_new" AS ENUM ('NONE', 'DNF');
ALTER TABLE "Solve" ALTER COLUMN "penalty" DROP DEFAULT;
ALTER TABLE "AlgSolve" ALTER COLUMN "penalty" DROP DEFAULT;
ALTER TABLE "Solve" ALTER COLUMN "penalty" TYPE "Penalty_new" USING ("penalty"::text::"Penalty_new");
ALTER TABLE "AlgSolve" ALTER COLUMN "penalty" TYPE "Penalty_new" USING ("penalty"::text::"Penalty_new");
ALTER TABLE "BattleParticipant" ALTER COLUMN "penalty" TYPE "Penalty_new" USING ("penalty"::text::"Penalty_new");
ALTER TYPE "Penalty" RENAME TO "Penalty_old";
ALTER TYPE "Penalty_new" RENAME TO "Penalty";
DROP TYPE "Penalty_old";
ALTER TABLE "Solve" ALTER COLUMN "penalty" SET DEFAULT 'NONE';
ALTER TABLE "AlgSolve" ALTER COLUMN "penalty" SET DEFAULT 'NONE';
COMMIT;
