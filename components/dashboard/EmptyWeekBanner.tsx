'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
}

export default function EmptyWeekBanner({ userId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [count, setCount] = useState(0)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const data = await res.json()
        setCount(data.created ?? 0)
        setDone(true)
        setTimeout(() => startTransition(() => router.refresh()), 1200)
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{
        padding: '14px 18px', borderRadius: 12,
        background: 'rgba(100, 240, 170,0.06)',
        border: '1px solid rgba(100, 240, 170,0.2)',
        fontSize: 13, color: '#64f0aa', fontWeight: 600,
      }}>
        ✓ Generated {count} {count === 1 ? 'task' : 'tasks'} from your goals. Loading…
      </div>
    )
  }

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 14,
      background: 'rgba(160, 133, 255,0.04)',
      border: '1px solid rgba(160, 133, 255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EEEEF2', marginBottom: 4 }}>
          No tasks this week
        </div>
        <div style={{ fontSize: 12, color: '#6E6E76' }}>
          AI can generate tasks directly from your quarterly goals.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <a href="/weekly" style={{
          fontSize: 12, fontWeight: 600, color: '#6E6E76',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
          textDecoration: 'none',
        }}>
          Plan manually →
        </a>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 12, fontWeight: 700, color: '#0A0A0C',
            background: loading ? 'rgba(160, 133, 255,0.5)' : '#a085ff',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Generating…' : 'Generate from goals'}
        </button>
      </div>
    </div>
  )
}
