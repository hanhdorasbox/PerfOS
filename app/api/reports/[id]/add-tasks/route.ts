import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface TaskInput {
  title: string
  why?: string
  day?: string
  priority?: 1 | 2 | 3
}

function getWeekBounds() {
  const now = new Date()
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

/**
 * POST /api/reports/[id]/add-tasks
 *
 * Converts AI-generated nextWeekTasks from a WeeklyReport into actual
 * WeeklyTasks in the current active plan.
 *
 * Body: { userId: string, tasks: TaskInput[] }
 * Returns: { created: number, skipped: number, planId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params
  try {
    const { userId, tasks } = await req.json() as { userId: string; tasks: TaskInput[] }
    if (!userId || !tasks?.length) {
      return NextResponse.json({ error: 'userId and tasks required' }, { status: 400 })
    }

    // Verify report exists and belongs to user
    const report = await prisma.weeklyReport.findFirst({
      where: { id: reportId, userId },
    })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // Find or create the current week's WeeklyPlan
    const quarter = await prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startDate: 'desc' },
    })
    if (!quarter) {
      return NextResponse.json({ error: 'No active quarter — create one at /quarterly' }, { status: 400 })
    }

    const { monday, sunday } = getWeekBounds()
    let plan = await prisma.weeklyPlan.findFirst({
      where: { quarterId: quarter.id, status: 'active', weekStart: { gte: monday, lte: sunday } },
    })
    if (!plan) {
      plan = await prisma.weeklyPlan.create({
        data: { quarterId: quarter.id, weekStart: monday, weekEnd: sunday, status: 'active' },
      })
    }

    let created = 0
    let skipped = 0

    for (const [i, task] of tasks.entries()) {
      if (!task.title?.trim()) continue

      // Dedup: skip if same title + sourceId already in this plan
      const existing = await prisma.weeklyTask.findFirst({
        where: { weeklyPlanId: plan.id, sourceModule: 'report', sourceId: reportId, title: task.title },
      })
      if (existing) { skipped++; continue }

      // First 2 tasks → must (1), rest → should (2)
      const priority = task.priority ?? (i < 2 ? 1 : 2)

      await prisma.weeklyTask.create({
        data: {
          weeklyPlanId: plan.id,
          title: task.title,
          effort: 2,
          priority,
          taskType: 'other',
          sourceModule: 'report',
          sourceId: reportId,
          createdBy: 'ai',
        },
      })
      created++
    }

    return NextResponse.json({ created, skipped, planId: plan.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
