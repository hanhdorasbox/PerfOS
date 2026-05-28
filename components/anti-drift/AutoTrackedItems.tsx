'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WorkItem {
  id: string
  title: string
  category: string
  completedAt: string
}

export default function AutoTrackedItems({ items: initItems }: { items: WorkItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState<WorkItem[]>(initItems)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (items.length === 0) return null

  async function deleteItem(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/anti-drift/items?id=${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  const CATEGORY_COLORS: Record<string, string> = {
    advancement: '#9FE7C0',
    maintenance: '#9FCBFF',
    reactive: '#F3D58A',
    busywork: '#FFB4A8',
  }

  return (
    <div
      style={{
        marginTop: 20,
        padding: '14px 18px',
        background: 'rgba(159,231,192,0.04)',
        border: '1px solid rgba(159,231,192,0.15)',
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9FE7C0' }}>
          Auto-Tracked from Completed Tasks &amp; Milestones
        </div>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(159,231,192,0.15)', color: '#9FE7C0', fontWeight: 700 }}>
          {items.length} items
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.slice(0, 8).map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '5px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              opacity: deleting === item.id ? 0.4 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <span
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'rgba(159,231,192,0.12)',
                color: '#9FE7C0',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              auto
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 3,
                background: item.category === 'advancement' ? 'rgba(159,231,192,0.08)' : 'rgba(159,203,255,0.08)',
                color: CATEGORY_COLORS[item.category] ?? '#A1A1A6',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {item.category}
            </span>
            <span style={{ fontSize: 12, color: '#F5F5F7', flex: 1 }}>{item.title}</span>
            <span style={{ fontSize: 10, color: '#6E6E73', flexShrink: 0 }}>
              {new Date(item.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <button
              onClick={() => deleteItem(item.id)}
              disabled={deleting === item.id}
              style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 13, padding: '0 4px', flexShrink: 0, lineHeight: 1 }}
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length > 8 && (
          <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 4 }}>
            +{items.length - 8} more auto-tracked items
          </div>
        )}
      </div>
    </div>
  )
}
