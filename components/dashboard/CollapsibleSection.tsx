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
          textTransform: 'uppercase', color: '#6E6E76',
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(232,144,122,0.15)', color: '#E8907A',
            textTransform: 'uppercase',
          }}>
            {badge}
          </span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{
            marginLeft: 'auto', flexShrink: 0,
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#52525A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!collapsed && children}
    </div>
  )
}
