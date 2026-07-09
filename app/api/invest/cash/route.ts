import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getInvestDb, cashBalances } from '@/lib/invest/db'
import { cashUpsertSchema } from '@/lib/invest/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getInvestDb()
  const rows = await db.select().from(cashBalances)
  return NextResponse.json({ cash: rows })
}

// Upsert the manually kept reserve for a currency (source: manual).
// T212-synced rows are owned by the sync and can't be edited here.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = cashUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Neplatný vstup' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [existing] = await db
    .select()
    .from(cashBalances)
    .where(and(eq(cashBalances.currency, parsed.data.currency), eq(cashBalances.source, 'manual')))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(cashBalances)
      .set({ amount: String(parsed.data.amount), updatedAt: new Date() })
      .where(eq(cashBalances.id, existing.id))
      .returning()
    return NextResponse.json({ cash: updated })
  }

  const [created] = await db
    .insert(cashBalances)
    .values({ currency: parsed.data.currency, amount: String(parsed.data.amount), source: 'manual' })
    .returning()
  return NextResponse.json({ cash: created }, { status: 201 })
}
