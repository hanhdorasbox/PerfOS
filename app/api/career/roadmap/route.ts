import { NextRequest, NextResponse } from 'next/server'
import { createAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/db'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const { goal, timeframe, context, userId } = await req.json()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: `You are a strategic career and performance advisor. Generate detailed, practical goal roadmaps.`,
    tools: [{
      name: 'create_roadmap',
      description: 'Create a structured goal roadmap',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string', description: '2-3 sentences' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                duration: { type: 'string', description: 'e.g. Month 1-2' },
                focus: { type: 'string' },
                milestones: { type: 'array', items: { type: 'string' } },
                weeklyTasks: { type: 'array', items: { type: 'string' } },
                resources: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'duration', 'focus', 'milestones', 'weeklyTasks', 'resources'],
            },
          },
        },
        required: ['title', 'summary', 'phases'],
      },
    }],
    tool_choice: { type: 'tool', name: 'create_roadmap' },
    messages: [{
      role: 'user',
      content: `Goal: ${goal}\nTimeframe: ${timeframe}${context ? `\nContext: ${context}` : ''}\n\nRules:\n- 3-4 phases for timeframes under 6 months, 4-5 phases for longer\n- Each phase: 2-3 milestones, 3-4 weekly tasks, 2-3 resources\n- Be concrete and specific — real tools, real deliverables`,
    }],
  })

  const toolBlock = response.content.find(c => c.type === 'tool_use')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return NextResponse.json({ error: 'AI returned no structured data — try again' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roadmap = toolBlock.input as any

  // Save to DB if userId provided
  if (userId) {
    try {
      const saved = await prisma.careerRoadmap.create({
        data: {
          userId,
          goal,
          timeframe: timeframe || null,
          context: context || null,
          roadmap: JSON.stringify(roadmap),
        },
      })
      return NextResponse.json({ ...roadmap, id: saved.id })
    } catch {
      // If DB save fails, still return the roadmap
    }
  }

  return NextResponse.json(roadmap)
}
