'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, formatMoney } from '@/lib/invest/format'

interface Point {
  date: string
  price: number
}

function SparkTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: Array<{ payload: Point }>
  currency: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div
      style={{
        background: '#1A1A1E',
        border: '1px solid var(--fin-border-strong)',
        borderRadius: 10,
        padding: '6px 10px',
        fontSize: 12,
      }}
    >
      <span className="fin-subtle">{formatDate(point.date)}</span>{' '}
      <span className="fin-mono" style={{ color: 'var(--fin-text)' }}>
        {formatMoney(point.price, currency)}
      </span>
    </div>
  )
}

/** Single-series price line from price_snapshots — no legend needed, the title names it. */
export default function PriceSparkline({
  points,
  currency,
  height = 160,
  compact = false,
}: {
  points: Point[]
  currency: string
  height?: number
  /** Table-cell mode: renders a quiet dash instead of the empty-state text */
  compact?: boolean
}) {
  if (points.length < 2) {
    if (compact) return <span className="fin-subtle">—</span>
    return <div className="fin-empty">Zatím málo cenových dat na graf.</div>
  }
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sorted} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip content={<SparkTooltip currency={currency} />} cursor={{ stroke: 'var(--fin-border-strong)' }} />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3987e5"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
