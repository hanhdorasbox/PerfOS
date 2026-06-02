'use client'
import { useState, useEffect } from 'react'

interface Props {
  title: string
  defaultCollapsed?: boolean
  children: React.ReactNode
  badge?: string
}

export default function CollapsibleSection({ title, defaultCollapsed = false, children, badge }: Props) {
  const storageKey = `collapsible_${title.replace(/\s+/g, '_').toLowerCase()}`
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) setCollapsed(stored === 'true')
    } catch {}
  }, [storageKey])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(storageKey, String(next)) } catch {}
  }

  return (
    <div>
      <button
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 0 18px 0',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: '#6E6E73',
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,155,135,0.15)', color: '#FF9B87',
            textTransform: 'uppercase',
          }}>
            {badge}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#52525A' }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && children}
    </div>
  )
}
