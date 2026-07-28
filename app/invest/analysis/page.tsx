import Link from 'next/link'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { getInvestDb, analyses, analysisInputs, assets, fundamentalsSnapshots, priceSnapshots, watchlistItems } from '@/lib/invest/db'
import { formatDate, formatMoney, formatPercentSigned } from '@/lib/invest/format'
import { getFxFactor, BASE_DISPLAY_CURRENCY } from '@/lib/invest/fx/convert'
import { computeValuation } from '@/lib/invest/valuation/compute'
import WatchlistManager, { type WatchlistRow } from '@/components/invest/WatchlistManager'
import RefreshPricesButton from '@/components/invest/RefreshPricesButton'
import AnchorDiscountsButton from '@/components/invest/AnchorDiscountsButton'
import DiversificationBreakdown, { type BreakdownSlice } from '@/components/invest/DiversificationBreakdown'

export const dynamic = 'force-dynamic'

export default async function AnalyzaPage() {
  let rows: Array<{
    id: string
    title: string
    status: string
    fairValue: string | null
    marginOfSafety: string | null
    updatedAt: Date
    assetId: string
    ticker: string
    currency: string
  }> = []
  // Fair value is stored in the asset's native (listing) currency; convert it to
  // the display currency per asset so the list matches the analysis page.
  const fairValueFactor = new Map<string, number>()
  // The list shows the blended fair value (a single DCF is a fragile outlier),
  // computed per analysis in the native currency, plus its margin of safety.
  const blendedByAnalysis = new Map<string, string>()
  const blendedMosByAnalysis = new Map<string, string>()
  // Diversification of the tracked (analysed) assets, by count.
  let sectorSlices: BreakdownSlice[] = []
  let countrySlices: BreakdownSlice[] = []
  let watchRows: WatchlistRow[] = []
  let assetOptions: Array<{ id: string; ticker: string; currency: string }> = []
  let dbError: string | null = null

  try {
    const db = getInvestDb()
    rows = await db
      .select({
        id: analyses.id,
        title: analyses.title,
        status: analyses.status,
        fairValue: analyses.fairValue,
        marginOfSafety: analyses.marginOfSafety,
        updatedAt: analyses.updatedAt,
        assetId: analyses.assetId,
        ticker: assets.ticker,
        currency: assets.currency,
      })
      .from(analyses)
      .innerJoin(assets, eq(analyses.assetId, assets.id))
      .orderBy(desc(analyses.updatedAt))

    // Resolve one FX factor per asset (native data currency → display currency).
    const assetIds = [...new Set(rows.map((r) => r.assetId))]
    if (assetIds.length > 0) {
      const snaps = await db
        .select({ assetId: fundamentalsSnapshots.assetId, data: fundamentalsSnapshots.data, fetchedAt: fundamentalsSnapshots.fetchedAt })
        .from(fundamentalsSnapshots)
        .where(inArray(fundamentalsSnapshots.assetId, assetIds))
        .orderBy(desc(fundamentalsSnapshots.fetchedAt))
      const nativeByAsset = new Map<string, string | null>()
      const sectorByAsset = new Map<string, string>()
      const countryByAsset = new Map<string, string>()
      for (const s of snaps) {
        if (nativeByAsset.has(s.assetId)) continue // first = most recent
        const d = s.data as { currency?: string | null; sector?: string | null; country?: string | null } | null
        nativeByAsset.set(s.assetId, d?.currency ?? null)
        if (d?.sector) sectorByAsset.set(s.assetId, d.sector)
        if (d?.country) countryByAsset.set(s.assetId, d.country)
      }

      // One count per distinct tracked asset → sector/country composition.
      const sectorCount = new Map<string, number>()
      const countryCount = new Map<string, number>()
      const seen = new Set<string>()
      for (const r of rows) {
        if (seen.has(r.assetId)) continue
        seen.add(r.assetId)
        const sec = sectorByAsset.get(r.assetId) || 'Unknown'
        const cty = countryByAsset.get(r.assetId) || 'Unknown'
        sectorCount.set(sec, (sectorCount.get(sec) ?? 0) + 1)
        countryCount.set(cty, (countryCount.get(cty) ?? 0) + 1)
      }
      sectorSlices = [...sectorCount].map(([label, value]) => ({ label, value }))
      countrySlices = [...countryCount].map(([label, value]) => ({ label, value }))
      const factorCache = new Map<string, number>()
      for (const assetId of assetIds) {
        const native = nativeByAsset.get(assetId) ?? null
        const key = native ?? ''
        let factor = factorCache.get(key)
        if (factor === undefined) {
          factor = await getFxFactor(db, native, BASE_DISPLAY_CURRENCY)
          factorCache.set(key, factor)
        }
        fairValueFactor.set(assetId, factor)
      }

      // Blended fair value (+ MoS) per analysis, computed from its inputs and
      // latest price — the same blend shown on the analysis detail page.
      const inputRows = await db
        .select({
          analysisId: analysisInputs.analysisId,
          field: analysisInputs.field,
          fetchedValue: analysisInputs.fetchedValue,
          manualValue: analysisInputs.manualValue,
        })
        .from(analysisInputs)
        .where(inArray(analysisInputs.analysisId, rows.map((r) => r.id)))
      const inputsByAnalysis = new Map<string, Array<{ field: string; fetchedValue: string | null; manualValue: string | null }>>()
      for (const i of inputRows) {
        const arr = inputsByAnalysis.get(i.analysisId) ?? []
        arr.push({ field: i.field, fetchedValue: i.fetchedValue, manualValue: i.manualValue })
        inputsByAnalysis.set(i.analysisId, arr)
      }
      const priceRows = await db
        .select({ assetId: priceSnapshots.assetId, price: priceSnapshots.price, date: priceSnapshots.date })
        .from(priceSnapshots)
        .where(inArray(priceSnapshots.assetId, assetIds))
        .orderBy(desc(priceSnapshots.date))
      const priceByAsset = new Map<string, string>()
      for (const p of priceRows) if (!priceByAsset.has(p.assetId)) priceByAsset.set(p.assetId, p.price)

      for (const r of rows) {
        const inputs = inputsByAnalysis.get(r.id)
        if (!inputs) continue
        const c = computeValuation(inputs, priceByAsset.get(r.assetId) ?? null)
        if (c.blendedFairValue) blendedByAnalysis.set(r.id, c.blendedFairValue)
        if (c.blendedMarginOfSafety) blendedMosByAnalysis.set(r.id, c.blendedMarginOfSafety)
      }
    }

    const watch = await db
      .select({
        id: watchlistItems.id,
        assetId: watchlistItems.assetId,
        targetMos: watchlistItems.targetMos,
        note: watchlistItems.note,
        ticker: assets.ticker,
        name: assets.name,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
      .orderBy(asc(assets.ticker))

    const activeByAsset = new Map<string, string | null>()
    for (const r of await db
      .select({ assetId: analyses.assetId, marginOfSafety: analyses.marginOfSafety, updatedAt: analyses.updatedAt })
      .from(analyses)
      .where(eq(analyses.status, 'active'))
      .orderBy(desc(analyses.updatedAt))) {
      if (!activeByAsset.has(r.assetId)) activeByAsset.set(r.assetId, r.marginOfSafety)
    }

    watchRows = watch.map((w) => ({
      id: w.id,
      assetId: w.assetId,
      ticker: w.ticker,
      name: w.name,
      targetMos: w.targetMos,
      note: w.note,
      currentMos: activeByAsset.get(w.assetId) ?? null,
    }))

    assetOptions = await db
      .select({ id: assets.id, ticker: assets.ticker, currency: assets.currency })
      .from(assets)
      .orderBy(asc(assets.ticker))
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Unknown error'
  }

  if (dbError) {
    return (
      <div className="fin-card">
        <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>Database unavailable: {dbError}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 className="fin-serif" style={{ fontSize: 22, margin: 0 }}>Analyses</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <AnchorDiscountsButton />
          <RefreshPricesButton />
          <Link href="/invest/analysis/new" className="fin-btn fin-btn-primary" style={{ textDecoration: 'none' }}>
            + New analysis
          </Link>
        </div>
      </div>

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <div className="fin-empty">No analyses yet. Create the first one with “+ New analysis”.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Analysis</th>
                <th className="fin-num">Blended value</th>
                <th className="fin-num">MoS</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const blended = blendedByAnalysis.get(r.id)
                const blendedMosRaw = blendedMosByAnalysis.get(r.id)
                const mos = blendedMosRaw !== undefined ? Number(blendedMosRaw) : null
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/invest/analysis/${r.id}`} style={{ color: 'var(--fin-text)', fontWeight: 600, textDecoration: 'none' }}>
                        {r.title}
                      </Link>
                      <div className="fin-subtle fin-mono" style={{ fontSize: 11 }}>{r.ticker}</div>
                    </td>
                    <td className="fin-num fin-gold">
                      {blended
                        ? formatMoney(Number(blended) * (fairValueFactor.get(r.assetId) ?? 1), BASE_DISPLAY_CURRENCY)
                        : '—'}
                    </td>
                    <td className={`fin-num ${mos === null ? 'fin-muted' : mos > 0 ? 'fin-gain' : 'fin-loss'}`}>
                      {mos !== null ? formatPercentSigned(mos) : '—'}
                    </td>
                    <td className="fin-subtle">{formatDate(r.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <section>
          <h3 className="fin-serif" style={{ fontSize: 18, margin: '0 0 12px' }}>Diversification of tracked stocks</h3>
          <div className="fin-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
            <DiversificationBreakdown title="By sector" slices={sectorSlices} unit="count" />
            <DiversificationBreakdown title="By country" slices={countrySlices} unit="count" />
          </div>
        </section>
      )}

      <section>
        <h3 className="fin-serif" style={{ fontSize: 18, margin: '0 0 12px' }}>Watchlist</h3>
        <div className="fin-card">
          <WatchlistManager items={watchRows} assets={assetOptions} />
        </div>
      </section>
    </div>
  )
}
