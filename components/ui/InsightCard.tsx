'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface InsightCardProps {
  /** Resolved severity/confidence colour (a token, e.g. var(--danger)). */
  severityColor: string
  /** "5/5" or "High" — whatever the source page already uses. */
  severityLabel: string
  /** Optional dot scale shown collapsed (e.g. 3 of 5). */
  dots?: { filled: number; total: number }
  title: string
  /** Small tag also used by the filter tabs (domain / category). */
  domainTag?: string
  leftLabel: string
  leftItems: string[]
  rightLabel: string
  rightItems?: string[]
  /** Escape hatch: rich right-column content (overrides rightItems). */
  rightContent?: ReactNode
  /** Full-width block above the two columns (chips, notes). */
  bodyExtra?: ReactNode
  /** Action row rendered at the bottom of the expanded body. */
  actions?: ReactNode
  defaultOpen?: boolean
}

function Dots({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: i < filled ? color : 'rgba(255,255,255,0.12)' }}
        />
      ))}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 12, lineHeight: 1.55 }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>{t}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Collapsible insight card: severity badge → title → dots → chevron, collapsed
 * by default, expanding into a 2-column body (left = the "why" in neutral grey,
 * right = the "impact/action" tinted with the surface accent). The left edge
 * carries a 3px severity-coloured border as the primary scan cue.
 */
export default function InsightCard({
  severityColor,
  severityLabel,
  dots,
  title,
  domainTag,
  leftLabel,
  leftItems,
  rightLabel,
  rightItems,
  rightContent,
  bodyExtra,
  actions,
  defaultOpen = false,
}: InsightCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="card" style={{ padding: 0, borderLeft: `3px solid ${severityColor}`, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit',
        }}
      >
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: severityColor,
            background: `color-mix(in srgb, ${severityColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${severityColor} 32%, transparent)`,
            flexShrink: 0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}
        >
          {severityLabel}
        </span>
        <span
          style={{
            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {title}
        </span>
        {domainTag && (
          <span className="hide-mobile" style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>{domainTag}</span>
        )}
        {dots && <Dots filled={dots.filled} total={dots.total} color={severityColor} />}
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0, color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </button>

      <div className={`insight-body${open ? ' open' : ''}`}>
        <div className="insight-body-inner">
          <div style={{ padding: '0 16px 16px' }}>
            {bodyExtra && <div style={{ marginBottom: 12 }}>{bodyExtra}</div>}
            <div className="insight-cols">
              <div>
                <div className="insight-collabel">{leftLabel}</div>
                {leftItems.length > 0 ? <BulletList items={leftItems} /> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
              </div>
              <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                <div className="insight-collabel" style={{ color: 'var(--accent)' }}>{rightLabel}</div>
                {rightContent ??
                  (rightItems && rightItems.length > 0 ? (
                    <BulletList items={rightItems} />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                  ))}
              </div>
            </div>
            {actions && <div style={{ marginTop: 12 }}>{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
