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
      tools: [{
        name: 'create_quarter_plan',
        description: 'Create a quarterly career focus plan with priorities, key output and high-upside bet',
        input_schema: {
          type: 'object' as const,
          properties: {
            priorities:    { type: 'array', items: { type: 'string' }, description: '3 specific quarterly priorities' },
            keyOutput:     { type: 'string', description: 'The single most important deliverable to ship this quarter' },
            highUpsideBet: { type: 'string', description: 'The asymmetric opportunity — high risk but big career payoff' },
          },
          required: ['priorities', 'keyOutput', 'highUpsideBet'],
        },
      }],
      tool_choice: { type: 'tool', name: 'create_quarter_plan' },
      messages: [{
        role: 'user',
        content: `Create a quarterly career plan for someone targeting ${trajectory.targetRoleTitle || trajectory.targetPath}.

Current Role: ${trajectory.currentRole}
Time Horizon: ${trajectory.timeHorizon || 'Not specified'}

Open Gaps (by priority):
${trajectory.gaps.map(g => `- [${g.gapType}] ${g.title} (priority ${g.priority})`).join('\n') || 'None'}

Active Quarter Goals:
${goals.map(g => `- ${g.title} (${g.category})`).join('\n') || 'None'}

Be specific, direct, and actionable.`,
      }],
    })

    const toolBlock = response.content.find(c => c.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('AI returned no structured data — try again')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = toolBlock.input as { priorities?: string[]; keyOutput?: string; highUpsideBet?: string }

    const plan = await prisma.trajectoryQuarterPlan.create({
      data: {
        trajectoryId,
        quarterId: quarterId ?? null,
        priorities:    JSON.stringify(parsed.priorities ?? []),
        keyOutput:     parsed.keyOutput ?? null,
        highUpsideBet: parsed.highUpsideBet ?? null,
      },
    })

    return NextResponse.json({ plan })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
