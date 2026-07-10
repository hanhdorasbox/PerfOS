import { desc, eq } from 'drizzle-orm'
import {
  analyses,
  analysisInputs,
  fundamentalsSnapshots,
  priceSnapshots,
  type InvestDb,
} from '@/lib/invest/db'
import { getMarketDataProvider, type FundamentalsData } from '@/lib/invest/market-data'
import { FIELD_DEFS } from './fields'
import { computeValuation, type ComputedValuation } from './compute'

/** Latest stored fundamentals for an asset; fetches fresh ones when none exist. */
export async function latestFundamentals(
  db: InvestDb,
  assetId: string,
  ticker: string,
  opts?: { forceFetch?: boolean },
): Promise<{ data: FundamentalsData | null; fetchedAt: Date | null }> {
  if (!opts?.forceFetch) {
    const [snapshot] = await db
      .select()
      .from(fundamentalsSnapshots)
      .where(eq(fundamentalsSnapshots.assetId, assetId))
      .orderBy(desc(fundamentalsSnapshots.fetchedAt))
      .limit(1)
    if (snapshot) {
      return { data: snapshot.data as FundamentalsData, fetchedAt: snapshot.fetchedAt }
    }
  }

  try {
    const provider = getMarketDataProvider()
    const result = await provider.getFundamentals(ticker)
    // Every fetch is appended as a new snapshot — history is never overwritten
    const [stored] = await db
      .insert(fundamentalsSnapshots)
      .values({ assetId, data: result.data })
      .returning({ fetchedAt: fundamentalsSnapshots.fetchedAt })
    return { data: result.data, fetchedAt: stored.fetchedAt }
  } catch {
    return { data: null, fetchedAt: null }
  }
}

/** Creates the three-state input rows for a fresh analysis. */
export async function seedAnalysisInputs(
  db: InvestDb,
  analysisId: string,
  fundamentals: FundamentalsData | null,
  fetchedAt: Date | null,
): Promise<void> {
  const rows = FIELD_DEFS.map((def) => {
    const fetchedNum = def.fetch && fundamentals ? def.fetch(fundamentals) : null
    return {
      analysisId,
      field: def.key,
      fetchedValue: fetchedNum !== null && fetchedNum !== undefined ? String(fetchedNum) : null,
      // Manual-only fields start from their documented default
      manualValue: def.defaultValue !== undefined ? String(def.defaultValue) : null,
      source: def.fetch ? (def.source ?? 'finnhub') : 'manual',
      snapshotAt: fetchedAt ?? new Date(),
    }
  })
  await db.insert(analysisInputs).values(rows)
}

/**
 * Refreshes fetched_value of all fetched fields from a new fundamentals
 * snapshot. NEVER touches manual_value (spec §3). Returns per-field diffs so
 * the UI can show "fetched hodnota se změnila o X %".
 */
export async function refetchAnalysisInputs(
  db: InvestDb,
  analysisId: string,
  fundamentals: FundamentalsData,
  fetchedAt: Date,
): Promise<Array<{ field: string; previous: string | null; current: string | null; changePct: number | null }>> {
  const existing = await db
    .select()
    .from(analysisInputs)
    .where(eq(analysisInputs.analysisId, analysisId))
  const byField = new Map(existing.map((i) => [i.field, i]))

  const diffs: Array<{ field: string; previous: string | null; current: string | null; changePct: number | null }> = []

  for (const def of FIELD_DEFS) {
    if (!def.fetch) continue
    const row = byField.get(def.key)
    if (!row) continue
    const next = def.fetch(fundamentals)
    const nextValue = next !== null && next !== undefined ? String(next) : null
    if (nextValue === row.fetchedValue) continue

    const prevNum = row.fetchedValue !== null ? Number(row.fetchedValue) : null
    const nextNum = nextValue !== null ? Number(nextValue) : null
    diffs.push({
      field: def.key,
      previous: row.fetchedValue,
      current: nextValue,
      changePct:
        prevNum !== null && nextNum !== null && prevNum !== 0
          ? (nextNum - prevNum) / Math.abs(prevNum)
          : null,
    })
    await db
      .update(analysisInputs)
      .set({ fetchedValue: nextValue, snapshotAt: fetchedAt })
      .where(eq(analysisInputs.id, row.id))
  }
  return diffs
}

/** Recomputes fair value + MoS from current inputs and persists them on the analysis. */
export async function recomputeAnalysis(
  db: InvestDb,
  analysisId: string,
  assetId: string,
): Promise<ComputedValuation> {
  const inputs = await db
    .select()
    .from(analysisInputs)
    .where(eq(analysisInputs.analysisId, analysisId))

  const [latestPrice] = await db
    .select({ price: priceSnapshots.price })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.assetId, assetId))
    .orderBy(desc(priceSnapshots.date))
    .limit(1)

  const computed = computeValuation(inputs, latestPrice?.price ?? null)

  await db
    .update(analyses)
    .set({
      fairValue: computed.fairValue,
      marginOfSafety: computed.marginOfSafety,
      updatedAt: new Date(),
    })
    .where(eq(analyses.id, analysisId))

  return computed
}
