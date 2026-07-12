import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getInvestDb, alertEvents, alertRules, cronRuns, type CronRun } from '@/lib/invest/db'
import { loadPortfolioOverview, type PortfolioOverview } from '@/lib/invest/portfolio/overview'
import { loadWatchlistRanking, type WatchlistCandidate } from '@/lib/invest/portfolio/watchlist'
import { formatDate, formatDateTime, formatMoney, formatPercent, formatPercentSigned } from '@/lib/invest/format'

export const dynamic = 'force-dynamic'

function pnlClass(value: string | null): string {
  if (value === null) return 'fin-muted'
  return Number(value) >= 0 ? 'fin-gain' : 'fin-loss'
}

function CronStatusCard({ runs }: { runs: CronRun[] }) {
  return (
    <div className="fin-card">
      <div className="fin-label" style={{ marginBottom: 12 }}>
        Automation status
      </div>
      {runs.length === 0 ? (
        <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
          No runs yet. The daily cron runs every weekday evening (T212 sync, prices, FX rates).
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
                {run.status === 'success' ? 'OK' : run.status === 'error' ? 'error' : 'running'}
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
  let recentAlerts: Array<{ id: string; ruleName: string; triggeredAt: Date }> = []
  let watchlist: WatchlistCandidate[] = []
  try {
    overview = await loadPortfolioOverview()
    watchlist = await loadWatchlistRanking()
    const db = getInvestDb()
    runs = await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(5)
    recentAlerts = await db
      .select({ id: alertEvents.id, ruleName: alertRules.name, triggeredAt: alertEvents.triggeredAt })
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(4)
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
          <div className="fin-label">Portfolio value</div>
          {overview?.lastSync?.status === 'error' && (
            <span className="fin-badge fin-badge-warn">T212 sync failed</span>
          )}
          {overview?.syncAgeHours !== null && overview !== null && overview.syncAgeHours >= 24 && (
            <span className="fin-badge fin-badge-warn">T212 data: {overview.syncAgeHours} h old</span>
          )}
          {warningsCount > 0 && (
            <Link href="/invest/portfolio" className="fin-badge fin-badge-warn" style={{ textDecoration: 'none' }}>
              {warningsCount} discrepancies vs. T212
            </Link>
          )}
        </div>
        <div className="fin-value-lg">
          {overview?.totalValueCzk ? formatMoney(overview.totalValueCzk, 'CZK', 0) : '—'}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
          <span className={pnlClass(overview?.totalDailyPnlCzk ?? null)}>
            daily {overview?.totalDailyPnlCzk ? formatMoney(overview.totalDailyPnlCzk, 'CZK', 0) : '—'}
          </span>
          <span className={pnlClass(overview?.totalUnrealizedPnlCzk ?? null)}>
            total {overview?.totalUnrealizedPnlCzk ? formatMoney(overview.totalUnrealizedPnlCzk, 'CZK', 0) : '—'}
          </span>
          <span className="fin-muted">
            cash {overview?.cashTotalCzk ? formatMoney(overview.cashTotalCzk, 'CZK', 0) : '—'}
          </span>
        </div>
        {!overview && (
          <p className="fin-subtle" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Database unavailable — check DATABASE_URL and migrations.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Cash reserve</div>
          {overview && overview.cash.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {overview.cash.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="fin-muted">
                    {c.currency} <span className="fin-subtle">({c.source === 't212' ? 'T212' : 'manual'})</span>
                  </span>
                  <span className="fin-mono">{formatMoney(c.amount, c.currency, 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
              None yet — set it in <Link href="/invest/settings" className="fin-gold" style={{ textDecoration: 'none' }}>Settings</Link>.
            </p>
          )}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Recent alerts</div>
          {recentAlerts.length === 0 ? (
            <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
              No alerts yet — configure rules in{' '}
              <Link href="/invest/alerts" className="fin-gold" style={{ textDecoration: 'none' }}>Alerts</Link>.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {recentAlerts.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <Link href="/invest/alerts" className="fin-muted" style={{ textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.ruleName}
                  </Link>
                  <span className="fin-subtle" style={{ whiteSpace: 'nowrap' }}>{formatDate(a.triggeredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 10 }}>Watchlist — top candidates</div>
          {watchlist.length === 0 ? (
            <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
              Watchlist is empty — add assets with a target MoS in{' '}
              <Link href="/invest/analysis" className="fin-gold" style={{ textDecoration: 'none' }}>Analysis</Link>.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {watchlist.slice(0, 3).map((w) => (
                <div key={w.ticker} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="fin-mono" style={{ fontWeight: 600 }}>{w.ticker}</span>
                  {w.distance === null ? (
                    <span className="fin-subtle">no active analysis</span>
                  ) : (
                    <span className={w.distance >= 0 ? 'fin-gain fin-mono' : 'fin-muted fin-mono'}>
                      {formatPercentSigned(w.distance)} to target {formatPercent(w.targetMos)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <CronStatusCard runs={runs} />
      </div>

      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 10 }}>Shortcuts</div>
        <p className="fin-muted" style={{ margin: 0, fontSize: 13 }}>
          <Link href="/invest/portfolio" className="fin-gold" style={{ textDecoration: 'none' }}>Portfolio</Link>
          {' · '}
          <Link href="/invest/settings" className="fin-gold" style={{ textDecoration: 'none' }}>Settings & sync</Link>
        </p>
      </div>
    </div>
  )
}
