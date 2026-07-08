import Link from 'next/link'
import { count } from 'drizzle-orm'
import { getInvestDb, assets, priceSnapshots } from '@/lib/invest/db'

export const dynamic = 'force-dynamic'

async function loadCounts() {
  const db = getInvestDb()
  const [[assetCount], [priceCount]] = await Promise.all([
    db.select({ n: count() }).from(assets),
    db.select({ n: count() }).from(priceSnapshots),
  ])
  return { assets: assetCount?.n ?? 0, prices: priceCount?.n ?? 0 }
}

function PlaceholderCard({
  label,
  note,
  href,
}: {
  label: string
  note: string
  href?: string
}) {
  return (
    <div className="fin-card">
      <div className="fin-label" style={{ marginBottom: 10 }}>
        {label}
      </div>
      <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
        {note}
      </p>
      {href && (
        <Link href={href} className="fin-gold" style={{ fontSize: 13, textDecoration: 'none' }}>
          Přejít →
        </Link>
      )}
    </div>
  )
}

export default async function InvestDashboardPage() {
  let counts: { assets: number; prices: number } | null = null
  try {
    counts = await loadCounts()
  } catch {
    counts = null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="fin-card" style={{ padding: 32 }}>
        <div className="fin-label" style={{ marginBottom: 12 }}>
          Hodnota portfolia
        </div>
        <div className="fin-value-lg">—</div>
        <p className="fin-subtle" style={{ margin: '10px 0 0', fontSize: 13 }}>
          Výpočet hodnoty portfolia a P/L přijde ve Fázi 3 (Trading212 sync).
          {counts && (
            <>
              {' '}
              Zatím evidováno: <span className="fin-mono">{counts.assets}</span> assetů,{' '}
              <span className="fin-mono">{counts.prices}</span> cenových snapshotů.
            </>
          )}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <PlaceholderCard
          label="Cash rezerva"
          note="Sync z Trading212 + ruční rezerva — Fáze 3."
        />
        <PlaceholderCard
          label="Poslední alerty"
          note="Alert engine s pravidly a e-maily — Fáze 5."
        />
        <PlaceholderCard
          label="Watchlist — top kandidáti"
          note="Žebříček podle vzdálenosti k target MoS — Fáze 4 a 6."
        />
        <PlaceholderCard
          label="Stav automatizace"
          note="Log cron běhů (daily / weekly / digest) — Fáze 2."
        />
      </div>

      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 10 }}>
          Začni tady
        </div>
        <p className="fin-muted" style={{ margin: 0, fontSize: 13 }}>
          V{' '}
          <Link href="/invest/nastaveni" className="fin-gold" style={{ textDecoration: 'none' }}>
            Nastavení
          </Link>{' '}
          založ první assety a u titulů mimo API (např. pražská burza) zadej ceny ručně.
        </p>
      </div>
    </div>
  )
}
