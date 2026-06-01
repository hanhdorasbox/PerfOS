import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planTasks } from '@/lib/execution-planner'

interface TaskInput {
  title: string
  timeframe?: string
  output?: string
  priority?: 1 | 2 | 3
  actionId?: string   // TrajectoryGapAction.id if already normalized
}

/**
 * POST /api/career/trajectory/gaps/[id]/add-tasks
 *
 * 1. If TrajectoryGapAction records exist for this gap, converts them to tasks
 *    using their IDs as sourceId (precise linking).
 * 2. If no actions exist yet (legacy JSON only), auto-normalizes the JSON
 *    actionPlan into TrajectoryGapAction records first, then creates tasks.
 * 3. Uses ExecutionPlanner for dedup and plan management.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gapId } = await params
  try {
    const { userId, tasks } = await req.json() as { userId: string; tasks: TaskInput[] }
    if (!userId || !tasks?.length) {
      return NextResponse.json({ error: 'userId and tasks required' }, { status: 400 })
    }

    // Ensure TrajectoryGapActions exist for each submitted task (normalize if needed)
    const normalizedActionIds: Map<string, string> = new Map() // title → gapActionId

    const existingActions = await prisma.trajectoryGapAction.findMany({
      where: { gapId },
      orderBy: { orderIndex: 'asc' },
    })

    for (const [i, t] of tasks.entries()) {
      if (t.actionId) {
        normalizedActionIds.set(t.title, t.actionId)
        continue
      }

      // Find or create a TrajectoryGapAction for this step
      const existing = existingActions.find(a => a.title === t.title)
      if (existing) {
        normalizedActionIds.set(t.title, existing.id)
      } else {
        const action = await prisma.trajectoryGapAction.create({
          data: {
            gapId,
            title: t.title,
            output: t.timeframe ?? null,
            timeframe: t.timeframe ?? null,
            priority: t.priority ?? (i < 2 ? 1 : 2),
            orderIndex: existingActions.length + i,
          },
        })
        normalizedActionIds.set(t.title, action.id)
      }
    }

    // Build TaskCandidates for ExecutionPlanner
    const candidates = tasks
      .filter(t => t.title?.trim())
      .map((t, i) => ({
        title: t.title,
        domain: 'career' as const,
        taskType: 'project' as const,
        priority: (t.priority === 1 || i < 2 ? 'must' : t.priority === 3 ? 'optional' : 'should') as 'must' | 'should' | 'optional',
        effort: 'medium' as const,
        sourceModule: 'career',
        sourceType: 'career_gap_action',
        sourceId: normalizedActionIds.get(t.title),
        createdBy: 'user' as const,
      }))

    const result = await planTasks(userId, candidates)
    return NextResponse.json({ created: result.created, skipped: result.skipped, planId: result.planId })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
