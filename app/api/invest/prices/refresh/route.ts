import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getInvestDb, analyses, assets, priceSnapshots, watchlistItems } from '@/lib/invest/db'
import { getMarketDataProvider, TickerNotFoundError } from '@/lib/invest/market-data'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function pragueToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// "Refresh prices" button on the Analysis page — pulls fresh quotes for every
// asset that is on the watchlist or has an active analysis, then recomputes
// those analyses so Margin of Safety updates immediately. Mirrors what the
// daily cron does for prices, but on demand and scoped to what's being tracked.
export async function POST() {
  const db = getInvestDb()

  // Assets to refresh: union of watchlisted assets and assets with an active analysis.
  const targetIds = new Set<string>()
  for (const w of await db.select({ assetId: watchlistItems.assetId }).from(watchlistItems)) {
    targetIds.add(w.assetId)
  }
  const activeAnalyses = await db
    .select({ id: analyses.id, assetId: analyses.assetId })
    .from(analyses)
    .where(eq(analyses.status, 'active'))
  for (const a of activeAnalyses) targetIds.add(a.assetId)

  if (targetIds.size === 0) {
    return NextResponse.json({ ok: true, updated: 0, skipped: 0, recomputed: 0, failed: [] })
  }

  const allAssets = await db.select().from(assets)
  const targets = allAssets.filter((a) => targetIds.has(a.id))

  const provider = getMarketDataProvider()
  const today = pragueToday()

  let updated = 0
  let skipped = 0
  const failed: Array<{ ticker: string; error: string }> = []
  const refreshedAssetIds = new Set<string>()

  // Sequential on purpose — the provider throttles itself between calls.
  for (const asset of targets) {
    if (asset.manualPricing) {
      skipped += 1
      continue
    }
    try {
      const quote = await provider.getQuote(asset.ticker)
      await db
        .insert(priceSnapshots)
        .values({ assetId: asset.id, price: String(quote.price), date: today })
        .onConflictDoUpdate({
          target: [priceSnapshots.assetId, priceSnapshots.date],
          set: { price: String(quote.price) },
        })
      refreshedAssetIds.add(asset.id)
      updated += 1
    } catch (e) {
      failed.push({ ticker: asset.ticker, error: errorMessage(e) })
      if (e instanceof TickerNotFoundError) {
        await db.update(assets).set({ needsMapping: true }).where(eq(assets.id, asset.id))
      }
    }
  }

  // Recompute active analyses whose price actually changed, so MoS reflects it.
  let recomputed = 0
  for (const analysis of activeAnalyses) {
    if (!refreshedAssetIds.has(analysis.assetId)) continue
    try {
      await recomputeAnalysis(db, analysis.id, analysis.assetId)
      recomputed += 1
    } catch (e) {
      failed.push({ ticker: `analysis ${analysis.id}`, error: errorMessage(e) })
    }
  }

  return NextResponse.json({ ok: true, updated, skipped, recomputed, failed })
}
