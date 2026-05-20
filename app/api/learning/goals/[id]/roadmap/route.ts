import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const goal = await prisma.capabilityGoal.findUnique({ where: { id } })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Create a practical learning roadmap for this capability goal.

Goal: ${goal.title}
Capability: ${goal.capabilityStatement}
Why it matters: ${goal.whyItMatters || 'Not specified'}
Starting level: ${goal.startingLevel}/5
Target level: ${goal.targetLevel}/5
Evidence of mastery: ${goal.evidenceOfMastery || 'Not specified'}
Final output: ${goal.finalOutput || 'Not specified'}

Return ONLY valid JSON:
{
  "milestones": [
    {"title": "...", "type": "knowledge|practice|output"},
    ...
  ]
}

Rules:
- 5-8 milestones total
- Must include AT LEAST 1 "output" milestone (something tangible you produce/build)
- Mix of knowledge (concepts/study), practice (doing exercises/applying), output (creating deliverables)
- Order from foundational to advanced
- Be specific and actionable
- Respond ONLY with JSON`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    const milestones = parsed.milestones || []

    // Ensure at least one output milestone
    const hasOutput = milestones.some((m: { type: string }) => m.type === 'output')
    if (!hasOutput && milestones.length > 0) {
      milestones.push({
        title: `Produce final output: ${goal.finalOutput || goal.capabilityStatement}`,
        type: 'output',
      })
    }

    const created = await prisma.learningMilestone.createMany({
      data: milestones.map((m: { title: string; type: string }) => ({
        capabilityGoalId: id,
        title: m.title,
        type: m.type || 'knowledge',
      })),
    })

    return NextResponse.json({ count: created.count })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
