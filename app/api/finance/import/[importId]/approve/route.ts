import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  readWorkbook,
  saveWorkbook,
  readWorkbookFromBlob,
  saveWorkbookToBlob,
  appendTransactions,
  dateToSerial,
  monthToSerial,
  readMonthlySummary,
  readAnnualData,
} from '@/lib/excel'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params
  const { userId } = await req.json()

  const financeImport = await prisma.financeImport.findUnique({
    where: { id: importId },
    include: {
      transactions: {
        where: { txStatus: { in: ['pending', 'approved'] } },
      },
    },
  })
  if (!financeImport) return NextResponse.json({ error: 'Import not found' }, { status: 404 })

  const approvable = financeImport.transactions.filter(
    (t) => t.txStatus !== 'excluded' && t.txStatus !== 'duplicate'
  )

  // Look up whether this user has a blob-connected workbook
  const workbookRecord = await prisma.financeWorkbook.findUnique({ where: { userId } })
  const blobUrl = workbookRecord?.blobUrl

  // Write to Excel — fail gracefully if file is unavailable
  let wb
  try {
    wb = blobUrl ? await readWorkbookFromBlob(blobUrl) : readWorkbook()
  } catch (xlErr) {
    console.error('[approve] Cannot open Excel workbook:', xlErr)
    return NextResponse.json({
      error: 'Excel workbook not found. Upload your Finance Tracker .xlsx via the Finance page.',
      hint: 'Transactions are saved in the database and can be written to Excel once the workbook is uploaded.',
    }, { status: 400 })
  }
  const monthSerial = monthToSerial(financeImport.statementMonth)

  const txRows = approvable.map((tx) => ({
    month: monthSerial,
    date: dateToSerial(new Date(tx.txDate + 'T00:00:00Z')),
    description: tx.description,
    amount: tx.amount,
    account: tx.account || '',
    category: tx.category || 'expenses',
    subCategory: tx.subCategory || '',
    transferTo: tx.transferTo || '',
  }))

  let excelRows: number[]
  try {
    excelRows = appendTransactions(wb, txRows)
    if (blobUrl) {
      await saveWorkbookToBlob(wb)
    } else {
      saveWorkbook(wb)
    }
  } catch (writeErr) {
    console.error('[approve] Failed to write workbook:', writeErr)
    return NextResponse.json({
      error: 'Failed to write transactions to Excel.',
    }, { status: 500 })
  }

  // Mark transactions as written
  await Promise.all(
    approvable.map((tx, i) =>
      prisma.financeTransaction.update({
        where: { id: tx.id },
        data: {
          writtenToExcel: true,
          excelRow: excelRows[i],
          txStatus: 'approved',
        },
      })
    )
  )

  // Update import status
  await prisma.financeImport.update({
    where: { id: importId },
    data: {
      status: 'written',
      writtenAt: new Date(),
      approvedAt: new Date(),
    },
  })

  // Update workbook last import
  await prisma.financeWorkbook.updateMany({
    where: { userId },
    data: {
      lastImportAt: new Date(),
      lastImportMonth: financeImport.statementMonth,
    },
  })

  // Generate report from workbook data
  const updatedWb = blobUrl ? await readWorkbookFromBlob(blobUrl) : readWorkbook()
  const summary = readMonthlySummary(updatedWb, financeImport.statementMonth)
  const annual = readAnnualData(updatedWb)

  // Build chart data
  const totalIncome = approvable
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = Math.abs(
    approvable.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  )
  const byCategory: Record<string, number> = {}
  for (const tx of approvable.filter((t) => t.amount < 0)) {
    const cat = tx.category || 'expenses'
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(tx.amount)
  }

  const chartData = {
    incomeVsExpense: {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
    },
    byCategory,
    monthlySummary: summary,
    annualTrend: annual,
    txCount: approvable.length,
  }

  // AI narrative
  const aiResponse = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Generate a concise monthly financial report for ${financeImport.statementMonth}.

Data:
${JSON.stringify(chartData, null, 2)}

Write a 3-5 paragraph analytical report answering:
- Overall financial strength this month (income vs expense, net balance)
- Which categories drove spending
- Notable observations (unusual expenses, savings pace)
- What to watch next month

Style: analytical, direct, practical. No budgeting-app fluff. Use Kč currency.
Format as plain text paragraphs.`,
      },
    ],
  })

  const narrative =
    aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

  const report = await prisma.financeReport.create({
    data: {
      userId,
      importId,
      reportMonth: financeImport.statementMonth,
      summaryData: JSON.stringify(chartData),
      narrative,
      chartData: JSON.stringify(chartData),
    },
  })

  return NextResponse.json({ success: true, report })
}
