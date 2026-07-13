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

  // ── FitnessScheduleChange ─── fitness schedule removal tracking ───────────
  `CREATE TABLE IF NOT EXISTS "FitnessScheduleChange" (
     "id"              TEXT    NOT NULL,
     "userId"          TEXT    NOT NULL,
     "weekId"          TEXT    NOT NULL,
     "sessionLabel"    TEXT    NOT NULL,
     "sessionDay"      TEXT    NOT NULL,
     "sessionType"     TEXT    NOT NULL DEFAULT 'strength',
     "action"          TEXT    NOT NULL,
     "reason"          TEXT,
     "replacementText" TEXT,
     "affectsAdherence" BOOLEAN NOT NULL DEFAULT true,
     "undone"          BOOLEAN NOT NULL DEFAULT false,
     "notes"           TEXT,
     "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
     CONSTRAINT "FitnessScheduleChange_pkey" PRIMARY KEY ("id")
   )`,

  // ── Recipe ─── personal recipe library ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "Recipe" (
     "id"            TEXT    NOT NULL,
     "userId"        TEXT    NOT NULL,
     "name"          TEXT    NOT NULL,
     "mealType"      TEXT    NOT NULL,
     "description"   TEXT,
     "prepMinutes"   INTEGER,
     "cookMinutes"   INTEGER,
     "portions"      INTEGER NOT NULL DEFAULT 1,
     "difficulty"    TEXT,
     "tags"          TEXT,
     "notes"         TEXT,
     "liked"         BOOLEAN,
     "storageDays"   INTEGER,
     "isMealPrep"    BOOLEAN NOT NULL DEFAULT false,
     "status"        TEXT    NOT NULL DEFAULT 'active',
     "totalCalories" DOUBLE PRECISION,
     "totalProtein"  DOUBLE PRECISION,
     "totalCarbs"    DOUBLE PRECISION,
     "totalFat"      DOUBLE PRECISION,
     "totalFiber"    DOUBLE PRECISION,
     "lastUsedAt"    TIMESTAMP(3),
     "usageCount"    INTEGER NOT NULL DEFAULT 0,
     "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
     "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
     CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
   )`,

  // ── RecipeIngredient ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
     "id"       TEXT    NOT NULL,
     "recipeId" TEXT    NOT NULL,
     "name"     TEXT    NOT NULL,
     "amount"   DOUBLE PRECISION NOT NULL,
     "unit"     TEXT    NOT NULL DEFAULT 'g',
     "calories" DOUBLE PRECISION,
     "protein"  DOUBLE PRECISION,
     "carbs"    DOUBLE PRECISION,
     "fat"      DOUBLE PRECISION,
     "fiber"    DOUBLE PRECISION,
     "brand"    TEXT,
     "order"    INTEGER NOT NULL DEFAULT 0,
     CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
   )`,

  // ── RecipeStep ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "RecipeStep" (
     "id"          TEXT    NOT NULL,
     "recipeId"    TEXT    NOT NULL,
     "instruction" TEXT    NOT NULL,
     "order"       INTEGER NOT NULL DEFAULT 0,
     CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
   )`,

  // ── CapabilityGoal extra columns ─── strategic roadmap + capital ──────────
  `ALTER TABLE "CapabilityGoal"
     ADD COLUMN IF NOT EXISTS "strategicRoadmap" TEXT,
     ADD COLUMN IF NOT EXISTS "capitalPotential"  TEXT`,

  // ── CareerRoadmap ─── persistent goal roadmaps ────────────────────────────
  `CREATE TABLE IF NOT EXISTS "CareerRoadmap" (
     "id"        TEXT        NOT NULL,
     "userId"    TEXT        NOT NULL,
     "goal"      TEXT        NOT NULL,
     "timeframe" TEXT,
     "context"   TEXT,
     "roadmap"   TEXT        NOT NULL,
     "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT "CareerRoadmap_pkey" PRIMARY KEY ("id")
   )`,

  // ── AlcoholLog ─── habit breaker module ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "AlcoholLog" (
     "id"               TEXT             NOT NULL,
     "userId"           TEXT             NOT NULL,
     "date"             TIMESTAMP(3)     NOT NULL,
     "drinks"           DOUBLE PRECISION NOT NULL,
     "occasion"         TEXT,
     "afterWorkout"     BOOLEAN          NOT NULL DEFAULT false,
     "beforeWorkoutDay" BOOLEAN          NOT NULL DEFAULT false,
     "sleepHours"       DOUBLE PRECISION,
     "sleepQuality"     INTEGER,
     "nextDayEnergy"    INTEGER,
     "missedWorkout"    BOOLEAN          NOT NULL DEFAULT false,
     "missedSteps"      BOOLEAN          NOT NULL DEFAULT false,
     "proteinHit"       BOOLEAN,
     "calorieOverage"   INTEGER,
     "hadCravings"      BOOLEAN          NOT NULL DEFAULT false,
     "moodScore"        INTEGER,
     "recoveryRating"   INTEGER,
     "notes"            TEXT,
     "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT NOW(),
     CONSTRAINT "AlcoholLog_pkey" PRIMARY KEY ("id")
   )`,

  // ── AlcoholSettings ─── habit breaker settings ────────────────────────────
  `CREATE TABLE IF NOT EXISTS "AlcoholSettings" (
     "id"                   TEXT        NOT NULL,
     "userId"               TEXT        NOT NULL,
     "budgetType"           TEXT        NOT NULL DEFAULT 'flexible',
     "weeklyBudget"         INTEGER     NOT NULL DEFAULT 2,
     "goal"                 TEXT        NOT NULL DEFAULT 'fat_loss',
     "damageControlEnabled" BOOLEAN     NOT NULL DEFAULT true,
     "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
     "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
     CONSTRAINT "AlcoholSettings_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "AlcoholSettings_userId_key" UNIQUE ("userId")
   )`,

  // ── PlannedMeal.recipe ─── full recipe JSON added with the meal-recipe feature
  `ALTER TABLE "PlannedMeal" ADD COLUMN IF NOT EXISTS "recipe" TEXT`,

  // ── Finance OS (finance_os schema, normally migrated by drizzle-kit) ───
  // Belt-and-suspenders: the build's `drizzle-kit migrate` is `|| true`, so
  // guard the checklist column here too — without it, selecting analyses fails.
  `ALTER TABLE "finance_os"."analyses" ADD COLUMN IF NOT EXISTS "checklist" jsonb`,
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
