import { NextRequest, NextResponse } from 'next/server'
import { planTasks } from '@/lib/execution-planner'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const {
    weeklyPlanId,
    userId,
    title,
    effort,
    goalId,
    priority,
    sourceModule,
    sourceType,
    sourceId,
    createdBy,
    taskType,
    domain,
    description,
    estimatedMinutes,
    scheduledDate,
    doneCriteria,
  } = await req.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  // If a specific weeklyPlanId is supplied (e.g. from WeeklyPlanner), insert directly
  // without going through planTasks (which always targets the current week).
  if (weeklyPlanId) {
    const plan = await prisma.weeklyPlan.findUnique({
      where: { id: weeklyPlanId },
      include: { quarter: { select: { status: true } } },
    })
    if (!plan) return NextResponse.json({ error: 'Weekly plan not found' }, { status: 404 })
    if (plan.quarter.status === 'closed') {
      return NextResponse.json({ error: 'Cannot create tasks in closed quarters' }, { status: 403 })
    }

    // Dedup for direct planId insertion
    const resolvedSourceModule = sourceModule || (goalId ? 'goal' : 'manual')
    const resolvedSourceType   = sourceType   || (goalId ? 'goal_milestone' : 'manual_task')
    if (sourceId) {
      const existing = await prisma.weeklyTask.findFirst({
        where: { weeklyPlanId, sourceModule: resolvedSourceModule, sourceType: resolvedSourceType, sourceId, title },
      })
      if (existing) return NextResponse.json(existing)
    }
    const effortInt   = Number(effort)   || 2
    const priorityInt = Number(priority) || 2
    const task = await prisma.weeklyTask.create({
      data: {
        weeklyPlanId,
        title,
        description:      description ?? null,
        effort:           effortInt,
        priority:         priorityInt,
        goalId:           goalId || null,
        taskType:         taskType || null,
        domain:           domain || null,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        scheduledDate:    scheduledDate ? new Date(scheduledDate) : null,
        doneCriteria:     doneCriteria ?? null,
        status:           'planned',
        completed:        false,
        sourceModule:     resolvedSourceModule,
        sourceType:       resolvedSourceType,
        sourceId:         sourceId || goalId || null,
        createdBy:        createdBy || 'user',
      },
    })
    return NextResponse.json(task)
  }

  // Otherwise route through ExecutionPlanner (auto-finds/creates WeeklyPlan)
  if (!userId) {
    return NextResponse.json({ error: 'weeklyPlanId or userId required' }, { status: 400 })
  }

  const effortLabel   = effort   === 1 || effort === '1' ? 'low'  : effort   === 3 || effort   === '3' ? 'deep'  : 'medium'
  const priorityLabel = priority === 1 || priority === '1' ? 'must' : priority === 3 || priority === '3' ? 'optional' : 'should'

  try {
    const result = await planTasks(userId, [{
      title,
      description:       description ?? undefined,
      domain:            domain ?? (taskType === 'workout' ? 'fitness' : taskType === 'study' ? 'learning' : undefined),
      taskType:          taskType ?? undefined,
      priority:          priorityLabel,
      effort:            effortLabel,
      estimatedMinutes:  estimatedMinutes ? Number(estimatedMinutes) : undefined,
      scheduledDate:     scheduledDate ? new Date(scheduledDate) : undefined,
      doneCriteria:      doneCriteria ?? undefined,
      sourceModule:      sourceModule || (goalId ? 'goal' : 'manual'),
      sourceType:        sourceType   || (goalId ? 'goal_milestone' : 'manual_task'),
      sourceId:          sourceId || goalId || undefined,
      linkedGoalId:      goalId || undefined,
      createdBy:         (createdBy as 'user' | 'ai' | 'system') || 'user',
    }])

    if (result.taskIds.length === 0) {
      return NextResponse.json({ error: 'Could not create task' }, { status: 400 })
    }

    const task = await prisma.weeklyTask.findUnique({ where: { id: result.taskIds[0] } })
    return NextResponse.json(task)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
