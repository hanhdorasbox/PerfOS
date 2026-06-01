import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planTasks } from '@/lib/execution-planner'

interface TaskInput {
  title: string
  why?: string
  day?: string
  priority?: 1 | 2 | 3
  recommendationId?: string  // ReportRecommendation.id if already exists
}

/**
 * POST /api/reports/[id]/add-tasks
 *
 * 1. For each task, ensures a ReportRecommendation record exists (creates if needed).
 * 2. Creates WeeklyTasks via ExecutionPlanner using ReportRecommendation.id as sourceId.
 * 3. Marks recommendations as converted_to_task.
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

    // Verify report belongs to user
    const report = await prisma.weeklyReport.findFirst({ where: { id: reportId, userId } })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // Ensure ReportRecommendation records exist for each task
    const recIds: Map<string, string> = new Map() // title → recommendationId

    const existingRecs = await prisma.reportRecommendation.findMany({ where: { reportId } })

    for (const [i, t] of tasks.entries()) {
      if (t.recommendationId) {
        recIds.set(t.title, t.recommendationId)
        continue
      }

      const existing = existingRecs.find(r => r.title === t.title)
      if (existing) {
        recIds.set(t.title, existing.id)
      } else {
        const rec = await prisma.reportRecommendation.create({
          data: {
            reportId,
            title: t.title,
            reason: t.why ?? null,
            suggestedDay: t.day ?? null,
            priority: t.priority ?? (i < 2 ? 1 : 2),
            status: 'proposed',
          },
        })
        recIds.set(t.title, rec.id)
      }
    }

    // Build TaskCandidates
    const candidates = tasks
      .filter(t => t.title?.trim())
      .map((t, i) => ({
        title: t.title,
        domain: undefined,
        taskType: undefined,
        priority: (t.priority === 1 || i < 2 ? 'must' : t.priority === 3 ? 'optional' : 'should') as 'must' | 'should' | 'optional',
        effort: 'medium' as const,
        sourceModule: 'report',
        sourceType: 'report_recommendation',
        sourceId: recIds.get(t.title),
        createdBy: 'ai' as const,
      }))

    const result = await planTasks(userId, candidates)

    // Mark recommendations as converted_to_task
    for (const [title, recId] of recIds.entries()) {
      const taskId = result.taskIds[tasks.findIndex(t => t.title === title)]
      if (taskId) {
        await prisma.reportRecommendation.update({
          where: { id: recId },
          data: { status: 'converted_to_task', convertedTaskId: taskId },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ created: result.created, skipped: result.skipped, planId: result.planId })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
