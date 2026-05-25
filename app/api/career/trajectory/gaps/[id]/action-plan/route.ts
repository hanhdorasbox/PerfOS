import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const gap = await prisma.trajectoryGap.findUnique({
      where: { id },
      include: { trajectory: true },
    })
    if (!gap) return NextResponse.json({ error: 'Gap not found' }, { status: 404 })

    const t = gap.trajectory
    const prompt = `You are a direct career strategist. Create a concrete action plan to close this career gap.

CONTEXT:
- Current role: ${t.currentRole}${t.currentLevel ? ` (${t.currentLevel})` : ''}
- Target: ${t.targetRoleTitle || t.targetPath}
- Gap type: ${gap.gapType}
- Gap title: ${gap.title}
- Gap description: ${gap.description || 'None'}
- Priority: ${gap.priority === 1 ? 'High' : gap.priority === 2 ? 'Medium' : 'Low'}

Return ONLY valid JSON (no markdown):
{
  "difficulty": "easy|medium|hard",
  "weekEstimate": <integer: estimated weeks to close this gap>,
  "nextBestAction": "<One specific action to take this week — max 15 words>",
  "evidenceNeeded": "<What does 'closed' look like? Concrete proof — max 20 words>",
  "whyItMatters": "<1 sentence: why closing this gap moves you closer to the target role>",
  "actionPlan": [
    {
      "step": 1,
      "action": "<specific action — max 12 words>",
      "timeframe": "<e.g. Week 1, Weeks 2-3, Month 2>",
      "output": "<tangible result of this step>"
    }
  ]
}

Rules: 3-6 steps, very concrete, no generic advice like "learn more" or "practice". Each step must have a clear deliverable.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You are a direct career strategist. Return ONLY valid JSON. No markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })

    const result = JSON.parse(match[0])

    const updated = await prisma.trajectoryGap.update({
      where: { id },
      data: {
        actionPlan: result.actionPlan ? JSON.stringify(result.actionPlan) : null,
        nextBestAction: result.nextBestAction ?? null,
        evidenceNeeded: result.evidenceNeeded ?? null,
        difficulty: result.difficulty ?? null,
        weekEstimate: result.weekEstimate ?? null,
      },
    })

    return NextResponse.json({
      ok: true,
      gap: updated,
      whyItMatters: result.whyItMatters,
    })
  } catch (e: unknown) {
    console.error('[POST /api/career/trajectory/gaps/[id]/action-plan]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
