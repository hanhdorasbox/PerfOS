import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { category } = await req.json()

    const transaction = await prisma.transaction.update({
      where: { id },
      data: { category, needsReview: false, confidence: 1.0 },
      include: { statement: { select: { userId: true } } },
    })

    // Upsert a transaction rule if merchant is known
    if (transaction.merchant && transaction.statement?.userId && category) {
      const userId = transaction.statement.userId
      const merchant = transaction.merchant

      const existing = await prisma.transactionRule.findFirst({
        where: { userId, merchant },
      })

      if (existing) {
        await prisma.transactionRule.update({ where: { id: existing.id }, data: { category } })
      } else {
        await prisma.transactionRule.create({ data: { userId, merchant, category } })
      }
    }

    return NextResponse.json({ transaction })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
