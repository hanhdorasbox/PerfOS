import { NextRequest, NextResponse } from 'next/server'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const { goal, timeframe, context } = await req.json()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: `You are a strategic career and performance advisor. Generate detailed, practical goal roadmaps. Return ONLY valid JSON — no markdown, no explanation, no code fences.

Schema:
{
  "title": "string",
  "summary": "string — 2-3 sentences",
  "phases": [
    {
      "name": "string",
      "duration": "string e.g. Month 1-2",
      "focus": "string",
      "milestones": ["string"],
      "weeklyTasks": ["string"],
      "resources": ["string"]
    }
  ]
}

Rules:
- 3-4 phases for timeframes under 6 months, 4-5 phases for longer
- Each phase: 2-3 milestones, 3-4 weekly tasks, 2-3 resources
- Be concrete and specific — real tools, real deliverables
- Keep JSON compact to avoid truncation`,
    messages: [{
      role: 'user',
      content: `Goal: ${goal}\nTimeframe: ${timeframe}${context ? `\nContext: ${context}` : ''}\n\nGenerate roadmap JSON.`
    }]
  })

  const text = (response.content[0] as any).text?.trim() ?? ''

  // Strip markdown code fences if present
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  // Find the JSON object
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) {
    return NextResponse.json({ error: 'No JSON object found in response' }, { status: 500 })
  }

  const jsonStr = clean.slice(start, end + 1)

  try {
    const data = JSON.parse(jsonStr)
    return NextResponse.json(data)
  } catch {
    // Try to recover truncated JSON — return what we have with a warning
    return NextResponse.json({ error: 'Roadmap generation returned incomplete JSON. Try again.' }, { status: 500 })
  }
}
