import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  try {
    const { statementId, userId } = await req.json()
    if (!statementId || !userId) {
      return NextResponse.json({ error: 'statementId and userId required' }, { status: 400 })
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: { transactions: true },
    })
    if (!statement) return NextResponse.json({ error: 'Statement not found' }, { status: 404 })

    const transactions = statement.transactions

    let totalIncome = 0
    let totalExpenses = 0
    const categoryBreakdown: Record<string, number> = {}

    for (const tx of transactions) {
      if (tx.isIncoming) {
        totalIncome += tx.amount
      } else {
        totalExpenses += tx.amount
      }

      if (tx.category) {
        if (!categoryBreakdown[tx.category]) categoryBreakdown[tx.category] = 0
        categoryBreakdown[tx.category] += tx.amount
      }
    }

    const netResult = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0

    // Previous month comparison
    const prevMonth = statement.month === 1 ? 12 : statement.month - 1
    const prevYear = statement.month === 1 ? statement.year - 1 : statement.year
    const prevStatement = await prisma.bankStatement.findFirst({
      where: { userId, month: prevMonth, year: prevYear, status: 'committed' },
      include: { report: true },
    })

    let prevMonthComparison = null
    if (prevStatement?.report) {
      prevMonthComparison = {
        prevIncome: prevStatement.report.totalIncome,
        prevExpenses: prevStatement.report.totalExpenses,
        incomeChange: totalIncome - prevStatement.report.totalIncome,
        expensesChange: totalExpenses - prevStatement.report.totalExpenses,
      }
    }

    const aiPrompt = `Generate a structured monthly financial report for ${statement.month}/${statement.year}.

Data:
- Income: ${totalIncome.toFixed(2)} Kč
- Expenses: ${totalExpenses.toFixed(2)} Kč
- Net: ${netResult.toFixed(2)} Kč
- Savings rate: ${savingsRate.toFixed(1)}%
- Category breakdown: ${Object.entries(categoryBreakdown).map(([c, a]) => `${c}: ${a.toFixed(0)} Kč`).join(', ')}
${prevMonthComparison ? `- Previous month income: ${prevMonthComparison.prevIncome.toFixed(0)} Kč, expenses: ${prevMonthComparison.prevExpenses.toFixed(0)} Kč` : ''}

Return ONLY this JSON (no other text):
{
  "status": "positive|watch|risk|critical",
  "tldr": ["3–5 short bullets: what happened, is it good or bad, top facts"],
  "watchPoints": ["2–4 specific things to watch or fix next month"],
  "nextActions": [
    { "title": "Specific action (max 8 words)", "why": "1 short reason" }
  ],
  "deepDive": [
    { "title": "Section name", "bullets": ["1–2 sentences, specific data"] }
  ]
}

Rules: Use Kč. Be specific with numbers. Max 5 nextActions. Max 4 deepDive sections.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You are a direct personal finance analyst. Return ONLY valid JSON. No markdown, no explanation, no code fences.',
      messages: [{ role: 'user', content: aiPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const aiAnalysis = jsonMatch ? jsonMatch[0] : JSON.stringify({ status: 'watch', tldr: ['Report generated.'], watchPoints: [], nextActions: [], deepDive: [] })

    const report = await prisma.financialReport.create({
      data: {
        statementId,
        totalIncome,
        totalExpenses,
        netResult,
        savingsRate,
        savedAmount: netResult > 0 ? netResult : 0,
        categoryBreakdown: JSON.stringify(categoryBreakdown),
        prevMonthComparison: prevMonthComparison ? JSON.stringify(prevMonthComparison) : null,
        aiAnalysis,
      },
    })

    return NextResponse.json({ report })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
