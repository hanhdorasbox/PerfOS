import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const { userId, quarterName } = await req.json()

  const [skills, proofOfWork, careerItems, goals] = await Promise.all([
    prisma.skill.findMany({ where: { userId } }),
    prisma.proofOfWork.findMany({ where: { userId } }),
    prisma.careerCapitalItem.findMany({ where: { userId } }),
    prisma.goal.findMany({
      where: { user: { id: userId } },
      include: { careerCapitalEval: true },
    }),
  ])

  const prompt = `You are a career strategist and performance advisor. Analyze this professional's career capital data for ${quarterName} and generate a direct, honest scorecard.

DATA:
Skills: ${JSON.stringify(skills)}
Proof-of-Work Assets: ${JSON.stringify(proofOfWork)}
Career Capital Items: ${JSON.stringify(careerItems)}
Goals with Career Eval: ${JSON.stringify(goals.map(g => ({ title: g.title, category: g.category, eval: g.careerCapitalEval })))}

Return ONLY valid JSON:
{
  "overallStatus": "compounding" | "maintaining" | "declining",
  "statusReason": "one sentence why",
  "insights": [
    { "type": "positive" | "warning" | "critical", "text": "specific insight with numbers and names" }
  ],
  "recommendations": [
    { "priority": "high" | "medium", "text": "concrete action" }
  ],
  "capabilitiesGained": number,
  "proofOfWorkCreated": number,
  "goalsWithCapitalImpact": number,
  "reusableAssets": number
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as { type: string; text: string }).text
  const match = text.match(/\{[\s\S]*\}/)
  const data = match
    ? JSON.parse(match[0])
    : {
        overallStatus: 'maintaining',
        statusReason: 'Insufficient data to provide a detailed analysis.',
        insights: [],
        recommendations: [],
        capabilitiesGained: skills.length,
        proofOfWorkCreated: proofOfWork.length,
        goalsWithCapitalImpact: goals.filter(g => g.careerCapitalEval?.increasesCapital).length,
        reusableAssets: proofOfWork.filter(p => p.reusability >= 4).length,
      }

  return NextResponse.json(data)
}
