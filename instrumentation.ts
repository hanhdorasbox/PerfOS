/**
 * Next.js instrumentation hook — runs once when the Node.js server starts.
 *
 * Uses raw SQL (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS) instead
 * of the Prisma CLI because:
 *  - No subprocess / binary path issues on Vercel Lambda
 *  - Each step is independent — one failure doesn't block the rest
 *  - PostgreSQL's IF NOT EXISTS makes every step idempotent
 *
 * Only runs on PostgreSQL (production/Neon).  SQLite (local dev) already has
 * all columns from the initial schema push.
 */

import type { PrismaClient } from '@prisma/client'

const MIGRATIONS = [
  // ── CapabilityGoal ─── learning-roadmap upgrade (commit 31d98bc) ─────────
  `ALTER TABLE "CapabilityGoal"
     ADD COLUMN IF NOT EXISTS "roadmapType"    TEXT,
     ADD COLUMN IF NOT EXISTS "deadline"       TIMESTAMP(3),
     ADD COLUMN IF NOT EXISTS "weeklyHours"    DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS "detailLevel"    TEXT NOT NULL DEFAULT 'standard',
     ADD COLUMN IF NOT EXISTS "healthStatus"   TEXT NOT NULL DEFAULT 'not_started',
     ADD COLUMN IF NOT EXISTS "nextBestAction" TEXT,
     ADD COLUMN IF NOT EXISTS "archivedAt"     TIMESTAMP(3),
     ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()`,

  // ── LearningMilestone ─── learning-roadmap upgrade ───────────────────────
  `ALTER TABLE "LearningMilestone"
     ADD COLUMN IF NOT EXISTS "phaseName"      TEXT,
     ADD COLUMN IF NOT EXISTS "order"          INTEGER NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS "description"    TEXT,
     ADD COLUMN IF NOT EXISTS "estimatedHours" DOUBLE PRECISION`,

  // ── LearningStep ─── new table (learning-roadmap upgrade) ────────────────
  `CREATE TABLE IF NOT EXISTS "LearningStep" (
     "id"                 TEXT    NOT NULL,
     "milestoneId"        TEXT    NOT NULL,
     "title"              TEXT    NOT NULL,
     "description"        TEXT,
     "order"              INTEGER NOT NULL DEFAULT 0,
     "estimatedMinutes"   INTEGER NOT NULL DEFAULT 30,
     "completionCriteria" TEXT,
     "stepType"           TEXT    NOT NULL DEFAULT 'practice',
     "completed"          BOOLEAN NOT NULL DEFAULT false,
     "completedAt"        TIMESTAMP(3),
     "weeklyTaskId"       TEXT,
     "suggestedDay"       TEXT,
     CONSTRAINT "LearningStep_pkey" PRIMARY KEY ("id")
   )`,

  // ── CareerTrajectory ─── career-execution upgrade (commit 9d732bc) ────────
  `ALTER TABLE "CareerTrajectory"
     ADD COLUMN IF NOT EXISTS "readinessScore"     INTEGER,
     ADD COLUMN IF NOT EXISTS "readinessBreakdown" TEXT,
     ADD COLUMN IF NOT EXISTS "executionRoadmap"   TEXT,
     ADD COLUMN IF NOT EXISTS "nextBestAction"     TEXT,
     ADD COLUMN IF NOT EXISTS "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW()`,

  // ── TrajectoryGap ─── career-execution upgrade ────────────────────────────
  `ALTER TABLE "TrajectoryGap"
     ADD COLUMN IF NOT EXISTS "actionPlan"      TEXT,
     ADD COLUMN IF NOT EXISTS "nextBestAction"  TEXT,
     ADD COLUMN IF NOT EXISTS "evidenceNeeded"  TEXT,
     ADD COLUMN IF NOT EXISTS "closureEvidence" TEXT,
     ADD COLUMN IF NOT EXISTS "archived"        BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS "archivedAt"      TIMESTAMP(3),
     ADD COLUMN IF NOT EXISTS "difficulty"      TEXT,
     ADD COLUMN IF NOT EXISTS "weekEstimate"    INTEGER`,

  // ── WeeklyReport ─── live-report upgrade (commit 58c27ed) ─────────────────
  `ALTER TABLE "WeeklyReport"
     ADD COLUMN IF NOT EXISTS "isLive"    BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS "status"    TEXT    NOT NULL DEFAULT 'stable',
     ADD COLUMN IF NOT EXISTS "liveData"  TEXT,
     ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
]

async function runMigrations(db: PrismaClient) {
  let ok = 0
  let fail = 0
  for (const sql of MIGRATIONS) {
    try {
      await db.$executeRawUnsafe(sql)
      ok++
    } catch (e) {
      fail++
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
      console.error(`[instrumentation] migration step failed: ${msg}`)
    }
  }
  console.log(`[instrumentation] migrations done — ${ok} ok, ${fail} failed`)
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const dbUrl = process.env.DATABASE_URL ?? ''
  // Raw ALTER TABLE only works on PostgreSQL.
  // SQLite (local dev) already has all columns from the start.
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) return

  try {
    const { PrismaClient } = await import('@prisma/client')
    const db = new PrismaClient()
    await runMigrations(db)
    await db.$disconnect()
  } catch (e) {
    console.error('[instrumentation] unexpected error:', e)
  }
}
