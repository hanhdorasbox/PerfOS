import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const idea = await prisma.idea.findUnique({ where: { id } })
    if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

    // Fetch user's active goals for context
    const activeGoals = await prisma.goal.findMany({
      where: { userId: idea.userId, status: 'active' },
      select: { title: true, category: true },
      take: 10,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Evaluate this idea for strategic relevance. Be direct and honest.

Idea: ${idea.title}
Description: ${idea.description || 'None'}
Domain: ${idea.domain || 'Unknown'}
Effort Estimate: ${idea.effortEstimate || 'Unknown'}
Possible Upside: ${idea.possibleUpside || 'Not specified'}
Time Sensitive: ${idea.isTimeSensitive}

User's Active Goals:
${activeGoals.map(g => `- ${g.title} (${g.category})`).join('\n') || 'None'}

Return ONLY valid JSON:
{
  "isStrategicRelevant": boolean,
  "timing": "now|next_quarter|later|never",
  "upside": "high|medium|low",
  "recommendation": "specific recommendation text",
  "smallestNextStep": "concrete action to validate",
  "whatMustBeTrue": "condition for this idea to be worth pursuing"
}

Be honest. Most ideas are not worth pursuing now. Respond ONLY with JSON.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const evaluation = JSON.parse(jsonMatch[0])

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        aiEvaluation: JSON.stringify(evaluation),
        nextStep: evaluation.smallestNextStep ?? null,
      },
    })

    return NextResponse.json({ idea: updated, evaluation })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
