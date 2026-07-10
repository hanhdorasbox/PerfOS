import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getInvestDb, assets, watchlistItems } from '@/lib/invest/db'
import { watchlistCreateSchema, watchlistUpdateSchema } from '@/lib/invest/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getInvestDb()
  const rows = await db
    .select({
      id: watchlistItems.id,
      assetId: watchlistItems.assetId,
      targetMos: watchlistItems.targetMos,
      note: watchlistItems.note,
      addedAt: watchlistItems.addedAt,
      ticker: assets.ticker,
      name: assets.name,
    })
    .from(watchlistItems)
    .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
  return NextResponse.json({ watchlist: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = watchlistCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Neplatný vstup' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [existing] = await db
    .select({ id: watchlistItems.id })
    .from(watchlistItems)
    .where(eq(watchlistItems.assetId, parsed.data.assetId))
    .limit(1)
  if (existing) {
    return NextResponse.json({ error: 'Asset už je na watchlistu' }, { status: 409 })
  }

  const [created] = await db
    .insert(watchlistItems)
    .values({
      assetId: parsed.data.assetId,
      targetMos: String(parsed.data.targetMos),
      note: parsed.data.note || null,
    })
    .returning()
  return NextResponse.json({ item: created }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = watchlistUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Neplatný vstup' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const patch: Record<string, unknown> = {}
  if (parsed.data.targetMos !== undefined) patch.targetMos = String(parsed.data.targetMos)
  if (parsed.data.note !== undefined) patch.note = parsed.data.note
  const [updated] = await db
    .update(watchlistItems)
    .set(patch)
    .where(eq(watchlistItems.id, parsed.data.id))
    .returning()
  if (!updated) {
    return NextResponse.json({ error: 'Položka nenalezena' }, { status: 404 })
  }
  return NextResponse.json({ item: updated })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Neplatné ID (?id=)' }, { status: 400 })
  }
  const db = getInvestDb()
  const [deleted] = await db.delete(watchlistItems).where(eq(watchlistItems.id, id)).returning()
  if (!deleted) {
    return NextResponse.json({ error: 'Položka nenalezena' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
