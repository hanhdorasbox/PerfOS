import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress, getQuarterProgress } from '@/lib/calculations'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const [patterns, quarter, fitnessLogs, mealPlans] = await Promise.all([
      prisma.behaviorPattern.findMany({
        where: { userId, active: true },
        orderBy: { confidence: 'desc' },
      }),
      prisma.quarter.findFirst({
        where: { userId, status: 'active' },
        include: {
          goals: {
            include: {
              milestones: true,
              progressUpdates: { orderBy: { loggedAt: 'asc' } },
            },
          },
        },
      }),
      prisma.fitnessLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 8,
      }),
      prisma.mealPlan.findMany({
        where: { userId },
        include: { feedback: true },
        orderBy: { weekStart: 'desc' },
        take: 4,
      }),
    ])

    // Compute goal metrics
    const goalsWithMetrics = (quarter?.goals ?? []).map(goal => {
      let progressPct = 0
      if (goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null && goal.currentValue != null) {
        progressPct = calcQuantitativeProgress(goal.startValue, goal.currentValue, goal.targetValue)
      } else if (goal.trackingType === 'MILESTONE') {
        progressPct = calcMilestoneProgress(goal.milestones)
      }
      const metrics = calcGoalMetrics({
        startDate: quarter!.startDate,
        deadline: goal.deadline,
        progressPct,
        progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
      })
      return { ...goal, progressPct, metrics }
    })

    const qProgress = quarter ? getQuarterProgress(quarter.startDate, quarter.endDate) : null

    const context = {
      today: new Date().toISOString().split('T')[0],
      quarterName: quarter?.name,
      quarterProgress: qProgress ? {
        pctElapsed: Math.round(qProgress.pct),
        daysRemaining: qProgress.daysRemaining,
      } : null,
      goals: goalsWithMetrics.map(g => ({
        title: g.title,
        category: g.category,
        strategicRole: g.strategicRole,
        status: g.metrics.status,
        progressPct: Math.round(g.progressPct),
        expectedPct: Math.round(g.metrics.expectedPct),
        gap: Math.round(g.metrics.gap),
        daysRemaining: Math.round(g.metrics.daysRemaining),
        recommendation: g.metrics.recommendation,
      })),
      behaviorPatterns: patterns.map(p => ({
        domain: p.domain,
        pattern: p.pattern,
        confidence: p.confidence,
        implication: p.implication,
      })),
      fitnessLogs: fitnessLogs.slice(0, 4).map(l => ({
        date: l.date,
        weight: l.weight,
        waist: l.waist,
      })),
      mealPlanCount: mealPlans.length,
      mealFeedbackCount: mealPlans.flatMap(m => m.feedback).length,
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      system: `You are a performance trajectory analyst. Given behavioral patterns and goal data, generate a cross-system trajectory forecast.

Return ONLY valid JSON, no markdown:
{
  "domains": [
    {
      "name": "Fitness|Learning|Meals|Portfolio|Planning",
      "outlook": "2-3 sentence forward-looking assessment of where this domain is headed",
      "risk": "high|medium|low|stable"
    }
  ],
  "overallTrajectory": "2-3 direct sentences synthesizing the overall direction. Be honest and specific about which goals are at risk.",
  "highLeverageInterventions": [
    "Specific actionable intervention — what to change and the expected impact"
  ]
}

Rules:
- domains: include only areas where you have meaningful data (typically 3-5)
- Be direct and data-specific — reference actual goal names, % gaps, patterns
- highLeverageInterventions: 2-4 items, ordered by expected impact, be concrete not vague
- overallTrajectory must be honest — if the current path leads to missed goals, say so directly`,
      messages: [{
        role: 'user',
        content: JSON.stringify(context),
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const data = JSON.parse(match[0])
    return NextResponse.json(data)
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
