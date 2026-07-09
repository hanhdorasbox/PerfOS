import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getInvestDb, assets, priceSnapshots } from '@/lib/invest/db'
import { manualPriceSchema } from '@/lib/invest/validation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 })
  }

  const db = getInvestDb()
  const prices = await db
    .select({ id: priceSnapshots.id, price: priceSnapshots.price, date: priceSnapshots.date })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.assetId, id))
    .orderBy(desc(priceSnapshots.date))
    .limit(60)

  return NextResponse.json({ prices })
}

// Upsert a manually entered price for a given day (one snapshot per asset+date)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = manualPriceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Neplatný vstup' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [asset] = await db.select({ id: assets.id }).from(assets).where(eq(assets.id, id)).limit(1)
  if (!asset) {
    return NextResponse.json({ error: 'Asset nenalezen' }, { status: 404 })
  }

  const [snapshot] = await db
    .insert(priceSnapshots)
    .values({ assetId: id, price: String(parsed.data.price), date: parsed.data.date })
    .onConflictDoUpdate({
      target: [priceSnapshots.assetId, priceSnapshots.date],
      set: { price: String(parsed.data.price) },
    })
    .returning()

  return NextResponse.json({ price: snapshot }, { status: 201 })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 })
  }

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !z.iso.date().safeParse(date).success) {
    return NextResponse.json({ error: 'Neplatné datum (?date=YYYY-MM-DD)' }, { status: 400 })
  }

  const db = getInvestDb()
  const deleted = await db
    .delete(priceSnapshots)
    .where(and(eq(priceSnapshots.assetId, id), eq(priceSnapshots.date, date)))
    .returning()

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Cena nenalezena' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
