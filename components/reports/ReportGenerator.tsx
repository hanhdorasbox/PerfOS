'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Spinner from '@/components/ui/Spinner'

interface Props {
  userId: string
}

export default function ReportGeneratorWidget({ userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ id: string; executiveSummary?: string | null } | null>(null)

  async function generate() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setResult(data)
      router.refresh()
    } catch {
      setError('Failed to generate report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card animate-entrance" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', marginBottom: 12 }}>Generate This Week&apos;s Report</h2>
      <p style={{ fontSize: 13, color: '#A1A1A6', marginBottom: 16, lineHeight: 1.5 }}>
        Analyses your goals, workouts, work items, and career data to generate a comprehensive weekly briefing.
      </p>

      {loading ? (
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <Spinner size={16} color="#C9B8FF" />
          <span style={{ fontSize: 13, color: '#C9B8FF', fontWeight: 500 }}>Analysing your week…</span>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="btn-motion"
          style={{
            background: 'rgba(201,184,255,0.15)',
            border: '1px solid rgba(201,184,255,0.3)',
            color: '#C9B8FF', borderRadius: 8, padding: '10px 20px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Generate Weekly Report
        </button>
      )}

      {error && <div style={{ fontSize: 12, color: '#FFB4A8', marginTop: 10 }}>{error}</div>}

      {result && (
        <div
          className="animate-fade-in"
          style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(159,231,192,0.08)', border: '1px solid rgba(159,231,192,0.2)', borderRadius: 10 }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9FE7C0', marginBottom: 8 }}>Report generated</div>
          {result.executiveSummary && (
            <p style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5, marginBottom: 12 }}>
              {result.executiveSummary.slice(0, 200)}{result.executiveSummary.length > 200 ? '…' : ''}
            </p>
          )}
          <Link href={`/reports/${result.id}`} style={{ fontSize: 13, color: '#C9B8FF', textDecoration: 'none', fontWeight: 600 }}>
            View full report →
          </Link>
        </div>
      )}
    </div>
  )
}
