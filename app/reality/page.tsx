import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatCZK, formatPct } from '@/lib/reality/format'

export const dynamic = 'force-dynamic'

const VERDICT: Record<string, { label: string; cls: string }> = {
  good: { label: 'dobrá', cls: 'fin-badge fin-badge-gain' },
  borderline: { label: 'hraniční', cls: 'fin-badge' },
  poor: { label: 'nevýhodná', cls: 'fin-badge fin-badge-loss' },
}

export default async function RealityListPage() {
  let rows: Array<{
    id: string
    title: string
    address: string | null
    purchasePrice: number
    financing: string
    monthlyCashFlow: number
    netYield: number
    cashOnCash: number
    verdictRating: string
    updatedAt: Date
  }> = []
  let dbError: string | null = null

  try {
    const user = await prisma.user.findFirst()
    if (user) {
      rows = await prisma.propertyAnalysis.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      })
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Neznámá chyba'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="fin-subtle" style={{ margin: 0, fontSize: 13, maxWidth: 620 }}>
          Zadej parametry nemovitosti a hned uvidíš, jestli se investice vyplatí — měsíční cash flow,
          čistý výnos, cash-on-cash návratnost i vývoj za několik let.
        </p>
        <Link href="/reality/new" className="fin-btn fin-btn-primary" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          + Nová analýza
        </Link>
      </div>

      {dbError && (
        <div className="fin-card">
          <p className="fin-warn" style={{ margin: 0, fontSize: 13 }}>Databáze není dostupná: {dbError}</p>
        </div>
      )}

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {rows.length === 0 && !dbError ? (
          <div className="fin-empty">
            Zatím žádná analýza. Vytvoř první přes „+ Nová analýza“.
          </div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Nemovitost</th>
                <th className="fin-num">Cena</th>
                <th className="fin-num">Cash flow / měs</th>
                <th className="fin-num">Čistý výnos</th>
                <th className="fin-num">Cash-on-cash</th>
                <th>Verdikt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = VERDICT[r.verdictRating] ?? VERDICT.borderline
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/reality/${r.id}`} style={{ color: 'var(--fin-text)', fontWeight: 600, textDecoration: 'none' }}>
                        {r.title}
                      </Link>
                      <div className="fin-subtle" style={{ fontSize: 11 }}>
                        {r.address ? `${r.address} · ` : ''}{r.financing === 'mortgage' ? 'hypotéka' : 'za hotové'}
                      </div>
                    </td>
                    <td className="fin-num">{formatCZK(r.purchasePrice)}</td>
                    <td className={`fin-num ${r.monthlyCashFlow >= 0 ? 'fin-gain' : 'fin-loss'}`}>{formatCZK(r.monthlyCashFlow)}</td>
                    <td className="fin-num fin-gold">{formatPct(r.netYield)}</td>
                    <td className={`fin-num ${r.cashOnCash >= 0 ? '' : 'fin-loss'}`}>{formatPct(r.cashOnCash)}</td>
                    <td><span className={v.cls}>{v.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
