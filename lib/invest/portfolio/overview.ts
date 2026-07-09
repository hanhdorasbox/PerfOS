import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import Decimal from 'decimal.js'
import {
  getInvestDb,
  analyses,
  assets,
  cashBalances,
  fxRates,
  positions,
  priceSnapshots,
  syncRuns,
  transactions,
  type CashBalance,
  type SyncRun,
} from '@/lib/invest/db'
import { computeHolding, toCzk, valuePosition } from '@/lib/invest/portfolio/calc'

export interface PositionOverview {
  positionId: string
  assetId: string
  ticker: string
  name: string
  currency: string
  sector: string | null
  manualPricing: boolean
  quantity: string
  avgCost: string
  currentPrice: string | null
  priceDate: string | null
  marketValue: string | null
  marketValueCzk: string | null
  unrealizedPnl: string | null
  unrealizedPnlPct: string | null
  dailyPnl: string | null
  dailyPnlPct: string | null
  weight: string | null
  fairValue: string | null
  marginOfSafety: string | null
  analysisId: string | null
}

export interface PortfolioOverview {
  positions: PositionOverview[]
  totalValueCzk: string | null
  totalUnrealizedPnlCzk: string | null
  totalDailyPnlCzk: string | null
  cash: Array<Pick<CashBalance, 'id' | 'currency' | 'amount' | 'source' | 'updatedAt'>>
  cashTotalCzk: string | null
  fxMissing: string[]
  lastSync: Pick<SyncRun, 'id' | 'startedAt' | 'finishedAt' | 'status' | 'warnings'> | null
  /** Hours since the last successful sync, null when none yet */
  syncAgeHours: number | null
}

/** Latest CZK rate per currency. */
async function loadFxMap(): Promise<Record<string, string>> {
  const db = getInvestDb()
  const rows = await db
    .select({
      currency: fxRates.currency,
      rateToCzk: fxRates.rateToCzk,
      rn: sql<number>`row_number() over (partition by ${fxRates.currency} order by ${fxRates.date} desc)`,
    })
    .from(fxRates)
  const map: Record<string, string> = {}
  for (const row of rows) {
    if (Number(row.rn) === 1) map[row.currency] = row.rateToCzk
  }
  return map
}

export async function loadPortfolioOverview(): Promise<PortfolioOverview> {
  const db = getInvestDb()

  const openPositions = await db
    .select({
      positionId: positions.id,
      assetId: positions.assetId,
      ticker: assets.ticker,
      name: assets.name,
      currency: assets.currency,
      sector: assets.sector,
      manualPricing: assets.manualPricing,
    })
    .from(positions)
    .innerJoin(assets, eq(positions.assetId, assets.id))
    .where(eq(positions.status, 'open'))

  const positionIds = openPositions.map((p) => p.positionId)
  const allTxs = positionIds.length
    ? await db.select().from(transactions).where(inArray(transactions.positionId, positionIds))
    : []

  const assetIds = openPositions.map((p) => p.assetId)
  const priceRows = assetIds.length
    ? await db
        .select({
          assetId: priceSnapshots.assetId,
          price: priceSnapshots.price,
          date: priceSnapshots.date,
          rn: sql<number>`row_number() over (partition by ${priceSnapshots.assetId} order by ${priceSnapshots.date} desc)`,
        })
        .from(priceSnapshots)
        .where(inArray(priceSnapshots.assetId, assetIds))
    : []
  const latestPrice = new Map<string, { price: string; date: string }>()
  const previousPrice = new Map<string, string>()
  for (const row of priceRows) {
    const rn = Number(row.rn)
    if (rn === 1) latestPrice.set(row.assetId, { price: row.price, date: row.date })
    if (rn === 2) previousPrice.set(row.assetId, row.price)
  }

  const activeAnalyses = assetIds.length
    ? await db
        .select({
          id: analyses.id,
          assetId: analyses.assetId,
          fairValue: analyses.fairValue,
          marginOfSafety: analyses.marginOfSafety,
          updatedAt: analyses.updatedAt,
        })
        .from(analyses)
        .where(and(inArray(analyses.assetId, assetIds), eq(analyses.status, 'active')))
        .orderBy(desc(analyses.updatedAt))
    : []
  const analysisByAsset = new Map<string, (typeof activeAnalyses)[number]>()
  for (const a of activeAnalyses) {
    if (!analysisByAsset.has(a.assetId)) analysisByAsset.set(a.assetId, a)
  }

  const fx = await loadFxMap()
  const fxMissing: string[] = []

  let totalValueCzk = new Decimal(0)
  let totalPnlCzk = new Decimal(0)
  let totalDailyCzk = new Decimal(0)
  let anyValue = false

  const rows: PositionOverview[] = openPositions.map((p) => {
    const txs = allTxs.filter((t) => t.positionId === p.positionId)
    const holding = computeHolding(txs.filter((t) => t.type === 'buy' || t.type === 'sell'))
    const price = latestPrice.get(p.assetId) ?? null
    const prev = previousPrice.get(p.assetId) ?? null

    let marketValue: Decimal | null = null
    let marketValueCzk: Decimal | null = null
    let unrealizedPnl: Decimal | null = null
    let unrealizedPnlPct: Decimal | null = null
    let dailyPnl: Decimal | null = null
    let dailyPnlPct: Decimal | null = null

    if (price) {
      const valuation = valuePosition(holding, price.price)
      marketValue = valuation.marketValue
      unrealizedPnl = valuation.unrealizedPnl
      unrealizedPnlPct = valuation.unrealizedPnlPct
      marketValueCzk = toCzk(marketValue, p.currency, fx)
      if (marketValueCzk === null) {
        if (!fxMissing.includes(p.currency)) fxMissing.push(p.currency)
      } else {
        totalValueCzk = totalValueCzk.plus(marketValueCzk)
        const pnlCzk = toCzk(unrealizedPnl, p.currency, fx)
        if (pnlCzk) totalPnlCzk = totalPnlCzk.plus(pnlCzk)
        anyValue = true
      }
      if (prev) {
        dailyPnl = holding.quantity.times(new Decimal(price.price).minus(prev))
        dailyPnlPct = new Decimal(prev).gt(0)
          ? new Decimal(price.price).minus(prev).div(prev)
          : null
        const dailyCzk = toCzk(dailyPnl, p.currency, fx)
        if (dailyCzk) totalDailyCzk = totalDailyCzk.plus(dailyCzk)
      }
    }

    const analysis = analysisByAsset.get(p.assetId) ?? null

    return {
      positionId: p.positionId,
      assetId: p.assetId,
      ticker: p.ticker,
      name: p.name,
      currency: p.currency,
      sector: p.sector,
      manualPricing: p.manualPricing,
      quantity: holding.quantity.toString(),
      avgCost: holding.avgCost.toFixed(4),
      currentPrice: price?.price ?? null,
      priceDate: price?.date ?? null,
      marketValue: marketValue?.toFixed(2) ?? null,
      marketValueCzk: marketValueCzk?.toFixed(2) ?? null,
      unrealizedPnl: unrealizedPnl?.toFixed(2) ?? null,
      unrealizedPnlPct: unrealizedPnlPct?.toFixed(4) ?? null,
      dailyPnl: dailyPnl?.toFixed(2) ?? null,
      dailyPnlPct: dailyPnlPct?.toFixed(4) ?? null,
      weight: null, // filled below once the total is known
      fairValue: analysis?.fairValue ?? null,
      marginOfSafety: analysis?.marginOfSafety ?? null,
      analysisId: analysis?.id ?? null,
    }
  })

  for (const row of rows) {
    if (row.marketValueCzk !== null && totalValueCzk.gt(0)) {
      row.weight = new Decimal(row.marketValueCzk).div(totalValueCzk).toFixed(4)
    }
  }
  rows.sort((a, b) => Number(b.marketValueCzk ?? 0) - Number(a.marketValueCzk ?? 0))

  // ── Cash ──────────────────────────────────────────────────────────────
  const cashRows = await db
    .select({
      id: cashBalances.id,
      currency: cashBalances.currency,
      amount: cashBalances.amount,
      source: cashBalances.source,
      updatedAt: cashBalances.updatedAt,
    })
    .from(cashBalances)
  let cashTotalCzk: Decimal | null = new Decimal(0)
  for (const row of cashRows) {
    const czk = toCzk(new Decimal(row.amount), row.currency, fx)
    if (czk === null) {
      if (!fxMissing.includes(row.currency)) fxMissing.push(row.currency)
      cashTotalCzk = null
      break
    }
    cashTotalCzk = cashTotalCzk.plus(czk)
  }

  // ── Last sync ─────────────────────────────────────────────────────────
  const [lastSync] = await db
    .select({
      id: syncRuns.id,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt,
      status: syncRuns.status,
      warnings: syncRuns.warnings,
    })
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)
  const [lastSuccess] = await db
    .select({ finishedAt: syncRuns.finishedAt })
    .from(syncRuns)
    .where(eq(syncRuns.status, 'success'))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)

  return {
    positions: rows,
    totalValueCzk: anyValue ? totalValueCzk.toFixed(2) : null,
    totalUnrealizedPnlCzk: anyValue ? totalPnlCzk.toFixed(2) : null,
    totalDailyPnlCzk: anyValue ? totalDailyCzk.toFixed(2) : null,
    cash: cashRows,
    cashTotalCzk: cashTotalCzk?.toFixed(2) ?? null,
    fxMissing,
    lastSync: lastSync ?? null,
    syncAgeHours: lastSuccess?.finishedAt
      ? Math.floor((Date.now() - lastSuccess.finishedAt.getTime()) / 3_600_000)
      : null,
  }
}
