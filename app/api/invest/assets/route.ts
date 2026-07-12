import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, eq } from 'drizzle-orm'
import { getInvestDb, assets, priceSnapshots } from '@/lib/invest/db'
import { assetCreateSchema } from '@/lib/invest/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getInvestDb()
  const rows = await db.select().from(assets).orderBy(asc(assets.ticker))

  // Attach the latest price snapshot to each asset
  const withPrices = await Promise.all(
    rows.map(async (asset) => {
      const [latest] = await db
        .select({ price: priceSnapshots.price, date: priceSnapshots.date })
        .from(priceSnapshots)
        .where(eq(priceSnapshots.assetId, asset.id))
        .orderBy(desc(priceSnapshots.date))
        .limit(1)
      return { ...asset, latestPrice: latest ?? null }
    }),
  )

  return NextResponse.json({ assets: withPrices })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = assetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [existing] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.ticker, parsed.data.ticker))
    .limit(1)
  if (existing) {
    return NextResponse.json({ error: `Asset ${parsed.data.ticker} already exists` }, { status: 409 })
  }

  const [created] = await db
    .insert(assets)
    .values({
      ticker: parsed.data.ticker,
      name: parsed.data.name,
      currency: parsed.data.currency,
      exchange: parsed.data.exchange || null,
      sector: parsed.data.sector || null,
      manualPricing: parsed.data.manualPricing,
    })
    .returning()

  return NextResponse.json({ asset: created }, { status: 201 })
}
