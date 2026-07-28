import { desc, eq } from 'drizzle-orm'
import { fxRates, type InvestDb } from '@/lib/invest/db'
import { fetchCnbDailyRates } from './cnb'

// The currency every stock analysis is shown in. Finnhub reports US names in
// USD, but the analyses are read in EUR — so this is the single conversion
// target, independent of an asset's stored (listing) currency.
export const BASE_DISPLAY_CURRENCY = 'EUR'

// Currency conversion for display. Finnhub reports US stocks in USD, but an
// asset's display currency may be EUR (or CZK) — so the fetched figures need a
// cross rate. All rates are keyed off the CNB fixing (CZK per unit), which the
// daily cron already stores in fx_rates; we fall back to a live fixing when the
// table is empty (e.g. before the first cron run).

/** CZK per one unit of `currency` — latest stored fixing, else live CNB. */
async function czkPerUnit(db: InvestDb, currency: string): Promise<number | null> {
  if (currency === 'CZK') return 1
  const [row] = await db
    .select({ rate: fxRates.rateToCzk })
    .from(fxRates)
    .where(eq(fxRates.currency, currency))
    .orderBy(desc(fxRates.date))
    .limit(1)
  if (row) {
    const n = Number(row.rate)
    if (Number.isFinite(n) && n > 0) return n
  }
  try {
    const fixing = await fetchCnbDailyRates()
    const r = fixing.rates[currency]
    return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null
  } catch {
    return null
  }
}

/**
 * Multiplier that converts an amount in `from` currency into `to` currency.
 * Returns 1 when the currencies match or a rate can't be resolved — so the
 * caller degrades to the raw figure rather than an invented one.
 */
export async function getFxFactor(
  db: InvestDb,
  from: string | null | undefined,
  to: string | null | undefined,
): Promise<number> {
  if (!from || !to || from === to) return 1
  const [f, t] = await Promise.all([czkPerUnit(db, from), czkPerUnit(db, to)])
  if (f === null || t === null || t === 0) return 1
  return f / t
}
