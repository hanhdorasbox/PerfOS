/**
 * Quarter utilities — date-derived status, year-based get-or-create.
 *
 * Status is always derived from startDate/endDate vs. today.
 * The DB column is a cached copy that gets synced on every relevant load.
 */

import { prisma } from './db'

export type QuarterStatus = 'planned' | 'active' | 'closed'

// ─── Schema migration (runs once, idempotent) ─────────────────────────────────

let schemaMigrated = false

async function ensureQuarterSchema() {
  if (schemaMigrated) return
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Quarter" ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL DEFAULT 0`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Quarter" ADD COLUMN IF NOT EXISTS "quarterNumber" INTEGER NOT NULL DEFAULT 0`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Quarter" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "userId" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "weeklyTheme" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "capacityLevel" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "overloadRisk" DOUBLE PRECISION`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyPlan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WeeklyTask" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WorkoutLog" ADD COLUMN IF NOT EXISTS "linkedWeeklyTaskId" TEXT`)
    schemaMigrated = true
  } catch { /* already exists or not PostgreSQL */ }
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function quarterDates(year: number, qNum: 1 | 2 | 3 | 4): { startDate: Date; endDate: Date } {
  const starts = [0, 3, 6, 9]   // Jan/Apr/Jul/Oct
  const ends   = [2, 5, 8, 11]  // Mar/Jun/Sep/Dec
  return {
    startDate: new Date(year, starts[qNum - 1], 1, 0, 0, 0, 0),
    endDate:   new Date(year, ends[qNum - 1] + 1, 0, 23, 59, 59, 999),
  }
}

export function deriveStatus(startDate: Date, endDate: Date): QuarterStatus {
  const now = new Date()
  if (now < startDate) return 'planned'
  if (now > endDate)   return 'closed'
  return 'active'
}

export function currentYearAndQuarter(): { year: number; qNum: number } {
  const m = new Date().getMonth()
  return {
    year: new Date().getFullYear(),
    qNum: m < 3 ? 1 : m < 6 ? 2 : m < 9 ? 3 : 4,
  }
}

// ─── Status sync ─────────────────────────────────────────────────────────────

/**
 * Sync all quarters for a user: update DB status whenever it drifts from the
 * date-derived value.  Cheap — only writes rows that actually changed.
 */
export async function ensureQuarterStatuses(userId: string): Promise<void> {
  await ensureQuarterSchema()
  const rows = await prisma.quarter.findMany({
    where: { userId },
    select: { id: true, startDate: true, endDate: true, status: true },
  })
  const stale = rows.filter(q => deriveStatus(q.startDate, q.endDate) !== q.status)
  if (stale.length === 0) return
  await Promise.all(
    stale.map(q =>
      prisma.quarter.update({
        where: { id: q.id },
        data:  { status: deriveStatus(q.startDate, q.endDate) },
      })
    )
  )
}

// ─── Year quarters ────────────────────────────────────────────────────────────

type QuarterWithGoals = Awaited<ReturnType<typeof fetchQuarterWithGoals>>

async function fetchQuarterWithGoals(id: string) {
  return prisma.quarter.findUniqueOrThrow({
    where: { id },
    include: {
      goals: {
        include: {
          milestones:      true,
          progressUpdates: { orderBy: { loggedAt: 'asc' } },
        },
      },
    },
  })
}

/**
 * Return all 4 quarters for a given year, creating any that are missing.
 * Legacy quarters (year=0) whose startDate falls in the target year are
 * upgraded in place so existing goals are preserved.
 */
export async function getOrCreateYearQuarters(
  userId: string,
  year: number,
): Promise<QuarterWithGoals[]> {
  await ensureQuarterStatuses(userId)

  // Fetch already-structured quarters for this year
  const structured = await prisma.quarter.findMany({
    where: { userId, year },
    include: {
      goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' } } } },
    },
    orderBy: { quarterNumber: 'asc' },
  })

  const existingNums = new Set(structured.map(q => q.quarterNumber))
  if (existingNums.size === 4) return structured.sort((a, b) => a.quarterNumber - b.quarterNumber)

  // Fetch legacy quarters (year=0) whose startDate is within this calendar year
  const legacy = await prisma.quarter.findMany({
    where: {
      userId,
      year: 0,
      startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
    include: {
      goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' } } } },
    },
  })

  const result: QuarterWithGoals[] = [...structured]

  for (let qNum = 1; qNum <= 4; qNum++) {
    if (existingNums.has(qNum)) continue

    const { startDate, endDate } = quarterDates(year, qNum as 1 | 2 | 3 | 4)
    const status = deriveStatus(startDate, endDate)

    // Does a legacy quarter's startDate fall in this slot's months?
    const legacyMatch = legacy.find(q => {
      const m = q.startDate.getMonth()
      if (qNum === 1) return m >= 0 && m <= 2
      if (qNum === 2) return m >= 3 && m <= 5
      if (qNum === 3) return m >= 6 && m <= 8
      return m >= 9 && m <= 11
    })

    if (legacyMatch) {
      // Upgrade legacy row — preserve all existing goals
      const upgraded = await prisma.quarter.update({
        where: { id: legacyMatch.id },
        data: { year, quarterNumber: qNum, status },
        include: {
          goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' } } } },
        },
      })
      result.push(upgraded)
    } else {
      // Create a new placeholder quarter (no goals yet)
      const created = await prisma.quarter.create({
        data: {
          userId,
          year,
          quarterNumber: qNum,
          name: `Q${qNum} ${year}`,
          startDate,
          endDate,
          status,
        },
        include: {
          goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' } } } },
        },
      })
      result.push(created)
    }
  }

  return result.sort((a, b) => a.quarterNumber - b.quarterNumber)
}
