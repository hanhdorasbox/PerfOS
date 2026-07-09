import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { getInvestDb, cronRuns, type CronRun } from '@/lib/invest/db'
import { loadPortfolioOverview, type PortfolioOverview } from '@/lib/invest/portfolio/overview'
import { formatDateTime, formatMoney } from '@/lib/invest/format'

export const dynamic = 'force-dynamic'

function pnlClass(value: string | null): string {
  if (value === null) return 'fin-muted'
  return Number(value) >= 0 ? 'fin-gain' : 'fin-loss'
}

function CronStatusCard({ runs }: { runs: CronRun[] }) {
  return (
    <div className="fin-card">
      <div className="fin-label" style={{ marginBottom: 12 }}>
        Stav automatizace
      </div>
      {runs.length === 0 ? (
        <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
          Zatím žádný běh. Daily cron běží každý všední den večer (T212 sync, ceny, FX kurzy).
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {runs.map((run) => (
            <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span
                className={
                  run.status === 'success'
                    ? 'fin-badge fin-badge-gain'
                    : run.status === 'error'
                      ? 'fin-badge fin-badge-loss'
                      : 'fin-badge fin-badge-warn'
                }
              >
                {run.status === 'success' ? 'OK' : run.status === 'error' ? 'chyba' : 'běží'}
              </span>
              <span className="fin-mono">{run.job}</span>
              <span className="fin-subtle">{formatDateTime(run.startedAt)}</span>
              {run.error && (
                <span
                  className="fin-loss"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}
                  title={run.error}
                >
                  {run.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function InvestDashboardPage() {
  let overview: PortfolioOverview | null = null
  let runs: CronRun[] = []
  try {
    overview = await loadPortfolioOverview()
    const db = getInvestDb()
    runs = await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(5)
  } catch {
    overview = null
  }

  const warningsCount = Array.isArray(overview?.lastSync?.warnings)
    ? (overview!.lastSync!.warnings as unknown[]).length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="fin-card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="fin-label">Hodnota portfolia</div>
          {overview?.lastSync?.status === 'error' && (
            <span className="fin-badge fin-badge-warn">T212 sync selhal</span>
          )}
          {overview?.syncAgeHours !== null && overview !== null && overview.syncAgeHours >= 24 && (
            <span className="fin-badge fin-badge-warn">data z T212: staré {overview.syncAgeHours} h</span>
          )}
          {warningsCount > 0 && (
            <Link href="/invest/portfolio" className="fin-badge fin-badge-warn" style={{ textDecoration: 'none' }}>
              {warningsCount} nesrovnalostí vůči T212
            </Link>
          )}
        </div>
        <div className="fin-value-lg">
          {overview?.totalValueCzk ? formatMoney(overview.totalValueCzk, 'CZK', 0) : '—'}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
          <span className={pnlClass(overview?.totalDailyPnlCzk ?? null)}>
            denní {overview?.totalDailyPnlCzk ? formatMoney(overview.totalDailyPnlCzk, 'CZK', 0) : '—'}
          </span>
          <span className={pnlClass(overview?.totalUnrealizedPnlCzk ?? null)}>
            celkem {overview?.totalUnrealizedPnlCzk ? formatMoney(overview.totalUnrealizedPnlCzk, 'CZK', 0) : '—'}
          </span>
          <span className="fin-muted">
            cash {overview?.cashTotalCzk ? formatMoney(overview.cashTotalCzk, 'CZK', 0) : '—'}
          </span>
        </div>
        {!overview && (
          <p className="fin-subtle" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Databáze není dostupná — zkontroluj DATABASE_URL a migrace.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Cash rezerva</div>
          {overview && overview.cash.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {overview.cash.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="fin-muted">
                    {c.currency} <span className="fin-subtle">({c.source === 't212' ? 'T212' : 'ruční'})</span>
                  </span>
                  <span className="fin-mono">{formatMoney(c.amount, c.currency, 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
              Zatím žádná — nastav ji v <Link href="/invest/nastaveni" className="fin-gold" style={{ textDecoration: 'none' }}>Nastavení</Link>.
            </p>
          )}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Poslední alerty</div>
          <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>Alert engine přijde ve Fázi 5.</p>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Watchlist — top kandidáti</div>
          <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>Žebříček podle vzdálenosti k target MoS — Fáze 4 a 6.</p>
        </div>
        <CronStatusCard runs={runs} />
      </div>

      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 10 }}>Zkratky</div>
        <p className="fin-muted" style={{ margin: 0, fontSize: 13 }}>
          <Link href="/invest/portfolio" className="fin-gold" style={{ textDecoration: 'none' }}>Portfolio</Link>
          {' · '}
          <Link href="/invest/nastaveni" className="fin-gold" style={{ textDecoration: 'none' }}>Nastavení a sync</Link>
        </p>
      </div>
    </div>
  )
}
