// Runs ahead of `prisma db push` (see the `start` and `db:setup` npm scripts):
// db push diffs schema.prisma against the live DB in one shot, so on a DB that
// still has rows using the old PLUS2 enum value, narrowing the Penalty enum
// to NONE/DNF fails outright (Postgres won't drop an enum variant still in
// use). On the very first deploy of this change, plusTwoCount doesn't exist
// yet either — db push is what would normally add it, but that's the same
// db push this script has to run ahead of — so this script adds the column
// itself first, then backfills PLUS2 rows into it (penalty NONE, plusTwoCount
// 1, the exact single-+2 case PLUS2 represented), leaving the enum narrowing
// that follows with nothing left to fail on.
//
// Idempotent, but not simply by the UPDATE matching zero rows: once db push
// has narrowed the enum, the literal 'PLUS2' below is no longer a valid value
// for the column's type at all, and comparing against it errors rather than
// matching nothing. So every run first checks whether 'PLUS2' still exists as
// an enum label and skips both steps entirely once it's gone (every deploy
// after the first).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const [{ exists }] = await prisma.$queryRawUnsafe(
  `SELECT EXISTS (
     SELECT 1 FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'Penalty' AND e.enumlabel = 'PLUS2'
   ) AS exists`
);

if (exists) {
  for (const table of ['Solve', 'AlgSolve', 'BattleParticipant']) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "plusTwoCount" INTEGER NOT NULL DEFAULT 0`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "plusTwoCount" = 1, "penalty" = 'NONE' WHERE "penalty" = 'PLUS2'`
    );
  }
}

await prisma.$disconnect();
