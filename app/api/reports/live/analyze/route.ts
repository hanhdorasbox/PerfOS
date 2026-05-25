import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import type { WeekLiveData } from '../route'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { reportId, userId } = await req.json()
    if (!reportId || !userId) return NextResponse.json({ error: 'reportId and userId required' }, { status: 400 })

    const report = await prisma.weeklyReport.findUnique({ where: { id: reportId } })
    if (!report || !report.liveData) return NextResponse.json({ error: 'Report not found or has no data' }, { status: 404 })

    const data = JSON.parse(report.liveData) as WeekLiveData

    const prompt = `You are a direct personal Chief of Staff. Analyze this weekly performance data and return structured JSON.

WEEK DATA:
- Week progress: ${data.weekProgress}% (${data.daysLeft} days left)
- Overall status: ${data.snapshot.status}
- Current wins: ${data.snapshot.wins.join('; ') || 'none'}
- Current risks: ${data.snapshot.risks.join('; ') || 'none'}

GOALS (${data.goals.length}):
${data.goals.map(g => `- ${g.title}: ${g.currentPct}% (expected ${g.expectedPct}%, gap ${g.gap > 0 ? '+' : ''}${g.gap}%, status: ${g.status})`).join('\n') || '- No active goals'}

TASKS:
${data.tasks ? `- Completed ${data.tasks.completed}/${data.tasks.planned} (${data.tasks.rate}%)
- Priority-1: ${data.tasks.p1Completed}/${data.tasks.p1Planned} (${data.tasks.p1Rate}%)
- Missed: ${data.tasks.missed}` : '- No task data'}

FITNESS: ${data.fitness.workoutsThisWeek}/3 workouts (${data.fitness.types.join(', ') || 'none'})${data.fitness.proteinAvg ? `, avg protein ${data.fitness.proteinAvg}g` : ''}

LEARNING (${data.learning.length} roadmaps):
${data.learning.map(g => `- ${g.title}: ${g.stepsCompleted}/${g.stepsTotal} steps, ${g.weekStepsCompleted} this week, status: ${g.healthStatus}`).join('\n') || '- None'}

ANTI-DRIFT: Advancement ${data.antiDrift.advancementPct}% | Maintenance ${data.antiDrift.maintenancePct}% | Reactive ${data.antiDrift.reactivePct}% | Busywork ${data.antiDrift.busyworkPct}%

DOMAINS:
${data.domains.map(d => `- ${d.name}: ${d.status}`).join('\n')}

FORECAST:
${data.forecast.map(f => `- ${f.title}: ${f.status}${f.daysLate > 0 ? `, ${f.daysLate} days late at current pace` : ''}`).join('\n') || '- No forecast data'}

Return ONLY valid JSON (no markdown, no explanation):
{
  "executiveBullets": ["3-4 direct bullets: what this week meant strategically"],
  "taskPatterns": ["2-3 patterns observed in task execution this week"],
  "nextWeekPriorities": ["top 3 priorities for next week, specific"],
  "nextWeekTasks": [
    { "title": "Specific task (max 8 words)", "why": "short reason", "day": "Monday|Tuesday|...|flexible" }
  ],
  "toDrop": ["1-2 things to drop or defer next week"],
  "systemAdjustments": ["3-5 concrete adjustments to the planning system based on this week"],
  "chiefMsg": "One direct sentence — what this week tells you about your trajectory"
}

Rules: max 5 nextWeekTasks, specific numbers, no vague advice, no cheerleading.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: 'You are a direct Chief of Staff. Return ONLY valid JSON. No markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })

    const aiResult = JSON.parse(match[0])
    const ai = { generatedAt: new Date().toISOString(), ...aiResult }

    // Merge into existing liveData
    const updatedData: WeekLiveData = { ...data, ai }
    const updated = await prisma.weeklyReport.update({
      where: { id: reportId },
      data: { liveData: JSON.stringify(updatedData) },
    })

    return NextResponse.json({ ok: true, ai, report: updated })
  } catch (e) {
    console.error('[POST /api/reports/live/analyze]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
