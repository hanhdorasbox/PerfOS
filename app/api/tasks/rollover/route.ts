import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rolloverIncompleteTasks } from '@/lib/execution-planner'

/**
 * POST /api/tasks/rollover
 *
 * Carries incomplete tasks from the previous active WeeklyPlan into the
 * current one.  Called automatically when a new WeeklyPlan is created,
 * or manually from the weekly review screen.
 *
 * Body: { userId: string, fromPlanId?: string, toPlanId?: string }
 * If fromPlanId/toPlanId are omitted, the two most-recent plans for the
 * user are resolved automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, fromPlanId, toPlanId } = await req.json() as {
      userId: string
      fromPlanId?: string
      toPlanId?: string
    }

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Auto-resolve plans if not provided
    let resolvedFrom = fromPlanId
    let resolvedTo   = toPlanId

    if (!resolvedFrom || !resolvedTo) {
      const quarter = await prisma.quarter.findFirst({
        where: { userId, status: 'active' },
        orderBy: { startDate: 'desc' },
      })
      if (!quarter) return NextResponse.json({ error: 'No active quarter' }, { status: 400 })

      const plans = await prisma.weeklyPlan.findMany({
        where: { quarterId: quarter.id },
        orderBy: { weekStart: 'desc' },
        take: 2,
      })

      if (plans.length < 2) {
        return NextResponse.json({ rolled: 0, dropped: 0, message: 'Not enough plans to roll over' })
      }

      // plans[0] = newest (target), plans[1] = previous (source)
      resolvedTo   = resolvedTo   ?? plans[0].id
      resolvedFrom = resolvedFrom ?? plans[1].id
    }

    const result = await rolloverIncompleteTasks(resolvedFrom, resolvedTo)
    return NextResponse.json({ ...result, fromPlanId: resolvedFrom, toPlanId: resolvedTo })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
