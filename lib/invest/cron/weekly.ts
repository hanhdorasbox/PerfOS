import { eq, inArray } from 'drizzle-orm'
import {
  getInvestDb,
  analyses,
  assets,
  cronRuns,
  fundamentalsSnapshots,
  positions,
  watchlistItems,
} from '@/lib/invest/db'
import { getMarketDataProvider } from '@/lib/invest/market-data'
import { refetchAnalysisInputs } from '@/lib/invest/valuation/service'

export interface WeeklyRunResult {
  fundamentalsFetched: number
  failed: Array<{ ticker: string; error: string }>
  inputsRefreshed: number
}

/**
 * Weekly job (Friday evening): fundamentals change slowly, fetching them
 * weekly instead of daily spares the Finnhub rate limit (spec §8).
 * Every fetch appends a new fundamentals_snapshots row; analysis inputs get
 * only their fetched_value refreshed — manual overrides stay untouched.
 */
export async function runWeeklyCron(): Promise<WeeklyRunResult> {
  const db = getInvestDb()
  const [run] = await db
    .insert(cronRuns)
    .values({ job: 'weekly', status: 'running' })
    .returning({ id: cronRuns.id })

  const result: WeeklyRunResult = { fundamentalsFetched: 0, failed: [], inputsRefreshed: 0 }

  try {
    // Assets worth refreshing: open positions ∪ watchlist ∪ non-archived analyses
    const [posRows, watchRows, analysisRows] = await Promise.all([
      db
        .select({ assetId: positions.assetId })
        .from(positions)
        .where(eq(positions.status, 'open')),
      db.select({ assetId: watchlistItems.assetId }).from(watchlistItems),
      db.select({ assetId: analyses.assetId, id: analyses.id, status: analyses.status }).from(analyses),
    ])
    const assetIds = [
      ...new Set([
        ...posRows.map((r) => r.assetId),
        ...watchRows.map((r) => r.assetId),
        ...analysisRows.filter((r) => r.status !== 'archived').map((r) => r.assetId),
      ]),
    ]

    const targets = assetIds.length
      ? (await db.select().from(assets).where(inArray(assets.id, assetIds))).filter(
          (a) => !a.manualPricing,
        )
      : []

    const provider = getMarketDataProvider()
    for (const asset of targets) {
      try {
        const fundamentals = await provider.getFundamentals(asset.ticker)
        const [stored] = await db
          .insert(fundamentalsSnapshots)
          .values({ assetId: asset.id, data: fundamentals.data })
          .returning({ fetchedAt: fundamentalsSnapshots.fetchedAt })
        result.fundamentalsFetched += 1

        // Refresh fetched_value of this asset's non-archived analyses
        const assetAnalyses = analysisRows.filter(
          (r) => r.assetId === asset.id && r.status !== 'archived',
        )
        for (const analysis of assetAnalyses) {
          await refetchAnalysisInputs(db, analysis.id, fundamentals.data, stored.fetchedAt)
          result.inputsRefreshed += 1
        }
      } catch (e) {
        result.failed.push({
          ticker: asset.ticker,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: result.failed.length === 0 ? 'success' : 'error',
        error:
          result.failed.length > 0
            ? result.failed.map((f) => `${f.ticker}: ${f.error}`).join(' | ').slice(0, 2000)
            : null,
      })
      .where(eq(cronRuns.id, run.id))

    return result
  } catch (e) {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: 'error',
        error: (e instanceof Error ? e.message : String(e)).slice(0, 2000),
      })
      .where(eq(cronRuns.id, run.id))
    throw e
  }
}
