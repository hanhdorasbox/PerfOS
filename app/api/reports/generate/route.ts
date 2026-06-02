import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { getWeekBounds } from '@/lib/quarters'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId } = body

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)

  const { monday: weekStart, sunday: weekEnd } = getWeekBounds()

  // Fetch all data
  const [quarter, workoutLogs, proteinLogs, workItems, careerItems] = await Promise.all([
    prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      include: {
        goals: {
          include: {
            progressUpdates: {
              where: { loggedAt: { gte: sevenDaysAgo } },
              orderBy: { loggedAt: 'desc' },
            },
            milestones: true,
          }
        }
      }
    }),
    prisma.workoutLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' } }),
    prisma.proteinLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' } }),
    prisma.workItem.findMany({ where: { userId, completedAt: { gte: sevenDaysAgo } }, orderBy: { completedAt: 'desc' } }),
    prisma.careerCapitalItem.findMany({ where: { userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' } }),
  ])

  if (!quarter) return NextResponse.json({ error: 'No active quarter' }, { status: 400 })

  // Calculate expected progress for each goal
  const totalDays = (quarter.endDate.getTime() - quarter.startDate.getTime()) / 86400000
  const daysElapsed = (now.getTime() - quarter.startDate.getTime()) / 86400000
  const expectedQtrPct = Math.min(100, Math.round((daysElapsed / totalDays) * 100))

  const goalData = quarter.goals.map(g => {
    let currentPct = 0
    if (g.trackingType === 'QUANTITATIVE' && g.startValue != null && g.targetValue != null && g.currentValue != null) {
      const range = g.targetValue - g.startValue
      currentPct = range !== 0 ? Math.min(100, Math.max(0, Math.round(((g.currentValue - g.startValue) / range) * 100))) : 0
    } else if (g.trackingType === 'MILESTONE') {
      const total = g.milestones.length || 1
      const done = g.milestones.filter(m => m.completed).length
      currentPct = Math.round((done / total) * 100)
    }
    const weekUpdates = g.progressUpdates
    const weekDelta = weekUpdates.length > 0
      ? weekUpdates[0].value - (weekUpdates[weekUpdates.length - 1]?.value ?? weekUpdates[0].value)
      : 0

    return {
      goalId: g.id,
      title: g.title,
      category: g.category,
      currentPct,
      expectedPct: expectedQtrPct,
      gap: currentPct - expectedQtrPct,
      weekDelta,
      recentUpdates: weekUpdates.map(u => `${u.loggedAt.toISOString().slice(0,10)}: ${u.value} ${g.unit || ''}${u.note ? ' — ' + u.note : ''}`),
    }
  })

  const avgProtein = proteinLogs.length > 0
    ? Math.round(proteinLogs.reduce((s, p) => s + p.amount, 0) / proteinLogs.length)
    : 0
  const workItemSummary = workItems.slice(0, 20).map(w => `[${w.category}] ${w.title}`)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: `You are a personal chief of staff — direct, analytical, no fluff. Generate an executive performance briefing. Return ONLY valid JSON with this exact structure (no markdown, no prose paragraphs — everything as arrays of short bullet strings):
{
  "executiveSummary": ["3–4 bullet strings: headline result, quarter impact, key observation"],
  "strategicStrength": "strong|neutral|weak",
  "goalBreakdown": [{
    "goalId": "string",
    "title": "string",
    "plannedPct": number,
    "actualPct": number,
    "delta": number,
    "overallPct": number,
    "status": "ahead|on_track|watch|at_risk|critical",
    "forecastNote": "string — max 10 words"
  }],
  "strategicWins": ["string — max 12 words each"],
  "slippageRisks": [{"goal": "string", "issue": "string — max 15 words", "recoverable": boolean, "pattern": "string|null"}],
  "fitnessSection": ["2–3 bullet strings about this week's fitness"],
  "careerSection": ["2–3 bullet strings about career capital built"],
  "antiDriftNote": ["1–2 bullet strings on drift pattern"],
  "nextWeekRec": ["3–5 concrete action bullets for next week"],
  "chiefOfStaffMsg": "string — 1 direct sentence, not cheesy"
}`,
    messages: [{
      role: 'user',
      content: `Quarter: ${quarter.name} (${quarter.startDate.toISOString().slice(0,10)} to ${quarter.endDate.toISOString().slice(0,10)})
Week: ${weekStart.toISOString().slice(0,10)} to ${weekEnd.toISOString().slice(0,10)}
Quarter progress: ${expectedQtrPct}% time elapsed

Goals this week:
${JSON.stringify(goalData, null, 2)}

Workouts this week: ${workoutLogs.length} sessions
Types: ${workoutLogs.map(w => w.type).join(', ') || 'none'}
Avg daily protein: ${avgProtein}g

Work items logged this week:
${workItemSummary.join('\n') || 'none'}

Career capital items this week:
${careerItems.slice(0, 10).map(c => `[${c.category}/${c.type}] ${c.title}`).join('\n') || 'none'}

Generate the weekly executive briefing.`
    }]
  })

  const text = (response.content[0] as any).text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })
  const parsed = JSON.parse(match[0])

  const report = await prisma.weeklyReport.create({
    data: {
      userId,
      weekStart,
      weekEnd,
      executiveSummary: parsed.executiveSummary,
      goalBreakdown: JSON.stringify(parsed.goalBreakdown || []),
      strategicWins: JSON.stringify(parsed.strategicWins || []),
      slippageRisks: JSON.stringify(parsed.slippageRisks || []),
      fitnessSection: parsed.fitnessSection,
      careerSection: parsed.careerSection,
      antiDriftSection: parsed.antiDriftNote,
      nextWeekRec: parsed.nextWeekRec,
      chiefOfStaffMsg: parsed.chiefOfStaffMsg,
    },
  })

  return NextResponse.json(report)
}
