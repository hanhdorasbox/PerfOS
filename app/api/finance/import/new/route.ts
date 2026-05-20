import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseCSVStatement } from '@/lib/statementParser'
import { parsePDFStatement } from '@/lib/pdfStatementParser'
import { categorizeTx } from '@/lib/autoCategorizeTx'
import type { ParsedTransaction } from '@/lib/statementParser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const userId = formData.get('userId') as string
    const file = formData.get('file') as File
    if (!userId || !file) return NextResponse.json({ error: 'userId and file required' }, { status: 400 })

    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

    let parsed: ParsedTransaction[]
    if (isPDF) {
      const buffer = await file.arrayBuffer()
      try {
        parsed = await parsePDFStatement(buffer)
      } catch (pdfErr) {
        console.error('PDF parsing error:', pdfErr)
        return NextResponse.json({ error: `PDF parsing failed: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}` }, { status: 422 })
      }
    } else {
      const content = await file.text()
      parsed = parseCSVStatement(content)
    }

    if (parsed.length === 0) return NextResponse.json({ error: 'No transactions found in file' }, { status: 400 })

    // Detect statement month from dates
    const dates = parsed.map(t => t.date).filter(Boolean).sort()
    const statementMonth = dates[0]?.slice(0, 7) || new Date().toISOString().slice(0, 7)

    // Load user's learned rules
    const rules = await prisma.financeCategorizationRule.findMany({ where: { userId } })

    // Check for existing approved imports of same month
    const existingImport = await prisma.financeImport.findFirst({
      where: { userId, statementMonth, status: { in: ['approved', 'written'] } },
    })

    // Create import record
    const financeImport = await prisma.financeImport.create({
      data: {
        userId,
        statementMonth,
        status: 'pending_review',
        sourceFileName: file.name,
      },
    })

    // Create transaction records with categorization
    let duplicateCount = 0
    const txRecords = await Promise.all(
      parsed.map(async (tx) => {
        const { category, subCategory, confidence } = categorizeTx(tx.description, tx.amount, rules)

        // Check for duplicates already written to Excel
        const dupCheck = await prisma.financeTransaction.findFirst({
          where: {
            userId,
            txDate: tx.date,
            amount: tx.amount,
            description: tx.description,
            writtenToExcel: true,
          },
        })

        if (dupCheck) duplicateCount++

        return prisma.financeTransaction.create({
          data: {
            importId: financeImport.id,
            userId,
            txDate: tx.date,
            description: tx.description,
            amount: tx.amount,
            category,
            subCategory,
            account: tx.account ?? null,
            txStatus: dupCheck ? 'duplicate' : 'pending',
            confidence,
          },
        })
      })
    )

    return NextResponse.json({
      importId: financeImport.id,
      statementMonth,
      transactionCount: txRecords.length,
      duplicateCount,
      possibleDuplicate: !!existingImport,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
