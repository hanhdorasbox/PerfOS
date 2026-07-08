import { asc, desc, eq } from 'drizzle-orm'
import AssetsManager, { type AssetRow } from '@/components/invest/AssetsManager'
import { getInvestDb, assets, priceSnapshots } from '@/lib/invest/db'

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
      {label}: {set ? 'nastaveno' : 'chybí'}
    </span>
  )
}

export default async function NastaveniPage() {
  let initialAssets: AssetRow[] = []
  let dbError: string | null = null
  try {
    initialAssets = await loadAssets()
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Neznámá chyba databáze'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Assety a manuální ceny
        </h2>
        {dbError ? (
          <div className="fin-card">
            <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>
              Databáze není dostupná: {dbError}
            </p>
            <p className="fin-subtle" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Zkontroluj proměnnou prostředí <code className="fin-mono">DATABASE_URL</code> (Neon)
              a spusť migrace: <code className="fin-mono">npm run db:invest:migrate</code>.
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
          <EnvBadge label="Databáze" set={Boolean(process.env.FINANCE_DATABASE_URL ?? process.env.DATABASE_URL)} />
          <EnvBadge label="Finnhub" set={Boolean(process.env.FINNHUB_API_KEY)} />
          <EnvBadge label="Trading212" set={Boolean(process.env.T212_API_KEY)} />
          <EnvBadge label="Resend" set={Boolean(process.env.RESEND_API_KEY)} />
          <EnvBadge label="Cron secret" set={Boolean(process.env.CRON_SECRET)} />
        </div>
      </section>

      <section>
        <h2 className="fin-serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Cash a měny
        </h2>
        <div className="fin-card fin-empty">
          Správa cash rezervy a synchronizace s Trading212 přijde ve Fázi 3.
        </div>
      </section>
    </div>
  )
}
