import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getInvestDb, analyses, assets } from '@/lib/invest/db'
import { latestFundamentals, recomputeAnalysis, refetchAnalysisInputs } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const idSchema = z.uuid()

type Ctx = { params: Promise<{ id: string }> }

// Fetch fresh fundamentals and update ONLY fetched_value of the inputs.
// Manual overrides are never touched; the response carries the diffs for
// the "fetched hodnota se změnila o X %" badges.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const db = getInvestDb()
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1)
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  const [asset] = await db.select().from(assets).where(eq(assets.id, analysis.assetId)).limit(1)
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const { data, fetchedAt } = await latestFundamentals(db, asset.id, asset.ticker, {
    forceFetch: true,
  })
  if (!data || !fetchedAt) {
    return NextResponse.json(
      { error: `Failed to fetch fundamentals for ${asset.ticker}` },
      { status: 502 },
    )
  }

  const diffs = await refetchAnalysisInputs(db, id, data, fetchedAt)
  const computed = await recomputeAnalysis(db, id, asset.id)
  return NextResponse.json({ diffs, computed, fetchedAt })
}
