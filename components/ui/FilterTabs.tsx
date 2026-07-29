'use client'

export interface FilterTab {
  /** null = the "All" tab */
  key: string | null
  label: string
  count: number
}

/**
 * Horizontal pill filter tabs (All + one per distinct tag, with counts). Shared
 * by both insight pages; accent follows the surface via --accent.
 */
export default function FilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: FilterTab[]
  active: string | null
  onChange: (key: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }} role="tablist" aria-label="Filter">
      {tabs.map((t) => {
        const on = active === t.key
        return (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`insight-tab${on ? ' active' : ''}`}
          >
            {t.label}
            <span className="count">{t.count}</span>
          </button>
        )
      })}
    </div>
  )
}
