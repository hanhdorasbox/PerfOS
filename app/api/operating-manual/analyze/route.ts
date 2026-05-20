import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const [goals, weeklyReports, mealPlans, fitnessStrategies, calendarToken] = await Promise.all([
      prisma.goal.findMany({
        where: { userId },
        include: { progressUpdates: true, milestones: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.weeklyReport.findMany({
        where: { userId },
        orderBy: { weekStart: 'desc' },
        take: 20,
      }),
      prisma.mealPlan.findMany({
        where: { userId },
        include: { feedback: true },
        orderBy: { weekStart: 'desc' },
        take: 12,
      }),
      prisma.fitnessStrategy.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.googleCalendarToken.findUnique({ where: { userId } }),
    ])

    // Fetch calendar summary if connected
    let calendarSummary: Record<string, unknown> | null = null
    if (calendarToken?.connectedCalendars) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const summaryRes = await fetch(`${baseUrl}/api/calendar/summary?userId=${userId}&weeks=4`)
        if (summaryRes.ok) {
          const data = await summaryRes.json() as Record<string, unknown>
          if (data.available) calendarSummary = data
        }
      } catch { /* skip if unavailable */ }
    }

    const dataContext = JSON.stringify({
      goals: goals.map(g => ({
        title: g.title,
        category: g.category,
        status: g.status,
        trackingType: g.trackingType,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        progressUpdates: g.progressUpdates.length,
        milestonesCompleted: g.milestones.filter(m => m.completed).length,
        milestonesTotal: g.milestones.length,
      })),
      weeklyReports: weeklyReports.map(r => ({
        weekStart: r.weekStart,
        chiefOfStaffMsg: r.chiefOfStaffMsg,
        slippageRisks: r.slippageRisks,
        antiDriftSection: r.antiDriftSection,
      })),
      mealFeedback: mealPlans.flatMap(m => m.feedback).map(f => ({
        mealTitle: f.mealTitle,
        liked: f.liked,
        notes: f.notes,
      })),
      fitnessStrategies: fitnessStrategies.map(s => ({
        mainObjective: s.mainObjective,
        status: s.status,
        risks: s.risks,
      })),
      ...(calendarSummary && {
        calendarTimeUse: {
          weeksAnalyzed: calendarSummary.weeksAnalyzed,
          totalEvents: calendarSummary.totalEvents,
          avgEventsPerDay: calendarSummary.avgEventsPerDay,
          hoursByCalendarType: calendarSummary.hoursByType,
          hoursByDayOfWeek: calendarSummary.hoursByDow,
          startTimeDistribution: calendarSummary.startHourDistribution,
          recurringEvents: calendarSummary.recurringEvents,
          weeklyHoursTrend: calendarSummary.weeklyHours,
        },
      }),
    })

    const calendarSection = calendarSummary
      ? `\n\nThe user has also connected their Google Calendar (personal + work). The "calendarTimeUse" field contains real data about how they spend their time over the past ${calendarSummary.weeksAnalyzed} weeks: hours by calendar type, which days are heaviest, when they typically start work, recurring events, and weekly trends. Use this data to identify time-use patterns such as: work/life balance, whether deep work time is protected, meeting load, weekend vs weekday patterns, consistency of routines.`
      : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the user's historical performance data and identify concrete behavioral patterns.
Return ONLY valid JSON:
{
  "patterns": [
    {
      "domain": "planning_execution|fitness|meals|learning",
      "pattern": "specific observed pattern description",
      "evidence": "• First supporting data point\n• Second supporting data point\n• Third supporting data point",
      "confidence": 1-5,
      "implication": "• First planning adjustment or action\n• Second planning adjustment or action"
    }
  ]
}

User data:
${dataContext}
${calendarSection}

Identify 5-10 meaningful patterns. Be specific and evidence-based.
If calendar data is present, add a "time_use" domain for patterns about how time is actually spent — include patterns about work/personal balance, meeting density, when productive work happens, routine consistency, and whether time allocation matches stated goals.

IMPORTANT formatting rules:
- "evidence" must be formatted as bullet points, each starting with "• " and separated by "\\n". Minimum 2 bullets, maximum 4.
- "implication" must be formatted as bullet points, each starting with "• " and separated by "\\n". Minimum 1 bullet, maximum 3.
- Do NOT write evidence or implication as a single prose paragraph.

IMPORTANT domain rules:
- Use "planning_execution" for patterns about quarterly planning, weekly execution, goal ambition vs reality, forecasting, or systemic planning behavior
- Use "fitness" for workout, body composition, exercise patterns
- Use "meals" for nutrition, meal planning, protein tracking patterns
- Use "learning" for skill acquisition, study habits, career development learning
- Use "time_use" for patterns derived from calendar data (only if calendar data is available)
Respond ONLY with JSON.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    const savedPatterns = await Promise.all(
      (parsed.patterns || []).map((p: {
        domain: string
        pattern: string
        evidence?: string
        confidence?: number
        implication?: string
      }) =>
        prisma.behaviorPattern.create({
          data: {
            userId,
            domain: p.domain,
            pattern: p.pattern,
            evidence: p.evidence ?? null,
            confidence: typeof p.confidence === 'number' ? Math.min(5, Math.max(1, p.confidence)) : 3,
            implication: p.implication ?? null,
            active: true,
          },
        })
      )
    )

    return NextResponse.json({ patterns: savedPatterns })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
