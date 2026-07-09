import Link from 'next/link'
import { asc } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { getInvestDb, assets } from '@/lib/invest/db'
import { loadPortfolioOverview, type PortfolioOverview } from '@/lib/invest/portfolio/overview'
import { formatMoney, formatPercent, formatPercentSigned, formatQuantity, formatDate } from '@/lib/invest/format'
import AllocationDonut, { type DonutSlice } from '@/components/invest/AllocationDonut'
import TransactionForm from '@/components/invest/TransactionForm'
import SyncNowButton from '@/components/invest/SyncNowButton'

export const dynamic = 'force-dynamic'

function pnlClass(value: string | null): string {
  if (value === null) return 'fin-muted'
  return Number(value) >= 0 ? 'fin-gain' : 'fin-loss'
}

function StaleBadge({ overview }: { overview: PortfolioOverview }) {
  if (!overview.lastSync) return null
  if (overview.lastSync.status === 'error') {
    return <span className="fin-badge fin-badge-warn">T212 sync selhal — data mohou být stará</span>
  }
  if (overview.syncAgeHours !== null && overview.syncAgeHours >= 24) {
    return (
      <span className="fin-badge fin-badge-warn">
        data z T212: staré {overview.syncAgeHours} h
      </span>
    )
  }
  return null
}

export default async function PortfolioPage() {
  let overview: PortfolioOverview | null = null
  let allAssets: Array<{ id: string; ticker: string; currency: string }> = []
  let dbError: string | null = null
  try {
    overview = await loadPortfolioOverview()
    const db = getInvestDb()
    allAssets = await db
      .select({ id: assets.id, ticker: assets.ticker, currency: assets.currency })
      .from(assets)
      .orderBy(asc(assets.ticker))
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Neznámá chyba'
  }

  if (!overview) {
    return (
      <div className="fin-card">
        <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>Databáze není dostupná: {dbError}</p>
      </div>
    )
  }

  const warnings = Array.isArray(overview.lastSync?.warnings)
    ? (overview.lastSync!.warnings as Array<{ ticker: string; field: string; local: string | null; remote: string | null }>)
    : []

  const byAsset: DonutSlice[] = overview.positions
    .filter((p) => p.marketValueCzk !== null)
    .map((p) => ({ name: p.ticker, valueCzk: Number(p.marketValueCzk) }))

  const sectorMap = new Map<string, number>()
  for (const p of overview.positions) {
    if (p.marketValueCzk === null) continue
    const key = p.sector ?? 'Nezařazeno'
    sectorMap.set(key, (sectorMap.get(key) ?? 0) + Number(p.marketValueCzk))
  }
  const bySector: DonutSlice[] = [...sectorMap.entries()].map(([name, valueCzk]) => ({ name, valueCzk }))

  const totalPct =
    overview.totalValueCzk && overview.totalUnrealizedPnlCzk
      ? (() => {
          const value = new Decimal(overview.totalValueCzk)
          const pnl = new Decimal(overview.totalUnrealizedPnlCzk)
          const basis = value.minus(pnl)
          return basis.gt(0) ? pnl.div(basis).toNumber() : null
        })()
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <StaleBadge overview={overview} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <TransactionForm assets={allAssets} />
          <SyncNowButton />
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8 }}>Reconciliation — rozdíly vůči T212</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} className="fin-warn">
            {warnings.map((w, i) => (
              <li key={i}>
                <span className="fin-mono">{w.ticker}</span>: {w.field === 'quantity' ? 'počet kusů' : w.field === 'averagePrice' ? 'průměrná cena' : w.field === 'missing_local' ? 'pozice u T212, ale ne lokálně' : 'pozice lokálně, ale ne u T212'}
                {w.local !== null && <> · lokálně <span className="fin-mono">{w.local}</span></>}
                {w.remote !== null && <> · T212 <span className="fin-mono">{w.remote}</span></>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Hodnota portfolia</div>
          <div className="fin-value-lg" style={{ fontSize: 30 }}>
            {overview.totalValueCzk ? formatMoney(overview.totalValueCzk, 'CZK', 0) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Denní P/L</div>
          <div className={`fin-value-lg ${pnlClass(overview.totalDailyPnlCzk)}`} style={{ fontSize: 30 }}>
            {overview.totalDailyPnlCzk ? formatMoney(overview.totalDailyPnlCzk, 'CZK', 0) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Celkový P/L (otevřené)</div>
          <div className={`fin-value-lg ${pnlClass(overview.totalUnrealizedPnlCzk)}`} style={{ fontSize: 30 }}>
            {overview.totalUnrealizedPnlCzk ? formatMoney(overview.totalUnrealizedPnlCzk, 'CZK', 0) : '—'}
          </div>
          {totalPct !== null && (
            <div className={`fin-mono ${pnlClass(overview.totalUnrealizedPnlCzk)}`} style={{ fontSize: 13, marginTop: 4 }}>
              {formatPercentSigned(totalPct)}
            </div>
          )}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Cash</div>
          <div className="fin-value-lg" style={{ fontSize: 30 }}>
            {overview.cashTotalCzk ? formatMoney(overview.cashTotalCzk, 'CZK', 0) : '—'}
          </div>
          <div className="fin-subtle" style={{ fontSize: 12, marginTop: 4 }}>
            {overview.cash.map((c) => `${formatMoney(c.amount, c.currency, 0)}`).join(' · ') || 'žádná rezerva'}
          </div>
        </div>
      </div>

      {overview.fxMissing.length > 0 && (
        <p className="fin-warn" style={{ margin: 0, fontSize: 12 }}>
          Chybí FX kurz pro {overview.fxMissing.join(', ')} — přepočet do CZK je neúplný. Kurzy stáhne daily cron.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <AllocationDonut title="Alokace podle assetu" slices={byAsset} />
        <AllocationDonut title="Alokace podle sektoru" slices={bySector} />
      </div>

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {overview.positions.length === 0 ? (
          <div className="fin-empty">
            Žádné otevřené pozice. Spusť „Sync teď“ (Trading212) nebo přidej ruční transakci.
          </div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="fin-num">Kusy</th>
                <th className="fin-num">Prům. cena</th>
                <th className="fin-num">Aktuální</th>
                <th className="fin-num">P/L</th>
                <th className="fin-num">P/L %</th>
                <th className="fin-num">Váha</th>
                <th className="fin-num">Fair value</th>
                <th className="fin-num">MoS</th>
              </tr>
            </thead>
            <tbody>
              {overview.positions.map((p) => (
                <tr key={p.positionId}>
                  <td>
                    <Link href={`/invest/portfolio/${p.positionId}`} className="fin-mono" style={{ color: 'var(--fin-text)', fontWeight: 600, textDecoration: 'none' }}>
                      {p.ticker}
                    </Link>
                    <div className="fin-subtle" style={{ fontSize: 11 }}>{p.name}</div>
                  </td>
                  <td className="fin-num">{formatQuantity(p.quantity)}</td>
                  <td className="fin-num">{formatMoney(p.avgCost, p.currency)}</td>
                  <td className="fin-num">
                    {p.currentPrice ? formatMoney(p.currentPrice, p.currency) : '—'}
                    {p.priceDate && <div className="fin-subtle" style={{ fontSize: 10 }}>{formatDate(p.priceDate)}</div>}
                  </td>
                  <td className={`fin-num ${pnlClass(p.unrealizedPnl)}`}>
                    {p.unrealizedPnl ? formatMoney(p.unrealizedPnl, p.currency, 0) : '—'}
                  </td>
                  <td className={`fin-num ${pnlClass(p.unrealizedPnl)}`}>
                    {p.unrealizedPnlPct ? formatPercentSigned(p.unrealizedPnlPct) : '—'}
                  </td>
                  <td className="fin-num">{p.weight ? formatPercent(p.weight) : '—'}</td>
                  <td className="fin-num">
                    {p.fairValue ? (
                      <Link href={`/invest/analyza/${p.analysisId}`} className="fin-gold" style={{ textDecoration: 'none' }}>
                        {formatMoney(p.fairValue, p.currency)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`fin-num ${p.marginOfSafety !== null ? (Number(p.marginOfSafety) > 0 ? 'fin-gain' : 'fin-loss') : 'fin-muted'}`}>
                    {p.marginOfSafety !== null ? formatPercentSigned(p.marginOfSafety) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
