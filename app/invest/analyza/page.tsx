import Link from 'next/link'
import { asc, desc, eq } from 'drizzle-orm'
import { getInvestDb, analyses, assets, watchlistItems } from '@/lib/invest/db'
import { formatDate, formatMoney, formatPercentSigned } from '@/lib/invest/format'
import WatchlistManager, { type WatchlistRow } from '@/components/invest/WatchlistManager'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'rozpracovaná', cls: 'fin-badge' },
  active: { label: 'aktivní', cls: 'fin-badge fin-badge-gold' },
  archived: { label: 'archiv', cls: 'fin-badge' },
}

export default async function AnalyzaPage() {
  let rows: Array<{
    id: string
    title: string
    status: string
    fairValue: string | null
    marginOfSafety: string | null
    updatedAt: Date
    ticker: string
    currency: string
  }> = []
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
        ticker: assets.ticker,
        currency: assets.currency,
      })
      .from(analyses)
      .innerJoin(assets, eq(analyses.assetId, assets.id))
      .orderBy(desc(analyses.updatedAt))

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
    dbError = e instanceof Error ? e.message : 'Neznámá chyba'
  }

  if (dbError) {
    return (
      <div className="fin-card">
        <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>Databáze není dostupná: {dbError}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 className="fin-serif" style={{ fontSize: 22, margin: 0 }}>Analýzy</h2>
        <Link href="/invest/analyza/new" className="fin-btn fin-btn-primary" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          + Nová analýza
        </Link>
      </div>

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <div className="fin-empty">Zatím žádné analýzy. Založ první přes „+ Nová analýza“.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Analýza</th>
                <th>Status</th>
                <th className="fin-num">Fair value</th>
                <th className="fin-num">MoS</th>
                <th>Aktualizováno</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.draft
                const mos = r.marginOfSafety !== null ? Number(r.marginOfSafety) : null
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/invest/analyza/${r.id}`} style={{ color: 'var(--fin-text)', fontWeight: 600, textDecoration: 'none' }}>
                        {r.title}
                      </Link>
                      <div className="fin-subtle fin-mono" style={{ fontSize: 11 }}>{r.ticker}</div>
                    </td>
                    <td><span className={status.cls}>{status.label}</span></td>
                    <td className="fin-num fin-gold">
                      {r.fairValue ? formatMoney(r.fairValue, r.currency) : '—'}
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

      <section>
        <h3 className="fin-serif" style={{ fontSize: 18, margin: '0 0 12px' }}>Watchlist</h3>
        <div className="fin-card">
          <WatchlistManager items={watchRows} assets={assetOptions} />
        </div>
      </section>
    </div>
  )
}
