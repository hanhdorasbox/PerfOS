import { NextRequest, NextResponse } from 'next/server'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { trajectoryData } = await req.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the gap between this person's current state and their target career role. Identify concrete, specific gaps they need to close.

Current State:
- Role: ${trajectoryData.currentRole}
- Level: ${trajectoryData.currentLevel || 'Not specified'}
- Responsibilities: ${trajectoryData.responsibilities || 'Not specified'}
- Key Strengths: ${trajectoryData.keyStrengths || 'Not specified'}

Target:
- Path: ${trajectoryData.targetPath}
- Title: ${trajectoryData.targetRoleTitle || trajectoryData.targetPath}
- Time Horizon: ${trajectoryData.timeHorizon}

Return ONLY valid JSON:
{
  "gaps": [
    {
      "gapType": "skill|proof_of_work|scope|visibility|experience",
      "title": "specific gap title",
      "description": "what exactly is missing and why it matters",
      "priority": 1
    }
  ]
}

Priority: 1=high, 2=medium, 3=low.
Gap types:
- skill: technical or soft skill deficit
- proof_of_work: lacking tangible work samples/results
- scope: limited exposure to required scope of work
- visibility: not known for relevant things in right circles
- experience: missing specific domain or function experience

Identify 5-8 gaps. Be specific and actionable. Respond ONLY with JSON.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({ gaps: parsed.gaps || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
