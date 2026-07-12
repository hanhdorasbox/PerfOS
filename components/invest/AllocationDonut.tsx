'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney, formatPercent } from '@/lib/invest/format'

// Validated categorical palette for the dark surface (dataviz skill,
// OKLCH band + CVD-checked ordering). Slot order is fixed, never cycled;
// slices beyond 8 fold into "Ostatní".
const SERIES = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926']
const SURFACE = '#1A1A1E'

export interface DonutSlice {
  name: string
  valueCzk: number
}

function foldSlices(slices: DonutSlice[]): DonutSlice[] {
  const sorted = [...slices].sort((a, b) => b.valueCzk - a.valueCzk)
  if (sorted.length <= 8) return sorted
  const head = sorted.slice(0, 7)
  const rest = sorted.slice(7).reduce((sum, s) => sum + s.valueCzk, 0)
  return [...head, { name: 'Other', valueCzk: rest }]
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload: DonutSlice }>
  total: number
}) {
  if (!active || !payload?.length) return null
  const slice = payload[0].payload
  return (
    <div
      style={{
        background: SURFACE,
        border: '1px solid var(--fin-border-strong)',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--fin-text)', fontWeight: 600, marginBottom: 2 }}>{slice.name}</div>
      <div className="fin-mono" style={{ color: 'var(--fin-text-2)' }}>
        {formatMoney(slice.valueCzk, 'CZK', 0)}
        {total > 0 && <> · {formatPercent(slice.valueCzk / total)}</>}
      </div>
    </div>
  )
}

export default function AllocationDonut({ title, slices }: { title: string; slices: DonutSlice[] }) {
  const data = foldSlices(slices.filter((s) => s.valueCzk > 0))
  const total = data.reduce((sum, s) => sum + s.valueCzk, 0)

  if (data.length === 0) {
    return (
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 10 }}>{title}</div>
        <div className="fin-empty">No data yet.</div>
      </div>
    )
  }

  return (
    <div className="fin-card">
      <div className="fin-label" style={{ marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valueCzk"
                nameKey="name"
                innerRadius={48}
                outerRadius={76}
                stroke={SURFACE}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((slice, i) => (
                  <Cell key={slice.name} fill={SERIES[i % SERIES.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12, flex: 1, minWidth: 150 }}>
          {data.map((slice, i) => (
            <li
              key={slice.name}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: SERIES[i % SERIES.length],
                  flexShrink: 0,
                }}
              />
              <span className="fin-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {slice.name}
              </span>
              <span className="fin-mono fin-subtle">
                {total > 0 ? formatPercent(slice.valueCzk / total) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
