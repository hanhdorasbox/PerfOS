import type { ReactNode } from 'react'
import Link from 'next/link'

export type EmptyStateVariant = 'page' | 'card' | 'column' | 'collapsed'

export interface EmptyStateProps {
  variant: EmptyStateVariant
  /** An outline lucide-react icon; it inherits the accent colour. */
  icon: ReactNode
  /** Plain fact — "No skills added yet". No jokes, no "Oops". */
  title: string
  /** One sentence: why filling this in matters, not just what to click. */
  description?: string
  ctaLabel?: string
  onCtaClick?: () => void
  /** Alternative to onCtaClick for navigation (usable from server components). */
  ctaHref?: string
  /** Tighter spacing for card/column variants where space is short. */
  compact?: boolean
}

const ICON_BOX: Record<EmptyStateVariant, number> = { page: 48, card: 32, column: 32, collapsed: 32 }
const ICON_SIZE: Record<EmptyStateVariant, number> = { page: 24, card: 17, column: 18, collapsed: 17 }

/**
 * The app's single empty-state primitive. Accent (icon tint, CTA, glow) follows
 * the surface automatically via the --accent-* CSS variables — blue on
 * Performance OS, gold inside `.finance-os` — so nothing here hardcodes colour.
 *
 * Variants:
 *  - `page`     full-page: large icon, title, description, primary CTA
 *  - `card`     inside a populated page: smaller icon + compact CTA
 *  - `column`   kanban column: icon + short label only (the dashed column says "empty")
 *  - `collapsed`compact inline row (used by CategoryGroup's expanded empty cards)
 */
export default function EmptyState({
  variant,
  icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  ctaHref,
  compact,
}: EmptyStateProps) {
  const isPage = variant === 'page'
  const box = ICON_BOX[variant]

  const iconEl = (
    <span
      className="empty-icon empty-icon-breath"
      style={{ width: box, height: box, fontSize: ICON_SIZE[variant] }}
      aria-hidden
    >
      {icon}
    </span>
  )

  // Column variant: icon + short label only, centred, no sentence.
  if (variant === 'column') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', textAlign: 'center' }}>
        {iconEl}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{title}</span>
      </div>
    )
  }

  const cta =
    ctaLabel && (ctaHref || onCtaClick) ? (
      ctaHref ? (
        <Link href={ctaHref} className={`empty-cta${compact || !isPage ? ' compact' : ''}`}>
          {ctaLabel}
        </Link>
      ) : (
        <button type="button" onClick={onCtaClick} className={`empty-cta${compact || !isPage ? ' compact' : ''}`}>
          {ctaLabel}
        </button>
      )
    ) : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: isPage ? 12 : 9,
        padding: isPage ? '56px 24px' : compact ? '20px 16px' : '28px 20px',
      }}
    >
      {iconEl}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
        <div style={{ fontSize: isPage ? 14.5 : 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {description && (
          <p
            style={{
              fontSize: isPage ? 12.5 : 11.5,
              lineHeight: 1.5,
              color: 'var(--text-muted)',
              maxWidth: isPage ? 340 : 260,
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {cta && <div style={{ marginTop: 3 }}>{cta}</div>}
    </div>
  )
}
