import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import {
  getInvestDb,
  analyses,
  assets,
  positions,
  priceSnapshots,
  transactions,
} from '@/lib/invest/db'
import { computeHolding, valuePosition } from '@/lib/invest/portfolio/calc'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercentSigned,
  formatQuantity,
} from '@/lib/invest/format'
import PriceSparkline from '@/components/invest/PriceSparkline'

export const dynamic = 'force-dynamic'

const TX_LABELS: Record<string, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  fee: 'Fee',
}

export default async function PositionDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const db = getInvestDb()

  const [position] = await db.select().from(positions).where(eq(positions.id, id)).limit(1)
  if (!position) notFound()

  const [asset] = await db.select().from(assets).where(eq(assets.id, position.assetId)).limit(1)
  if (!asset) notFound()

  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.positionId, position.id))
    .orderBy(desc(transactions.executedAt))

  const prices = await db
    .select({ date: priceSnapshots.date, price: priceSnapshots.price })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.assetId, asset.id))
    .orderBy(desc(priceSnapshots.date))
    .limit(90)

  const [analysis] = await db
    .select({ id: analyses.id, title: analyses.title, fairValue: analyses.fairValue })
    .from(analyses)
    .where(and(eq(analyses.assetId, asset.id), eq(analyses.status, 'active')))
    .orderBy(desc(analyses.updatedAt))
    .limit(1)

  const holding = computeHolding(
    txs.filter((t) => t.type === 'buy' || t.type === 'sell'),
  )
  const latest = prices[0] ?? null
  const valuation = latest ? valuePosition(holding, latest.price) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="fin-serif" style={{ fontSize: 24, margin: 0 }}>
          <span className="fin-mono">{asset.ticker}</span> — {asset.name}
        </h2>
        <span className={position.status === 'open' ? 'fin-badge fin-badge-gain' : 'fin-badge'}>
          {position.status === 'open' ? 'open' : 'closed'}
        </span>
        <Link href="/invest/portfolio" className="fin-subtle" style={{ marginLeft: 'auto', fontSize: 13, textDecoration: 'none' }}>
          ← back to portfolio
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Shares</div>
          <div className="fin-value-lg fin-mono" style={{ fontSize: 26 }}>{formatQuantity(holding.quantity.toString())}</div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Average cost</div>
          <div className="fin-value-lg fin-mono" style={{ fontSize: 26 }}>{formatMoney(holding.avgCost.toString(), asset.currency)}</div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Current price</div>
          <div className="fin-value-lg fin-mono" style={{ fontSize: 26 }}>
            {latest ? formatMoney(latest.price, asset.currency) : '—'}
          </div>
          {latest && <div className="fin-subtle" style={{ fontSize: 11, marginTop: 4 }}>{formatDate(latest.date)}</div>}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Unrealized P/L</div>
          <div
            className={`fin-value-lg fin-mono ${valuation && valuation.unrealizedPnl.gte(0) ? 'fin-gain' : 'fin-loss'}`}
            style={{ fontSize: 26 }}
          >
            {valuation ? formatMoney(valuation.unrealizedPnl.toFixed(2), asset.currency, 0) : '—'}
          </div>
          {valuation?.unrealizedPnlPct && (
            <div className={`fin-mono ${valuation.unrealizedPnl.gte(0) ? 'fin-gain' : 'fin-loss'}`} style={{ fontSize: 12, marginTop: 4 }}>
              {formatPercentSigned(valuation.unrealizedPnlPct.toNumber())}
            </div>
          )}
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8 }}>Realized + dividends</div>
          <div className="fin-value-lg fin-mono" style={{ fontSize: 26 }}>
            {formatMoney(holding.realizedPnl.plus(holding.dividends).toFixed(2), asset.currency, 0)}
          </div>
          <div className="fin-subtle" style={{ fontSize: 11, marginTop: 4 }}>
            of which dividends {formatMoney(holding.dividends.toFixed(2), asset.currency, 0)}
          </div>
        </div>
      </div>

      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 12 }}>Price history (90 days)</div>
        <PriceSparkline
          points={prices.map((p) => ({ date: p.date, price: Number(p.price) }))}
          currency={asset.currency}
        />
      </div>

      <div className="fin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span className="fin-label">Analysis</span>
        </div>
        {analysis ? (
          <p style={{ margin: 0, fontSize: 13 }}>
            <Link href={`/invest/analysis/${analysis.id}`} className="fin-gold" style={{ textDecoration: 'none' }}>
              {analysis.title}
            </Link>
            {analysis.fairValue && (
              <span className="fin-muted"> · fair value {formatMoney(analysis.fairValue, asset.currency)}</span>
            )}
          </p>
        ) : (
          <p className="fin-subtle" style={{ margin: 0, fontSize: 13 }}>
            No active analysis — create one in the Analysis section.
          </p>
        )}
      </div>

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {txs.length === 0 ? (
          <div className="fin-empty">No transactions.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="fin-num">Shares</th>
                <th className="fin-num">Price</th>
                <th className="fin-num">Amount</th>
                <th>Source</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx) => (
                <tr key={tx.id}>
                  <td className="fin-mono" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(tx.executedAt)}</td>
                  <td>
                    <span className={tx.type === 'buy' ? 'fin-badge fin-badge-gain' : tx.type === 'sell' ? 'fin-badge fin-badge-loss' : 'fin-badge'}>
                      {TX_LABELS[tx.type] ?? tx.type}
                    </span>
                  </td>
                  <td className="fin-num">{tx.quantity ? formatQuantity(tx.quantity) : '—'}</td>
                  <td className="fin-num">{tx.price ? formatMoney(tx.price, tx.currency) : '—'}</td>
                  <td className="fin-num">{formatMoney(tx.amount, tx.currency)}</td>
                  <td className="fin-subtle">{tx.source === 't212' ? 'T212' : 'manual'}</td>
                  <td className="fin-subtle" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.note ?? ''}
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
