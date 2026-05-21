import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { trajectoryId, quarterId } = await req.json()
    if (!trajectoryId) return NextResponse.json({ error: 'trajectoryId required' }, { status: 400 })

    const trajectory = await prisma.careerTrajectory.findUnique({
      where: { id: trajectoryId },
      include: {
        gaps: { where: { closed: false }, orderBy: { priority: 'asc' } },
      },
    })
    if (!trajectory) return NextResponse.json({ error: 'Trajectory not found' }, { status: 404 })

    let goals: { title: string; category: string; status: string }[] = []
    if (quarterId) {
      goals = await prisma.goal.findMany({
        where: { quarterId },
        select: { title: true, category: true, status: true },
      })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Create a quarterly career plan for someone targeting ${trajectory.targetRoleTitle || trajectory.targetPath}.

Current Role: ${trajectory.currentRole}
Time Horizon: ${trajectory.timeHorizon || 'Not specified'}

Open Gaps (by priority):
${trajectory.gaps.map(g => `- [${g.gapType}] ${g.title} (priority ${g.priority})`).join('\n')}

Active Quarter Goals:
${goals.map(g => `- ${g.title} (${g.category})`).join('\n') || 'None'}

Return ONLY valid JSON:
{
  "priorities": ["priority 1", "priority 2", "priority 3"],
  "keyOutput": "the one most important thing to ship/produce this quarter that advances the trajectory",
  "highUpsideBet": "the asymmetric opportunity this quarter — high risk but big career payoff"
}

Be specific, direct, and actionable. Respond ONLY with JSON.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    const plan = await prisma.trajectoryQuarterPlan.create({
      data: {
        trajectoryId,
        quarterId: quarterId ?? null,
        priorities: JSON.stringify(parsed.priorities || []),
        keyOutput: parsed.keyOutput ?? null,
        highUpsideBet: parsed.highUpsideBet ?? null,
      },
    })

    return NextResponse.json({ plan })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
