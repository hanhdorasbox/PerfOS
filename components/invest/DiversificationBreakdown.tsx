'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney, formatPercent } from '@/lib/invest/format'

// Validated categorical palette (dataviz skill) — fixed slot order, folds to
// "Other" past 7 so a long tail never explodes the legend.
const SERIES = ['#1f85ff', '#00b778', '#c98500', '#008300', '#7f6fff', '#ff4e4e', '#fc2a76', '#ff4900']
const SURFACE = '#1A1A1E'

export interface BreakdownSlice {
  label: string
  /** Weight of this slice: market value for owned, or a count for a watchlist. */
  value: number
}

function fold(slices: BreakdownSlice[]): BreakdownSlice[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  if (sorted.length <= 7) return sorted
  const head = sorted.slice(0, 6)
  const rest = sorted.slice(6).reduce((sum, s) => sum + s.value, 0)
  return [...head, { label: 'Other', value: rest }]
}

function DonutTooltip({
  active,
  payload,
  total,
  unit,
}: {
  active?: boolean
  payload?: Array<{ payload: BreakdownSlice }>
  total: number
  unit: 'money' | 'count'
}) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div style={{ background: SURFACE, border: '1px solid var(--fin-border-strong)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--fin-text)', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
      <div className="fin-mono" style={{ color: 'var(--fin-text-2)' }}>
        {unit === 'money' ? formatMoney(s.value, 'EUR', 0) : `${s.value}`}
        {total > 0 && <> · {formatPercent(s.value / total)}</>}
      </div>
    </div>
  )
}

/**
 * Composition of a set of holdings across a categorical dimension (sector or
 * country) as a donut + legend. `unit` decides how the raw amount reads:
 * 'money' formats EUR, 'count' shows a plain tally.
 */
export default function DiversificationBreakdown({
  title,
  slices,
  unit,
}: {
  title: string
  slices: BreakdownSlice[]
  unit: 'money' | 'count'
}) {
  const data = fold(slices)
  const total = data.reduce((sum, s) => sum + s.value, 0)
  const raw = (v: number) => (unit === 'money' ? formatMoney(v, 'EUR', 0) : `${v}`)

  return (
    <div>
      <div className="fin-label" style={{ marginBottom: 10 }}>{title}</div>
      {total <= 0 ? (
        <div className="fin-empty" style={{ fontSize: 12 }}>
          No data yet — use “Fetch sectors &amp; logos”.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={45}
                  outerRadius={72}
                  stroke={SURFACE}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((s, i) => (
                    <Cell key={s.label} fill={SERIES[i % SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} unit={unit} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12, flex: 1, minWidth: 140 }}>
            {data.map((s, i) => (
              <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: SERIES[i % SERIES.length], flexShrink: 0 }} />
                <span className="fin-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
                <span className="fin-subtle" style={{ marginRight: 8 }}>{raw(s.value)}</span>
                <span className="fin-mono fin-subtle">{formatPercent(s.value / total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
