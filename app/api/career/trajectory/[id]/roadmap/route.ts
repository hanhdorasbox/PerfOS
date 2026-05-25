import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const trajectory = await prisma.careerTrajectory.findUnique({
      where: { id },
      include: { gaps: true },
    })
    if (!trajectory) return NextResponse.json({ error: 'Trajectory not found' }, { status: 404 })

    const openGaps = trajectory.gaps.filter(g => !g.closed && !g.archived)
    const closedGaps = trajectory.gaps.filter(g => g.closed)

    const prompt = `You are a direct career strategist. Generate a 3-6 month execution roadmap for this career transition.

CURRENT STATE:
- Current role: ${trajectory.currentRole}${trajectory.currentLevel ? ` (${trajectory.currentLevel})` : ''}
- Target: ${trajectory.targetRoleTitle || trajectory.targetPath}
- Time horizon: ${trajectory.timeHorizon || 'Not specified'}
- Key strengths: ${trajectory.keyStrengths || 'Not specified'}

OPEN GAPS (${openGaps.length}):
${openGaps.map(g => `- [${g.gapType}] ${g.title} (priority ${g.priority}): ${g.description || ''}`).join('\n') || '- None'}

CLOSED GAPS (${closedGaps.length}):
${closedGaps.map(g => `- ${g.title}`).join('\n') || '- None'}

Return ONLY valid JSON (no markdown):
{
  "readinessScore": <0-100 integer — how ready they are right now>,
  "readinessBreakdown": {
    "skill": <0-100>,
    "proof_of_work": <0-100>,
    "scope": <0-100>,
    "visibility": <0-100>,
    "experience": <0-100>
  },
  "nextBestAction": "<One specific action to take this week>",
  "roadmap": [
    {
      "phase": "Phase 1",
      "monthRange": "Months 1-2",
      "focus": "<theme of this phase>",
      "milestones": ["<specific milestone>", "<specific milestone>"],
      "keyOutput": "<tangible deliverable at end of this phase>",
      "gapsClosed": ["<gap title>", ...]
    }
  ],
  "suggestedProjects": [
    {
      "title": "<project title>",
      "why": "<why this closes gaps>",
      "gaps": ["<gap type>"],
      "effort": "1-2 weeks | 1 month | 2-3 months",
      "impact": "<expected career impact>"
    }
  ]
}

Rules: 2-4 phases, max 5 suggested projects, specific actionable milestones, no vague advice.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are a direct career strategist. Return ONLY valid JSON. No markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })

    const result = JSON.parse(match[0])

    const updated = await prisma.careerTrajectory.update({
      where: { id },
      data: {
        readinessScore: result.readinessScore ?? null,
        readinessBreakdown: result.readinessBreakdown ? JSON.stringify(result.readinessBreakdown) : null,
        executionRoadmap: result.roadmap ? JSON.stringify(result.roadmap) : null,
        nextBestAction: result.nextBestAction ?? null,
      },
    })

    return NextResponse.json({
      ok: true,
      readinessScore: result.readinessScore,
      readinessBreakdown: result.readinessBreakdown,
      roadmap: result.roadmap,
      suggestedProjects: result.suggestedProjects,
      nextBestAction: result.nextBestAction,
      trajectory: updated,
    })
  } catch (e: unknown) {
    console.error('[POST /api/career/trajectory/[id]/roadmap]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
