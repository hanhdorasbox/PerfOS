/**
 * Quarter utilities — date-derived status and year-based get-or-create.
 *
 * year and quarterNumber are DERIVED from startDate — not stored in DB.
 * This avoids any need for schema migrations on the Quarter table.
 */

import { prisma } from './db'

export type QuarterStatus = 'planned' | 'active' | 'closed'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function quarterDates(year: number, qNum: 1 | 2 | 3 | 4): { startDate: Date; endDate: Date } {
  const starts = [0, 3, 6, 9]
  const ends   = [2, 5, 8, 11]
  return {
    startDate: new Date(year, starts[qNum - 1], 1, 0, 0, 0, 0),
    endDate:   new Date(year, ends[qNum - 1] + 1, 0, 23, 59, 59, 999),
  }
}

/** Derive quarter number (1-4) from a date's month */
function qNumFromDate(d: Date): 1 | 2 | 3 | 4 {
  const m = d.getMonth()
  if (m < 3) return 1
  if (m < 6) return 2
  if (m < 9) return 3
  return 4
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

/** Get Monday-Sunday bounds for the week containing the given date (or now if not provided) */
export function getWeekBounds(date: Date = new Date()): { monday: Date; sunday: Date } {
  const dow = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

// ─── Status sync ──────────────────────────────────────────────────────────────

export async function ensureQuarterStatuses(userId: string): Promise<void> {
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

/** Quarter row augmented with derived year + quarterNumber */
export type QuarterRow = Awaited<ReturnType<typeof prisma.quarter.findFirst>> & {
  year: number
  quarterNumber: number
}

/**
 * Return all 4 quarters for a given year.
 * year and quarterNumber are derived from startDate — never read from DB columns.
 * Creates missing placeholder quarters as needed.
 */
type QuarterWithGoals = Awaited<ReturnType<typeof prisma.quarter.findFirst<{
  include: { goals: { include: { milestones: true; progressUpdates: true } } }
}>>>

export async function getOrCreateYearQuarters(
  userId: string,
  year: number,
): Promise<(NonNullable<QuarterWithGoals> & { year: number; quarterNumber: number })[]> {
  await ensureQuarterStatuses(userId)

  // Fetch all quarters for this user whose startDate falls in this year
  const allRows = await prisma.quarter.findMany({
    where: {
      userId,
      startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
    include: {
      goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' }, take: 50 } } },
    },
  })

  // Tag each row with derived year + quarterNumber
  const tagged = allRows.map(q => ({
    ...q,
    year,
    quarterNumber: qNumFromDate(q.startDate) as number,
  }))

  const existingNums = new Set(tagged.map(q => q.quarterNumber))

  // Create missing quarters
  for (let qNum = 1; qNum <= 4; qNum++) {
    if (existingNums.has(qNum)) continue
    const { startDate, endDate } = quarterDates(year, qNum as 1 | 2 | 3 | 4)
    const status = deriveStatus(startDate, endDate)
    const created = await prisma.quarter.create({
      data: { userId, name: `Q${qNum} ${year}`, startDate, endDate, status },
      include: {
        goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'asc' }, take: 50 } } },
      },
    })
    tagged.push({ ...created, year, quarterNumber: qNum })
  }

  return tagged.sort((a, b) => a.quarterNumber - b.quarterNumber)
}
