import { and, eq, inArray, sql } from 'drizzle-orm'
import Decimal from 'decimal.js'
import {
  getInvestDb,
  assets,
  cashBalances,
  positions,
  syncRuns,
  t212Instruments,
  transactions,
  type InvestDb,
} from '@/lib/invest/db'
import { T212Client, type T212Instrument } from '@/lib/invest/t212/client'
import { computeHolding } from '@/lib/invest/portfolio/calc'

const INSTRUMENTS_CACHE_DAYS = 7

export interface ReconciliationWarning {
  ticker: string
  field: 'quantity' | 'averagePrice' | 'missing_local' | 'missing_remote'
  local: string | null
  remote: string | null
}

export interface SyncResult {
  ordersImported: number
  dividendsImported: number
  warnings: ReconciliationWarning[]
  needsMapping: string[]
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Maps a T212 instrument code to a standard ticker (for Finnhub etc.).
 * shortName from the instruments metadata is authoritative; the `_US_EQ`
 * suffix strip is a fallback for US equities only. Anything else is left
 * for manual pairing (needs_mapping).
 */
export function mapToStandardTicker(
  t212Ticker: string,
  instrument: T212Instrument | undefined,
): { ticker: string; confident: boolean } {
  if (instrument?.shortName) {
    // US listings map 1:1; other exchanges keep shortName but need review
    const confident = /_US_EQ$/.test(t212Ticker)
    return { ticker: instrument.shortName, confident }
  }
  const usMatch = t212Ticker.match(/^([A-Za-z0-9.]+)_US_EQ$/)
  if (usMatch) return { ticker: usMatch[1], confident: true }
  return { ticker: t212Ticker, confident: false }
}

async function refreshInstrumentsCache(db: InvestDb, client: T212Client): Promise<void> {
  const [newest] = await db
    .select({ fetchedAt: t212Instruments.fetchedAt })
    .from(t212Instruments)
    .orderBy(sql`${t212Instruments.fetchedAt} DESC`)
    .limit(1)

  const staleBefore = Date.now() - INSTRUMENTS_CACHE_DAYS * 86_400_000
  if (newest && newest.fetchedAt.getTime() > staleBefore) return

  const instruments = await client.getInstruments()
  // Upsert in chunks — the full list has thousands of rows
  const now = new Date()
  for (let i = 0; i < instruments.length; i += 500) {
    const chunk = instruments.slice(i, i + 500)
    await db
      .insert(t212Instruments)
      .values(
        chunk.map((inst) => ({
          t212Ticker: inst.ticker,
          name: inst.name,
          shortName: inst.shortName,
          isin: inst.isin,
          currency: inst.currencyCode,
          type: inst.type,
          fetchedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: t212Instruments.t212Ticker,
        set: {
          name: sql`excluded.name`,
          shortName: sql`excluded.short_name`,
          isin: sql`excluded.isin`,
          currency: sql`excluded.currency`,
          type: sql`excluded.type`,
          fetchedAt: now,
        },
      })
  }
}

async function loadInstrumentMap(
  db: InvestDb,
  t212Tickers: string[],
): Promise<Map<string, T212Instrument>> {
  if (t212Tickers.length === 0) return new Map()
  const rows = await db
    .select()
    .from(t212Instruments)
    .where(inArray(t212Instruments.t212Ticker, t212Tickers))
  return new Map(
    rows.map((r) => [
      r.t212Ticker,
      {
        ticker: r.t212Ticker,
        name: r.name,
        shortName: r.shortName,
        isin: r.isin,
        currencyCode: r.currency,
        type: r.type,
      },
    ]),
  )
}

/** Finds an asset by t212_ticker, or adopts/creates one. Never overwrites manual data. */
async function ensureAssetForT212(
  db: InvestDb,
  t212Ticker: string,
  instrument: T212Instrument | undefined,
  needsMappingOut: string[],
): Promise<typeof assets.$inferSelect> {
  const [byT212] = await db.select().from(assets).where(eq(assets.t212Ticker, t212Ticker)).limit(1)
  if (byT212) return byT212

  const { ticker, confident } = mapToStandardTicker(t212Ticker, instrument)

  // An asset with the standard ticker may already exist (created manually) —
  // attach the T212 code to it instead of duplicating.
  const [byTicker] = await db.select().from(assets).where(eq(assets.ticker, ticker)).limit(1)
  if (byTicker) {
    const [updated] = await db
      .update(assets)
      .set({ t212Ticker, needsMapping: byTicker.needsMapping || !confident })
      .where(eq(assets.id, byTicker.id))
      .returning()
    if (!confident) needsMappingOut.push(t212Ticker)
    return updated
  }

  if (!confident) needsMappingOut.push(t212Ticker)
  const [created] = await db
    .insert(assets)
    .values({
      ticker,
      name: instrument?.name ?? ticker,
      currency: instrument?.currencyCode ?? 'USD',
      manualPricing: false,
      t212Ticker,
      needsMapping: !confident,
    })
    .returning()
  return created
}

async function ensureOpenPosition(db: InvestDb, assetId: string, openedAt: Date) {
  const [existing] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.assetId, assetId), eq(positions.status, 'open')))
    .limit(1)
  if (existing) return existing
  const [created] = await db
    .insert(positions)
    .values({ assetId, status: 'open', openedAt })
    .returning()
  return created
}

/**
 * Idempotent T212 sync (spec §4b): orders/dividends keyed by external_id so
 * a re-run never duplicates; positions are reconstructed from transactions
 * and /portfolio serves only as a reconciliation check.
 */
export async function syncTrading212(): Promise<SyncResult> {
  const db = getInvestDb()
  const [run] = await db
    .insert(syncRuns)
    .values({ status: 'running' })
    .returning({ id: syncRuns.id })

  try {
    const client = new T212Client()
    const result: SyncResult = {
      ordersImported: 0,
      dividendsImported: 0,
      warnings: [],
      needsMapping: [],
    }

    await refreshInstrumentsCache(db, client)

    const summary = await client.getAccountSummary().catch(() => ({ currencyCode: null, id: null }))
    const accountCurrency = summary.currencyCode ?? 'EUR'

    // ── Orders → transactions ────────────────────────────────────────────
    const orders = await client.getOrderHistory()
    const filled = orders.filter(
      (o) => (o.status ?? '').toUpperCase() === 'FILLED' && (o.filledQuantity ?? 0) !== 0,
    )
    const instrumentMap = await loadInstrumentMap(db, [
      ...new Set([...filled.map((o) => o.ticker)]),
    ])

    for (const order of filled) {
      const externalId = `t212-order:${order.id}`
      const [dupe] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.externalId, externalId))
        .limit(1)
      if (dupe) continue

      const instrument = instrumentMap.get(order.ticker)
      const asset = await ensureAssetForT212(db, order.ticker, instrument, result.needsMapping)
      const qty = new Decimal(order.filledQuantity ?? 0)
      const executedAt = new Date(order.dateModified ?? order.dateCreated ?? Date.now())
      const position = await ensureOpenPosition(db, asset.id, executedAt)
      const amount =
        order.filledValue !== null
          ? new Decimal(order.filledValue).abs()
          : qty.abs().times(order.fillPrice ?? 0)

      await db
        .insert(transactions)
        .values({
          positionId: position.id,
          type: qty.gt(0) ? 'buy' : 'sell',
          quantity: qty.abs().toString(),
          price: order.fillPrice !== null ? String(order.fillPrice) : null,
          amount: amount.toString(),
          currency: asset.currency,
          executedAt,
          externalId,
          source: 't212',
          note: order.type,
        })
        .onConflictDoNothing({ target: transactions.externalId })
      result.ordersImported += 1
    }

    // ── Dividends → transactions ─────────────────────────────────────────
    const dividends = await client.getDividends()
    const divInstrumentMap = await loadInstrumentMap(db, [
      ...new Set(dividends.map((d) => d.ticker)),
    ])
    for (const dividend of dividends) {
      const externalId = `t212-div:${dividend.reference}`
      const [dupe] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.externalId, externalId))
        .limit(1)
      if (dupe) continue

      const instrument = divInstrumentMap.get(dividend.ticker)
      const asset = await ensureAssetForT212(db, dividend.ticker, instrument, result.needsMapping)
      const executedAt = new Date(dividend.paidOn ?? Date.now())
      const position = await ensureOpenPosition(db, asset.id, executedAt)

      await db
        .insert(transactions)
        .values({
          positionId: position.id,
          type: 'dividend',
          quantity: dividend.quantity !== null ? String(dividend.quantity) : null,
          price: null,
          // T212 reports the dividend amount in the account currency
          amount: String(dividend.amount ?? 0),
          currency: accountCurrency,
          executedAt,
          externalId,
          source: 't212',
          note: dividend.type,
        })
        .onConflictDoNothing({ target: transactions.externalId })
      result.dividendsImported += 1
    }

    // ── Reconciliation: reconstructed positions vs. T212 /portfolio ──────
    const remote = await client.getPortfolio()
    const remoteByT212 = new Map(remote.map((p) => [p.ticker, p]))

    const syncedAssets = await db
      .select()
      .from(assets)
      .where(sql`${assets.t212Ticker} IS NOT NULL`)

    for (const asset of syncedAssets) {
      const assetPositions = await db
        .select({ id: positions.id })
        .from(positions)
        .where(eq(positions.assetId, asset.id))
      const positionIds = assetPositions.map((p) => p.id)
      const txs = positionIds.length
        ? await db.select().from(transactions).where(inArray(transactions.positionId, positionIds))
        : []
      const holding = computeHolding(
        txs.filter((t) => t.type === 'buy' || t.type === 'sell'),
      )

      // Close/reopen positions according to the reconstructed quantity
      if (positionIds.length > 0) {
        if (holding.quantity.lte(0)) {
          await db
            .update(positions)
            .set({ status: 'closed', closedAt: new Date() })
            .where(and(inArray(positions.id, positionIds), eq(positions.status, 'open')))
        } else {
          await db
            .update(positions)
            .set({ status: 'open', closedAt: null })
            .where(inArray(positions.id, positionIds))
        }
      }

      const remotePos = asset.t212Ticker ? remoteByT212.get(asset.t212Ticker) : undefined
      const localQty = holding.quantity
      const remoteQty = new Decimal(remotePos?.quantity ?? 0)

      if (!remotePos && localQty.gt(0)) {
        result.warnings.push({
          ticker: asset.ticker,
          field: 'missing_remote',
          local: localQty.toString(),
          remote: null,
        })
        continue
      }
      if (remotePos) {
        if (remoteQty.minus(localQty).abs().gt('0.0001')) {
          result.warnings.push({
            ticker: asset.ticker,
            field: 'quantity',
            local: localQty.toString(),
            remote: remoteQty.toString(),
          })
        } else if (
          remotePos.averagePrice !== null &&
          localQty.gt(0) &&
          holding.avgCost.gt(0) &&
          new Decimal(remotePos.averagePrice)
            .minus(holding.avgCost)
            .abs()
            .div(remotePos.averagePrice)
            .gt('0.01')
        ) {
          result.warnings.push({
            ticker: asset.ticker,
            field: 'averagePrice',
            local: holding.avgCost.toFixed(4),
            remote: String(remotePos.averagePrice),
          })
        }
      }
    }

    // Remote positions we have no local asset/transactions for at all
    for (const [t212Ticker, pos] of remoteByT212) {
      const known = syncedAssets.some((a) => a.t212Ticker === t212Ticker)
      if (!known && pos.quantity !== 0) {
        result.warnings.push({
          ticker: t212Ticker,
          field: 'missing_local',
          local: null,
          remote: String(pos.quantity),
        })
      }
    }

    // ── Cash → cash_balances (source: t212) ──────────────────────────────
    const cash = await client.getAccountCash()
    if (cash.free !== null) {
      const [existing] = await db
        .select()
        .from(cashBalances)
        .where(and(eq(cashBalances.currency, accountCurrency), eq(cashBalances.source, 't212')))
        .limit(1)
      if (existing) {
        await db
          .update(cashBalances)
          .set({ amount: String(cash.free), updatedAt: new Date() })
          .where(eq(cashBalances.id, existing.id))
      } else {
        await db
          .insert(cashBalances)
          .values({ currency: accountCurrency, amount: String(cash.free), source: 't212' })
      }
    }

    await db
      .update(syncRuns)
      .set({
        finishedAt: new Date(),
        status: 'success',
        ordersImported: result.ordersImported,
        dividendsImported: result.dividendsImported,
        warnings: result.warnings.length > 0 ? result.warnings : null,
      })
      .where(eq(syncRuns.id, run.id))

    return result
  } catch (e) {
    await db
      .update(syncRuns)
      .set({ finishedAt: new Date(), status: 'error', error: errorMessage(e).slice(0, 2000) })
      .where(eq(syncRuns.id, run.id))
    throw e
  }
}
