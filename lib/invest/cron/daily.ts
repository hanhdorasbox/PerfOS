import { eq } from 'drizzle-orm'
import { getInvestDb, analyses, assets, cronRuns, fxRates, priceSnapshots } from '@/lib/invest/db'
import { getMarketDataProvider, TickerNotFoundError } from '@/lib/invest/market-data'
import { fetchCnbDailyRates } from '@/lib/invest/fx/cnb'
import { syncTrading212 } from '@/lib/invest/sync/trading212'
import { recomputeAnalysis } from '@/lib/invest/valuation/service'

export interface DailyRunResult {
  t212Synced: boolean
  pricesFetched: number
  pricesFailed: Array<{ ticker: string; error: string }>
  fxStored: string[]
  analysesRecomputed: number
  errors: string[]
}

function pragueToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Daily job, step by step (spec §8). Runs everything it can even when a
 * single asset fails, and always finishes its cron_runs row.
 *
 *   0. Trading212 sync                  — Phase 3
 *   1. prices for all non-manual assets — implemented
 *   2. FX rates (CNB fixing → fx_rates) — implemented
 *   3. portfolio value / weights / P&L  — Phase 3
 *   4. margin of safety recompute       — Phase 4
 *   5. alert rules evaluation           — Phase 5
 */
export async function runDailyCron(): Promise<DailyRunResult> {
  const db = getInvestDb()
  const [run] = await db
    .insert(cronRuns)
    .values({ job: 'daily', status: 'running' })
    .returning({ id: cronRuns.id })

  const result: DailyRunResult = {
    t212Synced: false,
    pricesFetched: 0,
    pricesFailed: [],
    fxStored: [],
    analysesRecomputed: 0,
    errors: [],
  }

  try {
    // ── 0. Trading212 sync — an outage must not stop the price fetch;
    //       the dashboard then shows how stale the T212 data is ──────────
    if (process.env.T212_API_KEY) {
      try {
        await syncTrading212()
        result.t212Synced = true
      } catch (e) {
        result.errors.push(`T212 sync: ${errorMessage(e)}`)
      }
    }

    // ── 1. Prices — sequential fetch, the provider throttles itself ──────
    const provider = getMarketDataProvider()
    const today = pragueToday()
    const allAssets = await db.select().from(assets)
    const autoPriced = allAssets.filter((a) => !a.manualPricing)

    for (const asset of autoPriced) {
      try {
        const quote = await provider.getQuote(asset.ticker)
        await db
          .insert(priceSnapshots)
          .values({ assetId: asset.id, price: String(quote.price), date: today })
          .onConflictDoUpdate({
            target: [priceSnapshots.assetId, priceSnapshots.date],
            set: { price: String(quote.price) },
          })
        result.pricesFetched += 1
      } catch (e) {
        result.pricesFailed.push({ ticker: asset.ticker, error: errorMessage(e) })
        if (e instanceof TickerNotFoundError) {
          // Surface it in settings — likely needs manual pricing or a mapping fix
          await db.update(assets).set({ needsMapping: true }).where(eq(assets.id, asset.id))
        }
      }
    }

    // ── 2. FX rates — store CZK fixing for every non-CZK asset currency ──
    try {
      const currencies = [...new Set(allAssets.map((a) => a.currency).filter((c) => c !== 'CZK'))]
      // Always keep USD & EUR fresh so portfolio conversion never lacks a rate
      for (const c of ['USD', 'EUR']) if (!currencies.includes(c)) currencies.push(c)

      const fixing = await fetchCnbDailyRates()
      for (const currency of currencies) {
        const rate = fixing.rates[currency]
        if (rate === undefined) {
          result.errors.push(`CNB fixing missing currency ${currency}`)
          continue
        }
        await db
          .insert(fxRates)
          .values({ currency, rateToCzk: String(rate), date: fixing.date })
          .onConflictDoUpdate({
            target: [fxRates.currency, fxRates.date],
            set: { rateToCzk: String(rate) },
          })
        result.fxStored.push(currency)
      }
    } catch (e) {
      result.errors.push(`FX: ${errorMessage(e)}`)
    }

    // ── 4. Recompute fair value + margin of safety of active analyses ────
    try {
      const activeAnalyses = await db
        .select({ id: analyses.id, assetId: analyses.assetId })
        .from(analyses)
        .where(eq(analyses.status, 'active'))
      for (const analysis of activeAnalyses) {
        try {
          await recomputeAnalysis(db, analysis.id, analysis.assetId)
          result.analysesRecomputed += 1
        } catch (e) {
          result.errors.push(`analysis ${analysis.id}: ${errorMessage(e)}`)
        }
      }
    } catch (e) {
      result.errors.push(`analyses: ${errorMessage(e)}`)
    }

    // Step 5 (alert rules evaluation) arrives in Phase 5.

    const failures = [
      ...result.errors,
      ...result.pricesFailed.map((f) => `${f.ticker}: ${f.error}`),
    ]
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: failures.length === 0 ? 'success' : 'error',
        error: failures.length > 0 ? failures.join(' | ').slice(0, 2000) : null,
      })
      .where(eq(cronRuns.id, run.id))

    return result
  } catch (e) {
    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), status: 'error', error: errorMessage(e).slice(0, 2000) })
      .where(eq(cronRuns.id, run.id))
    throw e
  }
}
