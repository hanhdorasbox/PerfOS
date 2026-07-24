'use client'

import { useState } from 'react'

interface Props {
  gap: number
  weeksRemaining: number
  quarterName: string
}

export default function RescuePlanButton({ gap, weeksRemaining, quarterName }: Props) {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (gap >= -15) return null

  const weeklyNeeded = weeksRemaining > 0 ? Math.ceil(Math.abs(gap) / weeksRemaining) : Math.abs(gap)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/quarter/rescue-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap, weeksRemaining, quarterName }),
      })
      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan)
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      {/* Context line */}
      <div style={{
        fontSize: 12, color: '#ffc648', marginBottom: 10, lineHeight: 1.55,
        padding: '9px 13px',
        background: 'rgba(255, 198, 72,0.06)',
        borderRadius: 10,
        border: '1px solid rgba(255, 198, 72,0.15)',
      }}>
        <strong>{weeksRemaining}</strong> {weeksRemaining === 1 ? 'week' : 'weeks'} remaining.
        {' '}To catch up you need <strong>~{weeklyNeeded}% per week</strong>.
      </div>

      {!plan ? (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 12, fontWeight: 700, color: '#ffc648',
            background: 'rgba(255, 198, 72,0.08)',
            border: '1px solid rgba(255, 198, 72,0.25)',
            borderRadius: 8, padding: '8px 16px', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Generating plan…' : 'Generate rescue plan'}
        </button>
      ) : (
        <>
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              fontSize: 12, fontWeight: 600, color: '#64f0aa',
              background: 'rgba(100, 240, 170,0.08)',
              border: '1px solid rgba(100, 240, 170,0.2)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              marginBottom: open ? 10 : 0,
            }}
          >
            {open ? 'Hide rescue plan' : 'Show rescue plan'}
          </button>

          {open && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(100, 240, 170,0.04)',
              border: '1px solid rgba(100, 240, 170,0.15)',
              fontSize: 13, color: '#9E9EA6', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {plan}
            </div>
          )}
        </>
      )}
    </div>
  )
}
