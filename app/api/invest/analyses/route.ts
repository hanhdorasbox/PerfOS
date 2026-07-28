import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getInvestDb, analyses, assets } from '@/lib/invest/db'
import { analysisCreateSchema } from '@/lib/invest/validation'
import { latestFundamentals, recomputeAnalysis, seedAnalysisInputs } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const db = getInvestDb()
  const rows = await db
    .select({
      id: analyses.id,
      title: analyses.title,
      status: analyses.status,
      fairValue: analyses.fairValue,
      marginOfSafety: analyses.marginOfSafety,
      createdAt: analyses.createdAt,
      updatedAt: analyses.updatedAt,
      ticker: assets.ticker,
      assetId: assets.id,
      currency: assets.currency,
    })
    .from(analyses)
    .innerJoin(assets, eq(analyses.assetId, assets.id))
    .orderBy(desc(analyses.updatedAt))
  return NextResponse.json({ analyses: rows })
}

// Create a draft analysis and seed its three-state inputs from fundamentals
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = analysisCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const db = getInvestDb()
  const [asset] = await db.select().from(assets).where(eq(assets.id, parsed.data.assetId)).limit(1)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  let { data, fetchedAt } = await latestFundamentals(db, asset.id, asset.ticker)
  // Snapshots cached before currency capture have no `currency`, which leaves
  // the analysis unable to convert to the display currency (it would show raw
  // USD). Refresh once when it's missing, but keep the cached data if the
  // refresh fails so creation still works offline.
  if (!data || data.currency == null) {
    const fresh = await latestFundamentals(db, asset.id, asset.ticker, { forceFetch: true })
    if (fresh.data) {
      data = fresh.data
      fetchedAt = fresh.fetchedAt
    }
  }

  const [created] = await db
    .insert(analyses)
    .values({ assetId: asset.id, title: parsed.data.title, status: 'draft' })
    .returning()

  await seedAnalysisInputs(db, created.id, data, fetchedAt)
  await recomputeAnalysis(db, created.id, asset.id)

  return NextResponse.json(
    { analysis: created, fundamentalsAvailable: data !== null },
    { status: 201 },
  )
}
