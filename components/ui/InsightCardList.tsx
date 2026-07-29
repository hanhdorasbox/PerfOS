'use client'

import { useState, type ReactNode, type CSSProperties } from 'react'
import FilterTabs from './FilterTabs'

export interface InsightListItem {
  id: string
  /** Domain/category — drives the filter tabs. */
  tag: string
  node: ReactNode
}

/**
 * Renders the filter tabs + the animated card stack shared by both insight
 * pages. Filtering animates cards out/in (height + opacity via .insight-item,
 * which respects prefers-reduced-motion). `accentStyle` lets a page point the
 * accent CSS vars at its own colour (e.g. Career purple) so the tabs and each
 * card's right column tint match the surface.
 */
export default function InsightCardList({
  items,
  allLabel = 'All',
  accentStyle,
}: {
  items: InsightListItem[]
  allLabel?: string
  accentStyle?: CSSProperties
}) {
  const [active, setActive] = useState<string | null>(null)

  // Counts per tag, in first-seen order.
  const order: string[] = []
  const counts: Record<string, number> = {}
  for (const it of items) {
    if (!(it.tag in counts)) {
      counts[it.tag] = 0
      order.push(it.tag)
    }
    counts[it.tag] += 1
  }

  const tabs = [
    { key: null as string | null, label: allLabel, count: items.length },
    ...order.map((t) => ({ key: t, label: t, count: counts[t] })),
  ]

  return (
    <div style={accentStyle}>
      <FilterTabs tabs={tabs} active={active} onChange={setActive} />
      <div className="insight-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it) => {
          const hidden = active !== null && it.tag !== active
          return (
            <div key={it.id} className={`insight-item${hidden ? ' hidden' : ''}`}>
              <div className="insight-item-inner">{it.node}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
