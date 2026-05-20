import { prisma } from '@/lib/db'
import { askAdvisor } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress } from '@/lib/calculations'

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()
    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

    const quarter = await prisma.quarter.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { goals: { include: { milestones: true, progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 5 } } } }
    })

    const dashboardData = quarter ? {
      quarter: { name: quarter.name, startDate: quarter.startDate, endDate: quarter.endDate },
      goals: quarter.goals.map(g => {
        let progressPct = 0
        if (g.trackingType === 'QUANTITATIVE' && g.startValue != null && g.targetValue != null && g.currentValue != null) {
          progressPct = calcQuantitativeProgress(g.startValue, g.currentValue, g.targetValue)
        } else if (g.trackingType === 'MILESTONE') {
          progressPct = calcMilestoneProgress(g.milestones)
        }
        const metrics = calcGoalMetrics({ startDate: quarter.startDate, deadline: g.deadline, progressPct })
        return { title: g.title, category: g.category, progressPct: Math.round(progressPct), expectedPct: Math.round(metrics.expectedPct), gap: Math.round(metrics.gap), status: metrics.status, forecastedCompletion: metrics.forecastedCompletionDate, deadline: g.deadline }
      })
    } : {}

    const answer = await askAdvisor(question, dashboardData)
    return NextResponse.json({ answer })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
