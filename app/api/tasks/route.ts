import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  const { weeklyPlanId, userId, title, effort, goalId, priority, sourceModule, sourceId, createdBy, taskType } = await req.json()

  let planId = weeklyPlanId as string | undefined

  // Auto-find or create the current week's WeeklyPlan when no planId provided
  if (!planId) {
    if (!userId) {
      return NextResponse.json({ error: 'weeklyPlanId or userId required' }, { status: 400 })
    }

    const quarter = await prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startDate: 'desc' },
    })
    if (!quarter) {
      return NextResponse.json({ error: 'No active quarter — create one first at /quarterly' }, { status: 400 })
    }

    const { monday, sunday } = getWeekBounds()

    // Find an existing active plan whose weekStart falls in this week
    let plan = await prisma.weeklyPlan.findFirst({
      where: {
        quarterId: quarter.id,
        status: 'active',
        weekStart: { gte: monday, lte: sunday },
      },
    })

    // Nothing found — create one
    if (!plan) {
      plan = await prisma.weeklyPlan.create({
        data: { quarterId: quarter.id, weekStart: monday, weekEnd: sunday, status: 'active' },
      })
    }

    planId = plan.id
  }

  // Dedup: if sourceId is given, return existing task in this plan instead of creating a duplicate.
  // Include title in the check so multiple tasks from the same source (e.g. different gap steps
  // all sharing the same gapId) are treated as distinct.
  if (sourceId) {
    const existing = await prisma.weeklyTask.findFirst({
      where: { weeklyPlanId: planId, sourceModule: sourceModule ?? null, sourceId, title },
    })
    if (existing) return NextResponse.json(existing)
  }

  const task = await prisma.weeklyTask.create({
    data: {
      weeklyPlanId: planId,
      title,
      effort: Number(effort) || 2,
      priority: Number(priority) || 2,
      goalId: goalId || null,
      completed: false,
      taskType: taskType || null,
      sourceModule: sourceModule || (goalId ? 'goal' : null),
      sourceId: sourceId || goalId || null,
      createdBy: createdBy || 'user',
    },
  })
  return NextResponse.json(task)
}
