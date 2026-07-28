'use client'

import { formatMoney, formatPercent } from '@/lib/invest/format'

// Validated categorical palette (dataviz skill) — fixed slot order, folds to
// "Other" past 7 so a long tail never explodes the legend.
const SERIES = ['#1f85ff', '#00b778', '#c98500', '#008300', '#7f6fff', '#ff4e4e', '#fc2a76', '#ff4900']

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

/**
 * Composition of a set of holdings across a categorical dimension (sector or
 * country) as a single segmented bar + legend. `unit` decides how the raw
 * amount reads: 'money' formats EUR, 'count' shows a plain tally.
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
          No data yet — refresh an analysis to pull sector &amp; country.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              height: 12,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            {data.map((s, i) => (
              <div
                key={s.label}
                title={`${s.label} · ${raw(s.value)} · ${formatPercent(s.value / total)}`}
                style={{ width: `${(s.value / total) * 100}%`, background: SERIES[i % SERIES.length] }}
              />
            ))}
          </div>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, fontSize: 12 }}>
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
        </>
      )}
    </div>
  )
}
