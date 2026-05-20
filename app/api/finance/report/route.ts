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

    const aiPrompt = `You are a personal finance advisor. Analyze this monthly financial data and provide a concise, direct analysis.

Month: ${statement.month}/${statement.year}
Total Income: ${totalIncome.toFixed(2)}
Total Expenses: ${totalExpenses.toFixed(2)}
Net Result: ${netResult.toFixed(2)}
Savings Rate: ${savingsRate.toFixed(1)}%

Category Breakdown:
${Object.entries(categoryBreakdown).map(([cat, amt]) => `${cat}: ${amt.toFixed(2)}`).join('\n')}

${prevMonthComparison ? `Previous Month:
Income: ${prevMonthComparison.prevIncome.toFixed(2)}
Expenses: ${prevMonthComparison.prevExpenses.toFixed(2)}` : ''}

Provide a 3-4 paragraph analysis covering: spending patterns, areas of concern, positive trends, and 2-3 concrete recommendations. Be specific and direct.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: aiPrompt }],
    })

    const aiAnalysis = response.content[0].type === 'text' ? response.content[0].text : ''

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
