'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function getCurrentQuarterDefaults() {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()

  let qNum: number, startMonth: number, endMonth: number
  if (month < 3) { qNum = 1; startMonth = 0; endMonth = 2 }
  else if (month < 6) { qNum = 2; startMonth = 3; endMonth = 5 }
  else if (month < 9) { qNum = 3; startMonth = 6; endMonth = 8 }
  else { qNum = 4; startMonth = 9; endMonth = 11 }

  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, endMonth + 1, 0) // last day of end month

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  return {
    name: `Q${qNum} ${year}`,
    startDate: fmt(startDate),
    endDate: fmt(endDate),
  }
}

export default function CreateQuarterForm() {
  const router = useRouter()
  const defaults = getCurrentQuarterDefaults()

  const [name, setName] = useState(defaults.name)
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/quarter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startDate, endDate }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Failed to create quarter')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 32, maxWidth: 480 }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <h2 style={{ color: '#F5F5F7', fontSize: 18, fontWeight: 700, margin: 0 }}>
          Create your first quarter
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#6E6E73', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Quarter name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '10px 14px',
              color: '#F5F5F7', fontSize: 14, outline: 'none',
            }}
          />
        </div>

        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#6E6E73', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '10px 14px',
                color: '#F5F5F7', fontSize: 14, outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#6E6E73', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '10px 14px',
                color: '#F5F5F7', fontSize: 14, outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        {error && <p style={{ color: '#FF9B87', fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            background: saving ? 'rgba(184,164,255,0.1)' : 'rgba(184,164,255,0.2)',
            border: '1px solid rgba(184,164,255,0.4)',
            color: '#B8A4FF',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Creating…' : 'Create Quarter'}
        </button>
      </div>
    </form>
  )
}
