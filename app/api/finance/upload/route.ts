import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

function detectColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === candidate.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

function parseDate(val: string | number | undefined): Date {
  if (!val) return new Date()
  if (typeof val === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + val * 86400000)
  }
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? new Date() : d
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: 'file and userId required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name

    let rows: Record<string, string | number | null>[] = []

    if (filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
    } else {
      // CSV
      const text = buffer.toString('utf-8')
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) throw new Error('CSV has no data rows')

      const rawHeaders = lines[0].split(/[,;]/).map(h => h.replace(/^["']|["']$/g, '').trim())

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(/[,;]/).map(c => c.replace(/^["']|["']$/g, '').trim())
        const row: Record<string, string | number | null> = {}
        rawHeaders.forEach((h, idx) => {
          row[h] = cells[idx] ?? null
        })
        rows.push(row)
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    const dateCol = detectColumn(headers, ['date', 'datum', 'Date', 'Datum', 'transaction_date', 'value_date'])
    const amountCol = detectColumn(headers, ['amount', 'castka', 'Amount', 'Castka', 'sum', 'value'])
    const merchantCol = detectColumn(headers, ['merchant', 'description', 'popis', 'Merchant', 'Description', 'Popis', 'name', 'beneficiary'])
    const descCol = detectColumn(headers, ['description', 'popis', 'note', 'reference', 'message'])

    if (amountCol === -1) {
      return NextResponse.json({ error: 'Could not detect amount column. Headers: ' + headers.join(', ') }, { status: 400 })
    }

    // Detect month/year from first valid date or filename
    let statementMonth = new Date().getMonth() + 1
    let statementYear = new Date().getFullYear()

    const existingRules = await prisma.transactionRule.findMany({ where: { userId } })
    const ruleMap = new Map(existingRules.map(r => [r.merchant.toLowerCase(), r.category]))

    const transactions: {
      date: Date
      amount: number
      merchant: string | null
      description: string | null
      isIncoming: boolean
      category: string | null
      confidence: number
      needsReview: boolean
    }[] = []

    let reviewNeeded = 0

    for (const row of rows) {
      const rawAmount = row[headers[amountCol]]
      if (rawAmount === null || rawAmount === undefined || rawAmount === '') continue

      const amountStr = String(rawAmount).replace(/\s/g, '').replace(',', '.')
      const amount = parseFloat(amountStr)
      if (isNaN(amount)) continue

      const rawDate = dateCol !== -1 ? row[headers[dateCol]] : null
      const date = parseDate(rawDate as string | number | undefined)

      if (transactions.length === 0) {
        statementMonth = date.getMonth() + 1
        statementYear = date.getFullYear()
      }

      const merchantRaw = merchantCol !== -1 ? String(row[headers[merchantCol]] ?? '') : ''
      const descRaw = descCol !== -1 ? String(row[headers[descCol]] ?? '') : ''
      const merchant = merchantRaw.trim() || null
      const description = descRaw.trim() || null

      const isIncoming = amount > 0

      // Auto-categorize
      let category: string | null = null
      let confidence = 0
      let needsReview = true

      const merchantKey = (merchant || description || '').toLowerCase()
      if (merchantKey) {
        for (const [ruleKey, ruleCat] of ruleMap) {
          if (merchantKey.includes(ruleKey) || ruleKey.includes(merchantKey)) {
            category = ruleCat
            confidence = 1.0
            needsReview = false
            break
          }
        }
      }

      if (!category) {
        reviewNeeded++
      }

      transactions.push({ date, amount: Math.abs(amount), merchant, description, isIncoming, category, confidence, needsReview })
    }

    // Create statement
    const statement = await prisma.bankStatement.create({
      data: {
        userId,
        month: statementMonth,
        year: statementYear,
        filename,
        rawData: buffer.toString('base64').substring(0, 10000),
        status: 'pending',
        transactions: {
          create: transactions.map(t => ({
            date: t.date,
            amount: t.amount,
            merchant: t.merchant,
            description: t.description,
            isIncoming: t.isIncoming,
            category: t.category,
            confidence: t.confidence,
            needsReview: t.needsReview,
          })),
        },
      },
    })

    return NextResponse.json({
      statementId: statement.id,
      transactionCount: transactions.length,
      reviewNeeded,
    })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload error' }, { status: 500 })
  }
}
