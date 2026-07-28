import Link from 'next/link'
import { desc, eq, inArray } from 'drizzle-orm'
import { getInvestDb, analyses, analysisInputs, assets, fundamentalsSnapshots, priceSnapshots, watchlistItems } from '@/lib/invest/db'
import { formatDate, formatMoney, formatPercentSigned } from '@/lib/invest/format'
import { getFxFactor, BASE_DISPLAY_CURRENCY } from '@/lib/invest/fx/convert'
import { computeValuation } from '@/lib/invest/valuation/compute'
import RefreshPricesButton from '@/components/invest/RefreshPricesButton'
import AnchorDiscountsButton from '@/components/invest/AnchorDiscountsButton'
import DiversificationBreakdown, { type BreakdownSlice } from '@/components/invest/DiversificationBreakdown'
import TargetMosCells from '@/components/invest/TargetMosCells'

export const dynamic = 'force-dynamic'

// Brand logo (from Finnhub) or a monogram fallback, shown left of the ticker.
function AssetGlyph({ ticker, logo }: { ticker: string; logo: string | null }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt=""
        width={22}
        height={22}
        style={{ borderRadius: 5, objectFit: 'contain', background: '#fff', flexShrink: 0 }}
      />
    )
  }
  const initials = ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        background: '#2a2a31',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: '#c9c9d0',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

export default async function AnalyzaPage() {
  let rows: Array<{
    id: string
    updatedAt: Date
    assetId: string
    ticker: string
    name: string
  }> = []
  // Convert the stored (native-currency) fair value into the display currency.
  const fairValueFactor = new Map<string, number>()
  // The list shows the blended fair value (a single DCF is a fragile outlier).
  const blendedByAnalysis = new Map<string, string>()
  const blendedMosByAnalysis = new Map<string, string>()
  const logoByAsset = new Map<string, string>()
  // Target margin of safety (folded in from the old watchlist), per asset.
  const targetByAsset = new Map<string, { id: string; pct: number }>()
  // Diversification of the tracked (analysed) assets, by count.
  let sectorSlices: BreakdownSlice[] = []
  let countrySlices: BreakdownSlice[] = []
  let dbError: string | null = null

  try {
    const db = getInvestDb()
    rows = await db
      .select({
        id: analyses.id,
        updatedAt: analyses.updatedAt,
        assetId: analyses.assetId,
        ticker: assets.ticker,
        name: assets.name,
      })
      .from(analyses)
      .innerJoin(assets, eq(analyses.assetId, assets.id))
      .orderBy(desc(analyses.updatedAt))

    // Target MoS per asset, from watchlist rows (kept as storage so alerts work).
    for (const w of await db
      .select({ id: watchlistItems.id, assetId: watchlistItems.assetId, targetMos: watchlistItems.targetMos })
      .from(watchlistItems)) {
      if (!targetByAsset.has(w.assetId)) {
        targetByAsset.set(w.assetId, { id: w.id, pct: Math.round(Number(w.targetMos) * 1000) / 10 })
      }
    }

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
        const d = s.data as { currency?: string | null; sector?: string | null; country?: string | null; logo?: string | null } | null
        if (!nativeByAsset.has(s.assetId)) nativeByAsset.set(s.assetId, d?.currency ?? null)
        if (d?.sector && !sectorByAsset.has(s.assetId)) sectorByAsset.set(s.assetId, d.sector)
        if (d?.country && !countryByAsset.has(s.assetId)) countryByAsset.set(s.assetId, d.country)
        if (d?.logo && !logoByAsset.has(s.assetId)) logoByAsset.set(s.assetId, d.logo)
      }

      // One count per distinct tracked asset → sector/country composition.
      const sectorCount = new Map<string, number>()
      const countryCount = new Map<string, number>()
      const seen = new Set<string>()
      for (const r of rows) {
        if (seen.has(r.assetId)) continue
        seen.add(r.assetId)
        sectorCount.set(sectorByAsset.get(r.assetId) || 'Unknown', (sectorCount.get(sectorByAsset.get(r.assetId) || 'Unknown') ?? 0) + 1)
        countryCount.set(countryByAsset.get(r.assetId) || 'Unknown', (countryCount.get(countryByAsset.get(r.assetId) || 'Unknown') ?? 0) + 1)
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

      // Blended fair value (+ MoS) per analysis, from its inputs and latest price.
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
                <th>Stock</th>
                <th className="fin-num">Blended value</th>
                <th className="fin-num">MoS</th>
                <th className="fin-num">Target</th>
                <th className="fin-num">Distance</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const blended = blendedByAnalysis.get(r.id)
                const blendedMosRaw = blendedMosByAnalysis.get(r.id)
                const mos = blendedMosRaw !== undefined ? Number(blendedMosRaw) : null
                const target = targetByAsset.get(r.assetId) ?? null
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/invest/analysis/${r.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
                      >
                        <AssetGlyph ticker={r.ticker} logo={logoByAsset.get(r.assetId) ?? null} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span className="fin-mono" style={{ color: 'var(--fin-text)', fontWeight: 700 }}>{r.ticker}</span>
                          <span className="fin-subtle"> — {r.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="fin-num fin-gold">
                      {blended
                        ? formatMoney(Number(blended) * (fairValueFactor.get(r.assetId) ?? 1), BASE_DISPLAY_CURRENCY)
                        : '—'}
                    </td>
                    <td className={`fin-num ${mos === null ? 'fin-muted' : mos > 0 ? 'fin-gain' : 'fin-loss'}`}>
                      {mos !== null ? formatPercentSigned(mos) : '—'}
                    </td>
                    <TargetMosCells
                      assetId={r.assetId}
                      watchId={target?.id ?? null}
                      initialTargetPct={target?.pct ?? null}
                      currentMos={mos}
                    />
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
    </div>
  )
}
