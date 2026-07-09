import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { getInvestDb, assets, positions, transactions } from '@/lib/invest/db'
import { transactionCreateSchema } from '@/lib/invest/validation'
import { computeHolding } from '@/lib/invest/portfolio/calc'

export const dynamic = 'force-dynamic'

// Manual transaction — fallback for assets outside Trading212
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = transactionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Neplatný vstup' },
      { status: 400 },
    )
  }
  const input = parsed.data

  const db = getInvestDb()
  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) {
    return NextResponse.json({ error: 'Asset nenalezen' }, { status: 404 })
  }

  const assetPositions = await db
    .select({ id: positions.id, status: positions.status })
    .from(positions)
    .where(eq(positions.assetId, asset.id))
  const positionIds = assetPositions.map((p) => p.id)

  if (input.type === 'sell') {
    const txs = positionIds.length
      ? await db.select().from(transactions).where(inArray(transactions.positionId, positionIds))
      : []
    const holding = computeHolding(txs.filter((t) => t.type === 'buy' || t.type === 'sell'))
    if (new Decimal(input.quantity ?? 0).gt(holding.quantity)) {
      return NextResponse.json(
        { error: `Nelze prodat víc, než držíš (${holding.quantity.toString()} ks)` },
        { status: 400 },
      )
    }
  }

  const executedAt = new Date(`${input.executedAt}T12:00:00Z`)

  let positionId = assetPositions.find((p) => p.status === 'open')?.id ?? null
  if (!positionId) {
    const [created] = await db
      .insert(positions)
      .values({ assetId: asset.id, status: 'open', openedAt: executedAt })
      .returning({ id: positions.id })
    positionId = created.id
  }

  const [tx] = await db
    .insert(transactions)
    .values({
      positionId,
      type: input.type,
      quantity: input.quantity !== undefined ? String(input.quantity) : null,
      price: input.price !== undefined ? String(input.price) : null,
      amount: String(input.amount),
      currency: asset.currency,
      executedAt,
      note: input.note || null,
      source: 'manual',
    })
    .returning()

  // Close the position when a sell empties it
  if (input.type === 'sell') {
    const txsAfter = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.positionId, [...positionIds, positionId]))
    const holding = computeHolding(txsAfter.filter((t) => t.type === 'buy' || t.type === 'sell'))
    if (holding.quantity.lte(0)) {
      await db
        .update(positions)
        .set({ status: 'closed', closedAt: executedAt })
        .where(and(eq(positions.assetId, asset.id), eq(positions.status, 'open')))
    }
  }

  return NextResponse.json({ transaction: tx }, { status: 201 })
}
