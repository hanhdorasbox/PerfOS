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

  // Look up workbook record
  const workbookRecord = await prisma.financeWorkbook.findUnique({ where: { userId } })
  const blobUrl = workbookRecord?.blobUrl

  // Derive the user-specific blob pathname (matches what was uploaded in WorkbookStatusCard)
  const blobPathname = `finance-tracker-${userId}.xlsx`

  // ── Step 1: Write transactions to Excel (non-blocking) ──────────────────────
  let excelWritten = false
  let excelError: string | null = null
  let excelRows: number[] = approvable.map((_, i) => i + 1) // dummy rows if Excel unavailable

  try {
    const wb = blobUrl ? await readWorkbookFromBlob(blobUrl) : readWorkbook()

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

    excelRows = appendTransactions(wb, txRows)

    // Save back using the same pathname as the original upload
    let newBlobUrl: string
    if (blobUrl) {
      newBlobUrl = await saveWorkbookToBlob(wb, blobPathname)
    } else {
      saveWorkbook(wb)
      newBlobUrl = blobUrl || ''
    }

    // Update the stored blob URL (in case it changed after overwrite)
    if (blobUrl && newBlobUrl && newBlobUrl !== blobUrl) {
      await prisma.financeWorkbook.updateMany({
        where: { userId },
        data: { blobUrl: newBlobUrl, filePath: newBlobUrl },
      })
    }

    excelWritten = true
  } catch (xlErr) {
    // Excel writing failed — we still approve to DB, report it as a warning
    console.error('[approve] Excel write failed:', xlErr)
    excelError = xlErr instanceof Error ? xlErr.message : String(xlErr)
  }

  // ── Step 2: Mark transactions as approved in DB (always runs) ───────────────
  await Promise.all(
    approvable.map((tx, i) =>
      prisma.financeTransaction.update({
        where: { id: tx.id },
        data: {
          writtenToExcel: excelWritten,
          excelRow: excelWritten ? excelRows[i] : null,
          txStatus: 'approved',
        },
      })
    )
  )

  // ── Step 3: Update import + workbook status ──────────────────────────────────
  await prisma.financeImport.update({
    where: { id: importId },
    data: {
      status: 'written',
      writtenAt: new Date(),
      approvedAt: new Date(),
    },
  })

  await prisma.financeWorkbook.updateMany({
    where: { userId },
    data: {
      lastImportAt: new Date(),
      lastImportMonth: financeImport.statementMonth,
    },
  })

  // ── Step 4: Generate report ──────────────────────────────────────────────────
  // Build chart data from DB transactions (no workbook required)
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

  // Attempt to read workbook summaries for richer report data
  let monthlySummary = null
  let annualTrend = null
  try {
    const currentBlobUrl = (await prisma.financeWorkbook.findUnique({ where: { userId } }))?.blobUrl
    const updatedWb = currentBlobUrl ? await readWorkbookFromBlob(currentBlobUrl) : readWorkbook()
    monthlySummary = readMonthlySummary(updatedWb, financeImport.statementMonth)
    annualTrend = readAnnualData(updatedWb)
  } catch {
    // Non-fatal — report will use transaction data only
  }

  const chartData = {
    incomeVsExpense: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
    byCategory,
    monthlySummary,
    annualTrend,
    txCount: approvable.length,
    excelWritten,
    excelError,
  }

  const aiResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
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

  return NextResponse.json({
    success: true,
    report,
    excelWritten,
    excelError,
  })
}
