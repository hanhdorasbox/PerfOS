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
        fontSize: 12, color: '#ECC666', marginBottom: 10, lineHeight: 1.55,
        padding: '9px 13px',
        background: 'rgba(236,198,102,0.06)',
        borderRadius: 10,
        border: '1px solid rgba(236,198,102,0.15)',
      }}>
        Zbývají <strong>{weeksRemaining}</strong> {weeksRemaining === 1 ? 'týden' : weeksRemaining <= 4 ? 'týdny' : 'týdnů'}.
        {' '}Na dohnání potřebuješ <strong>~{weeklyNeeded}% týdně</strong>.
      </div>

      {!plan ? (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 12, fontWeight: 700, color: '#ECC666',
            background: 'rgba(236,198,102,0.08)',
            border: '1px solid rgba(236,198,102,0.25)',
            borderRadius: 8, padding: '8px 16px', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? '⏳ Generuji plán…' : '⚡ Vygeneruj záchranný plán'}
        </button>
      ) : (
        <>
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              fontSize: 12, fontWeight: 600, color: '#7FD5AA',
              background: 'rgba(127,213,170,0.08)',
              border: '1px solid rgba(127,213,170,0.2)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              marginBottom: open ? 10 : 0,
            }}
          >
            {open ? '▲ Skrýt záchranný plán' : '▼ Zobrazit záchranný plán'}
          </button>

          {open && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(127,213,170,0.04)',
              border: '1px solid rgba(127,213,170,0.15)',
              fontSize: 13, color: '#A1A1A6', lineHeight: 1.7,
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
