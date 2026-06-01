import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/db-setup
 * Adds all missing columns to the production DB.
 * Safe to call multiple times — uses ADD COLUMN IF NOT EXISTS.
 */
export async function GET() {
  const results: { col: string; ok: boolean; err?: string }[] = []

  const migrations = [
    // WeeklyTask
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "description"        TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "scheduledDate"      TIMESTAMP(3)`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "domain"             TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "status"             TEXT NOT NULL DEFAULT 'planned'`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "doneCriteria"       TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "skippedReason"      TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "sourceType"         TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "rolloverCount"      INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "rolledFromTaskId"   TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "originalWeekPlanId" TEXT`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "estimatedMinutes"   INTEGER`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
    `ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
    // Create indexes if missing
    `CREATE INDEX IF NOT EXISTS "WeeklyTask_sourceModule_sourceType_sourceId_idx" ON "WeeklyTask"("sourceModule","sourceType","sourceId")`,
    `CREATE INDEX IF NOT EXISTS "WeeklyTask_weeklyPlanId_status_idx" ON "WeeklyTask"("weeklyPlanId","status")`,
    // WorkoutLog
    `ALTER TABLE "WorkoutLog" ADD COLUMN IF NOT EXISTS "linkedWeeklyTaskId" TEXT`,
  ]

  for (const sql of migrations) {
    const col = sql.slice(0, 80)
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ col, ok: true })
    } catch (e) {
      results.push({ col, ok: false, err: String(e).slice(0, 200) })
    }
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({ ok: failed.length === 0, total: results.length, failed, results })
}
