'use client'

import { useState, type ReactNode, type CSSProperties } from 'react'
import EmptyState from './EmptyState'

export interface CategoryGroupItem {
  key: string
  label: string
  /** Whether this category has no data yet. */
  isEmpty: boolean
  /** The populated card to render when the category has data. */
  children?: ReactNode
  // Fields used to render the expanded empty `card` state:
  emptyIcon: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  ctaLabel?: string
  ctaHref?: string
  onCtaClick?: () => void
}

/**
 * Renders a set of sibling categories, auto-bucketed into populated vs. empty.
 * Populated categories render as their normal cards; the empty ones collapse
 * into a single clickable summary line that expands them back into empty
 * `card`-variant states. Pages pass the list — they don't hand-roll this.
 */
export default function CategoryGroup({
  items,
  gridStyle,
  emptyNoun = 'goals',
}: {
  items: CategoryGroupItem[]
  /** Layout for the populated (and expanded-empty) cards; defaults responsive. */
  gridStyle?: CSSProperties
  /** Noun used in the summary line: "N categories with no {noun} yet". */
  emptyNoun?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const populated = items.filter((i) => !i.isEmpty)
  const empty = items.filter((i) => i.isEmpty)

  const grid: CSSProperties = gridStyle ?? {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {populated.length > 0 && (
        <div style={grid}>
          {populated.map((i) => (
            <div key={i.key} style={{ minWidth: 0 }}>
              {i.children}
            </div>
          ))}
        </div>
      )}

      {empty.length > 0 && !expanded && (
        <button type="button" className="empty-collapsed" onClick={() => setExpanded(true)}>
          <span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{empty.length}</span>{' '}
            {empty.length === 1 ? 'category' : 'categories'} with no {emptyNoun} yet — {empty.map((e) => e.label).join(', ')}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0 }}>Show</span>
        </button>
      )}

      {empty.length > 0 && expanded && (
        <>
          <div style={grid}>
            {empty.map((i) => (
              <div
                key={i.key}
                style={{ minWidth: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}
              >
                <EmptyState
                  variant="card"
                  icon={i.emptyIcon}
                  title={i.emptyTitle ?? `No ${emptyNoun} in ${i.label} yet`}
                  description={i.emptyDescription}
                  ctaLabel={i.ctaLabel}
                  ctaHref={i.ctaHref}
                  onCtaClick={i.onCtaClick}
                  compact
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="empty-collapsed"
            style={{ justifyContent: 'center' }}
            onClick={() => setExpanded(false)}
          >
            Hide empty categories
          </button>
        </>
      )}
    </div>
  )
}
