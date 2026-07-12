import { asc, desc, eq } from 'drizzle-orm'
import { getInvestDb, alertEvents, alertRules, assets } from '@/lib/invest/db'
import { formatDateTime } from '@/lib/invest/format'
import AlertRulesManager, { type AlertRuleRow } from '@/components/invest/AlertRulesManager'

export const dynamic = 'force-dynamic'

export default async function AlertyPage() {
  let rules: AlertRuleRow[] = []
  let events: Array<{ id: string; ruleName: string; triggeredAt: Date; notified: boolean; lines: string[] }> = []
  let assetOptions: Array<{ id: string; ticker: string; currency: string }> = []
  let dbError: string | null = null

  try {
    const db = getInvestDb()
    const ruleRows = await db.select().from(alertRules)
    rules = ruleRows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      params: (r.params ?? {}) as Record<string, unknown>,
      isActive: r.isActive,
      cooldownHours: r.cooldownHours,
    }))

    const eventRows = await db
      .select({
        id: alertEvents.id,
        triggeredAt: alertEvents.triggeredAt,
        notified: alertEvents.notified,
        payload: alertEvents.payload,
        ruleName: alertRules.name,
      })
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(30)
    events = eventRows.map((e) => ({
      id: e.id,
      ruleName: e.ruleName,
      triggeredAt: e.triggeredAt,
      notified: e.notified,
      lines: Array.isArray((e.payload as { lines?: string[] })?.lines)
        ? ((e.payload as { lines: string[] }).lines)
        : [],
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
      <div className="fin-card">
        <AlertRulesManager rules={rules} assets={assetOptions} />
      </div>

      <section>
        <h3 className="fin-serif" style={{ fontSize: 18, margin: '0 0 12px' }}>Historie eventů</h3>
        <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
          {events.length === 0 ? (
            <div className="fin-empty">Zatím žádný spuštěný alert.</div>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Kdy</th>
                  <th>Pravidlo</th>
                  <th>Hodnoty v momentě triggeru</th>
                  <th>E-mail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="fin-mono" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(event.triggeredAt)}</td>
                    <td style={{ fontWeight: 600 }}>{event.ruleName}</td>
                    <td className="fin-muted" style={{ fontSize: 12 }}>
                      {event.lines.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </td>
                    <td>
                      <span className={event.notified ? 'fin-badge fin-badge-gain' : 'fin-badge'}>
                        {event.notified ? 'odesláno' : 'neodesláno'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
