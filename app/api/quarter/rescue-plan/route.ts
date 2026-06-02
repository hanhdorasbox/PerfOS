import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { gap, weeksRemaining, quarterName } = await req.json() as {
      gap: number
      weeksRemaining: number
      quarterName: string
    }

    const user = await prisma.user.findFirst()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })

    const quarter = await prisma.quarter.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        goals: {
          include: {
            milestones: true,
            progressUpdates: { orderBy: { loggedAt: 'desc' }, take: 3 },
          },
        },
      },
    })

    const goalsContext = quarter?.goals.map((g: typeof quarter.goals[number]) => {
      const milestonesDone = g.milestones.filter((m: typeof g.milestones[number]) => m.completed).length
      const milestonesTotal = g.milestones.length
      return `- ${g.title} (${g.trackingType === 'MILESTONE' ? `${milestonesDone}/${milestonesTotal} milestones` : `current: ${g.currentValue ?? 'no data'}, target: ${g.targetValue}`})`
    }).join('\n') ?? 'No goals data'

    const weeklyNeeded = weeksRemaining > 0 ? Math.ceil(Math.abs(gap) / weeksRemaining) : Math.abs(gap)

    const client = createAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a strategic advisor. The user is behind on their quarterly goals in ${quarterName}.

Progress gap: ${Math.abs(Math.round(gap))}% behind schedule
Weeks remaining: ${weeksRemaining}
Weekly progress needed to catch up: ~${weeklyNeeded}%/week

Current goals:
${goalsContext}

Write a concise rescue sprint plan in Czech. Format it as:
1. A one-sentence framing of the situation
2. 3-4 specific weekly action priorities (one per bullet, concrete and actionable)
3. One thing to STOP doing to free up time

Be direct, practical, no fluff. Max 150 words.`,
      }],
    })

    const plan = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ plan })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
