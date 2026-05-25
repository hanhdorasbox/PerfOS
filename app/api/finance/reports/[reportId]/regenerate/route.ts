import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  try {
    const report = await prisma.financeReport.findUnique({ where: { id: reportId } })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const chartData = report.summaryData ? JSON.parse(report.summaryData) : {}

    const aiResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: 'You are a direct personal finance analyst. Return ONLY valid JSON. No markdown, no explanation, no code fences.',
      messages: [
        {
          role: 'user',
          content: `Generate a structured monthly financial report for ${report.reportMonth}.

Data:
${JSON.stringify(chartData, null, 2)}

Return ONLY this JSON structure (no other text):
{
  "status": "positive|watch|risk|critical",
  "tldr": ["3–5 short bullets: what happened, is it good or bad, top 2 facts"],
  "watchPoints": ["2–4 specific things to watch or fix next month"],
  "nextActions": [
    { "title": "Specific action (max 8 words)", "why": "1 short reason" }
  ],
  "deepDive": [
    { "title": "Section name", "bullets": ["1–2 sentences, specific data"] }
  ]
}

Rules: Use Kč. Be specific with numbers. Max 5 nextActions. Max 4 deepDive sections.`,
        },
      ],
    })

    const raw = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    const narrative = match ? match[0] : JSON.stringify({
      status: 'watch', tldr: ['Report generated.'], watchPoints: [], nextActions: [], deepDive: []
    })

    const updated = await prisma.financeReport.update({
      where: { id: reportId },
      data: { narrative },
    })

    return NextResponse.json({ ok: true, narrative, report: updated })
  } catch (e) {
    console.error('[POST /api/finance/reports/[reportId]/regenerate]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
