import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { getInvestDb, analyses, assets, fundamentalsSnapshots } from '@/lib/invest/db'
import { latestFundamentals } from '@/lib/invest/valuation/service'
import type { FundamentalsData } from '@/lib/invest/market-data'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Backfills company metadata (sector, country, logo, currency) by refetching
// fundamentals for tracked assets whose latest snapshot predates that capture.
// It's throttled (~2 provider calls/asset), so it processes a bounded batch and
// reports how many remain — click again to finish. Only the fundamentals
// SNAPSHOT is refreshed; analysis inputs and their overrides are left untouched.
const BATCH = 18

export async function POST() {
  const db = getInvestDb()

  // Assets that have an analysis and can be priced by the provider.
  const analysed = await db
    .selectDistinct({ id: assets.id, ticker: assets.ticker, needsMapping: assets.needsMapping, manualPricing: assets.manualPricing })
    .from(analyses)
    .innerJoin(assets, eq(analyses.assetId, assets.id))
  const candidates = analysed.filter((a) => !a.needsMapping && !a.manualPricing)

  // Which already have sector+country in their latest snapshot? Skip them.
  const done = new Set<string>()
  if (candidates.length > 0) {
    const snaps = await db
      .select({ assetId: fundamentalsSnapshots.assetId, data: fundamentalsSnapshots.data, fetchedAt: fundamentalsSnapshots.fetchedAt })
      .from(fundamentalsSnapshots)
      .where(inArray(fundamentalsSnapshots.assetId, candidates.map((a) => a.id)))
      .orderBy(desc(fundamentalsSnapshots.fetchedAt))
    const seen = new Set<string>()
    for (const s of snaps) {
      if (seen.has(s.assetId)) continue
      seen.add(s.assetId)
      const d = s.data as { sector?: string | null; country?: string | null } | null
      if (d?.sector && d?.country) done.add(s.assetId)
    }
  }

  const todo = candidates.filter((a) => !done.has(a.id))
  const batch = todo.slice(0, BATCH)

  let refreshed = 0
  const failed: string[] = []
  for (const a of batch) {
    const { data } = await latestFundamentals(db, a.id, a.ticker, { forceFetch: true })
    if (data && (data as FundamentalsData).currency !== undefined) refreshed += 1
    else failed.push(a.ticker)
  }

  return NextResponse.json({
    refreshed,
    failed,
    remaining: Math.max(0, todo.length - batch.length),
  })
}
