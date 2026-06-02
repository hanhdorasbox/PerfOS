import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { planTasks, TaskCandidate } from '@/lib/execution-planner'
import { jsonrepair } from 'jsonrepair'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId: string }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const quarter = await prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      include: {
        goals: {
          include: {
            milestones: { where: { completed: false }, take: 3 },
            progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 2 },
          },
        },
      },
    })

    if (!quarter) return NextResponse.json({ error: 'No active quarter' }, { status: 400 })

    const qProgress = (() => {
      const start = new Date(quarter.startDate)
      const end = new Date(quarter.endDate)
      const now = new Date()
      const total = end.getTime() - start.getTime()
      const elapsed = now.getTime() - start.getTime()
      return Math.round(Math.min(100, Math.max(0, (elapsed / total) * 100)))
    })()

    const goalsContext = quarter.goals.map((g: typeof quarter.goals[number]) => {
      const nextMilestones = g.milestones.map((m: typeof g.milestones[number]) => m.title).join(', ')
      const progress = g.trackingType === 'MILESTONE'
        ? `${g.milestones.filter((m: typeof g.milestones[number]) => m.completed).length}/${g.milestones.length} milestones done`
        : `current: ${g.currentValue ?? 'unknown'}, target: ${g.targetValue}`
      return `Goal: "${g.title}" | Progress: ${progress}${nextMilestones ? ` | Next milestones: ${nextMilestones}` : ''}`
    }).join('\n')

    const client = createAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a weekly planning assistant. Generate 5-7 concrete weekly tasks based on these quarterly goals.

Quarter: ${quarter.name} (${qProgress}% elapsed)
Goals:
${goalsContext}

Return ONLY a JSON array of tasks with this exact shape:
[
  {
    "title": "Specific action (English, max 80 chars)",
    "priority": "must" | "should" | "optional",
    "effort": "low" | "medium" | "deep",
    "estimatedMinutes": number,
    "goalTitle": "matching goal title or null"
  }
]

Rules:
- 1-2 must tasks (highest impact this week)
- 2-3 should tasks
- 0-2 optional tasks
- Tasks should be specific and actionable, not vague
- Estimate realistic minutes: low=15, medium=30, deep=60-90
- Write task titles in English`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]'
    const items = JSON.parse(jsonrepair(jsonStr)) as Array<{
      title: string
      priority: 'must' | 'should' | 'optional'
      effort: 'low' | 'medium' | 'deep'
      estimatedMinutes: number
      goalTitle: string | null
    }>

    const goalMap = new Map(quarter.goals.map(g => [g.title.toLowerCase(), g.id]))

    const candidates: TaskCandidate[] = items.map(item => {
      const matchedGoalId: string | undefined = item.goalTitle
        ? goalMap.get(item.goalTitle.toLowerCase())
        : undefined

      const candidate: TaskCandidate = {
        title: item.title,
        priority: item.priority,
        effort: item.effort,
        estimatedMinutes: item.estimatedMinutes,
        sourceModule: 'manual',
        sourceType: 'auto_generated',
        createdBy: 'ai',
      }
      if (matchedGoalId) candidate.linkedGoalId = matchedGoalId
      return candidate
    })

    const result = await planTasks(userId, candidates)
    return NextResponse.json({ created: result.created, skipped: result.skipped, planId: result.planId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
