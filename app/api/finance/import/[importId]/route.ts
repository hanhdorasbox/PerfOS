import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params
  const financeImport = await prisma.financeImport.findUnique({
    where: { id: importId },
    include: { transactions: { orderBy: { txDate: 'asc' } } },
  })
  if (!financeImport) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(financeImport)
}

// Delete an import and all its transactions (cascades via Prisma)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const { importId } = await params
  try {
    // Delete transactions first (no cascade in schema)
    await prisma.financeTransaction.deleteMany({ where: { importId } })
    // Delete associated report if any
    await prisma.financeReport.deleteMany({ where: { importId } })
    await prisma.financeImport.delete({ where: { id: importId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/finance/import]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Update individual transactions during review
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  await params // satisfy the param requirement
  const body = await req.json()
  const { transactions, userId } = body as {
    transactions: {
      id: string
      category?: string
      subCategory?: string
      txStatus?: string
      description?: string
      learnRule?: boolean
    }[]
    userId: string
  }

  const updated = await Promise.all(
    transactions.map((tx) =>
      prisma.financeTransaction.update({
        where: { id: tx.id },
        data: {
          ...(tx.category !== undefined && { category: tx.category }),
          ...(tx.subCategory !== undefined && { subCategory: tx.subCategory }),
          ...(tx.txStatus !== undefined && { txStatus: tx.txStatus }),
          ...(tx.description !== undefined && { description: tx.description }),
        },
      })
    )
  )

  // Learn categorization rules from manual corrections
  const ruleUpdates = transactions.filter((tx) => tx.category && tx.learnRule && tx.description)
  for (const tx of ruleUpdates) {
    const pattern = tx.description!.toLowerCase().split(' ').slice(0, 3).join(' ')
    await prisma.financeCategorizationRule.upsert({
      where: {
        userId_merchantPattern: { userId, merchantPattern: pattern },
      },
      create: {
        userId,
        merchantPattern: pattern,
        category: tx.category!,
        subCategory: tx.subCategory ?? null,
      },
      update: {
        category: tx.category!,
        subCategory: tx.subCategory ?? null,
        matchCount: { increment: 1 },
      },
    })
  }

  return NextResponse.json({ updated: updated.length })
}
