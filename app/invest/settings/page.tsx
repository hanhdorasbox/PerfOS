import { asc, desc, eq } from 'drizzle-orm'
import AssetsManager, { type AssetRow } from '@/components/invest/AssetsManager'
import CashManager, { type CashRow } from '@/components/invest/CashManager'
import SyncNowButton from '@/components/invest/SyncNowButton'
import { getInvestDb, assets, cashBalances, priceSnapshots, syncRuns } from '@/lib/invest/db'
import { formatDateTime } from '@/lib/invest/format'

export const dynamic = 'force-dynamic'

async function loadAssets(): Promise<AssetRow[]> {
  const db = getInvestDb()
  const rows = await db.select().from(assets).orderBy(asc(assets.ticker))
  return Promise.all(
    rows.map(async (asset) => {
      const [latest] = await db
        .select({ price: priceSnapshots.price, date: priceSnapshots.date })
        .from(priceSnapshots)
        .where(eq(priceSnapshots.assetId, asset.id))
        .orderBy(desc(priceSnapshots.date))
        .limit(1)
      return {
        id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        currency: asset.currency,
        exchange: asset.exchange,
        sector: asset.sector,
        manualPricing: asset.manualPricing,
        needsMapping: asset.needsMapping,
        latestPrice: latest ?? null,
      }
    }),
  )
}

function EnvBadge({ label, set }: { label: string; set: boolean }) {
  return (
    <span className={set ? 'fin-badge fin-badge-gain' : 'fin-badge'}>
      {label}: {set ? 'set' : 'missing'}
    </span>
  )
}

export default async function NastaveniPage() {
  let initialAssets: AssetRow[] = []
  let cashRows: CashRow[] = []
  let recentSyncs: Array<{ id: string; startedAt: Date; status: string; ordersImported: number; dividendsImported: number; error: string | null }> = []
  let dbError: string | null = null
  try {
    initialAssets = await loadAssets()
    const db = getInvestDb()
    const cash = await db.select().from(cashBalances)
    cashRows = cash.map((c) => ({
      id: c.id,
      currency: c.currency,
      amount: c.amount,
      source: c.source,
      updatedAt: c.updatedAt.toISOString(),
    }))
    recentSyncs = await db
      .select({
        id: syncRuns.id,
        startedAt: syncRuns.startedAt,
        status: syncRuns.status,
        ordersImported: syncRuns.ordersImported,
        dividendsImported: syncRuns.dividendsImported,
        error: syncRuns.error,
      })
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(3)
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Unknown database error'
  }

  const unmapped = initialAssets.filter((a) => a.needsMapping)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Assets and manual prices
        </h2>
        {dbError ? (
          <div className="fin-card">
            <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>
              Database unavailable: {dbError}
            </p>
            <p className="fin-subtle" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Check the <code className="fin-mono">DATABASE_URL</code> environment variable (Neon)
              and run migrations: <code className="fin-mono">npm run db:invest:migrate</code>.
            </p>
          </div>
        ) : (
          <AssetsManager initialAssets={initialAssets} />
        )}
      </section>

      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          API status
        </h2>
        <div className="fin-card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <EnvBadge label="Database" set={Boolean(process.env.FINANCE_DATABASE_URL ?? process.env.DATABASE_URL)} />
          <EnvBadge label="Finnhub" set={Boolean(process.env.FINNHUB_API_KEY)} />
          <EnvBadge label="Trading212" set={Boolean(process.env.T212_API_KEY)} />
          <EnvBadge label="Resend" set={Boolean(process.env.RESEND_API_KEY)} />
          <EnvBadge label="Cron secret" set={Boolean(process.env.CRON_SECRET)} />
        </div>
      </section>

      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Trading212 sync
        </h2>
        <div className="fin-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SyncNowButton />
          {unmapped.length > 0 && (
            <div>
              <div className="fin-label" style={{ marginBottom: 6 }}>Assets awaiting manual mapping</div>
              <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>
                {unmapped.map((a) => a.ticker).join(', ')} — the standard ticker could not be
                determined automatically for these assets. Edit their ticker (and optionally enable
                manual prices) in the Assets section above.
              </p>
            </div>
          )}
          {recentSyncs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {recentSyncs.map((run) => (
                <div key={run.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className={run.status === 'success' ? 'fin-badge fin-badge-gain' : run.status === 'error' ? 'fin-badge fin-badge-loss' : 'fin-badge fin-badge-warn'}>
                    {run.status === 'success' ? 'OK' : run.status === 'error' ? 'error' : 'running'}
                  </span>
                  <span className="fin-subtle">{formatDateTime(run.startedAt)}</span>
                  <span className="fin-muted">
                    {run.ordersImported} ord. · {run.dividendsImported} div.
                  </span>
                  {run.error && (
                    <span className="fin-loss" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }} title={run.error}>
                      {run.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="fin-subtle" style={{ margin: 0, fontSize: 12 }}>
            The sync is read-only (no order placement) and idempotent — orders and dividends are
            imported by their T212 ID, so re-running never creates duplicates. It also runs
            automatically as part of the daily cron.
          </p>
        </div>
      </section>

      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Cash and currencies
        </h2>
        <div className="fin-card">
          <CashManager initialCash={cashRows} />
        </div>
      </section>
    </div>
  )
}
