import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { getInvestDb, assets } from '@/lib/invest/db'
import { assetUpdateSchema } from '@/lib/invest/validation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = assetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const db = getInvestDb()

  if (parsed.data.ticker) {
    const [conflict] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.ticker, parsed.data.ticker), ne(assets.id, id)))
      .limit(1)
    if (conflict) {
      return NextResponse.json(
        { error: `Asset ${parsed.data.ticker} already exists` },
        { status: 409 },
      )
    }
  }

  const [updated] = await db.update(assets).set(parsed.data).where(eq(assets.id, id)).returning()
  if (!updated) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }
  return NextResponse.json({ asset: updated })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const db = getInvestDb()
  const [deleted] = await db.delete(assets).where(eq(assets.id, id)).returning()
  if (!deleted) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
