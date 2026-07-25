import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getInvestDb, alertEvents, alertRules, cronRuns, type CronRun } from '@/lib/invest/db'
import { loadPortfolioOverview, type PortfolioOverview } from '@/lib/invest/portfolio/overview'
import { loadWatchlistRanking, type WatchlistCandidate } from '@/lib/invest/portfolio/watchlist'
import { formatDate, formatDateTime, formatMoney, formatPercent, formatPercentSigned } from '@/lib/invest/format'
import AllocationDonut from '@/components/invest/AllocationDonut'
import PriceSparkline from '@/components/invest/PriceSparkline'

export const dynamic = 'force-dynamic'

function pnlClass(value: string | null): string {
  if (value === null) return 'fin-muted'
  return Number(value) >= 0 ? 'fin-gain' : 'fin-loss'
}

// Small KPI tile — label + a big mono value in a status ink. Text stays in ink
// tokens; only the number carries the gain/loss polarity.
function StatTile({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div
      style={{
        flex: '1 1 120px',
        minWidth: 0,
        border: '1px solid var(--fin-border)',
        borderRadius: 12,
        padding: '11px 14px',
        background: 'var(--bg-inset)',
      }}
    >
      <div className="fin-label" style={{ marginBottom: 5, letterSpacing: '0.06em' }}>{label}</div>
      <div className={`fin-mono ${cls ?? ''}`} style={{ fontSize: 17, fontWeight: 600 }}>{value}</div>
    </div>
  )
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

  const positions = overview?.positions ?? []
  const slices = positions
    .filter((p) => p.marketValueCzk !== null && Number(p.marketValueCzk) > 0)
    .map((p) => ({ name: p.ticker, valueCzk: Number(p.marketValueCzk) }))
  const holdings = [...positions]
    .sort((a, b) => Number(b.marketValueCzk ?? 0) - Number(a.marketValueCzk ?? 0))
    .slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Hero: portfolio value + allocation ── */}
      <div
        className="mob-1col"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 16 }}
      >
        <div className="fin-card" style={{ padding: 28, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
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
          {/* KPI tiles */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <StatTile
              label="Daily P&L"
              value={overview?.totalDailyPnlCzk ? formatMoney(overview.totalDailyPnlCzk, 'CZK', 0) : '—'}
              cls={pnlClass(overview?.totalDailyPnlCzk ?? null)}
            />
            <StatTile
              label="Total P&L"
              value={overview?.totalUnrealizedPnlCzk ? formatMoney(overview.totalUnrealizedPnlCzk, 'CZK', 0) : '—'}
              cls={pnlClass(overview?.totalUnrealizedPnlCzk ?? null)}
            />
            <StatTile
              label="Cash"
              value={overview?.cashTotalCzk ? formatMoney(overview.cashTotalCzk, 'CZK', 0) : '—'}
            />
            <StatTile label="Holdings" value={positions.length > 0 ? String(positions.length) : '—'} />
          </div>
          {!overview && (
            <p className="fin-subtle" style={{ margin: '14px 0 0', fontSize: 13 }}>
              Database unavailable — check DATABASE_URL and migrations.
            </p>
          )}
        </div>

        <AllocationDonut title="Allocation" slices={slices} />
      </div>

      {/* ── Holdings with sparklines + weight bars ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 14 }}>Holdings</div>
        {holdings.length === 0 ? (
          <div className="fin-empty">
            No open positions yet — they appear after a{' '}
            <Link href="/invest/settings" className="fin-gold" style={{ textDecoration: 'none' }}>T212 sync</Link>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {holdings.map((p) => {
              const weight = p.weight !== null ? Number(p.weight) : 0
              return (
                <div
                  key={p.positionId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 160px) minmax(0, 1fr) minmax(96px, 120px)',
                    gap: 14,
                    alignItems: 'center',
                    padding: '10px 8px',
                    borderRadius: 10,
                    borderBottom: '1px solid var(--fin-border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      {p.analysisId ? (
                        <Link href={`/invest/analysis/${p.analysisId}`} className="fin-mono" style={{ fontWeight: 700, textDecoration: 'none', color: 'var(--fin-text)' }}>
                          {p.ticker}
                        </Link>
                      ) : (
                        <span className="fin-mono" style={{ fontWeight: 700 }}>{p.ticker}</span>
                      )}
                      <span className="fin-mono fin-subtle" style={{ fontSize: 11 }}>{formatPercent(weight)}</span>
                    </div>
                    {/* weight bar — magnitude, single gold hue */}
                    <div style={{ height: 4, borderRadius: 999, background: 'var(--bg-inset)', marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, weight * 100)}%`, background: 'var(--fin-gold)', borderRadius: 999 }} />
                    </div>
                  </div>

                  <div style={{ height: 40, minWidth: 0 }}>
                    <PriceSparkline points={p.sparkline} currency={p.currency} height={40} compact />
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 0 }}>
                    <div className={`fin-mono ${pnlClass(p.dailyPnlPct)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                      {p.dailyPnlPct !== null ? formatPercentSigned(Number(p.dailyPnlPct)) : '—'}
                    </div>
                    <div className="fin-mono fin-subtle" style={{ fontSize: 11 }}>
                      {p.marketValueCzk ? formatMoney(p.marketValueCzk, 'CZK', 0) : '—'}
                    </div>
                  </div>
                </div>
              )
            })}
            {positions.length > holdings.length && (
              <Link href="/invest/portfolio" className="fin-gold" style={{ fontSize: 12, textDecoration: 'none', padding: '10px 8px 0' }}>
                View all {positions.length} positions →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Secondary info ── */}
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
    </div>
  )
}
