'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BehaviorPattern } from '@prisma/client'

interface Props {
  userId: string
  existingPatterns: BehaviorPattern[]
}

interface AnalyzedPattern {
  domain: string
  pattern: string
  evidence: string
  confidence: number
  implication: string
}

const domainColors: Record<string, string> = {
  quarterly_planning: '#B8A4FF',
  weekly: '#80BDFF',
  fitness: '#7FD5AA',
  meals: '#ECC666',
  forecasting: '#F5A56A',
  learning: '#FF9B87',
}

export default function PatternAnalyzer({ userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [patterns, setPatterns] = useState<AnalyzedPattern[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function runAnalysis() {
    setLoading(true)
    setError('')
    setPatterns([])
    setSaved(false)
    try {
      const res = await fetch('/api/operating-manual/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setPatterns(data.patterns || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function confirmPatterns() {
    setSaving(true)
    try {
      await Promise.all(
        patterns.map(p =>
          fetch('/api/operating-manual/patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...p }),
          })
        )
      )
      setSaved(true)
      setPatterns([])
      router.refresh()
    } catch {
      setError('Failed to save patterns')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        onClick={runAnalysis}
        disabled={loading}
        style={{
          background: loading ? 'rgba(184,164,255,0.2)' : 'rgba(184,164,255,0.15)',
          border: '1px solid rgba(184,164,255,0.4)',
          color: '#B8A4FF', padding: '8px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '⏳ Analyzing your historical data...' : '⚙️ Analyze My Patterns'}
      </button>

      {error && (
        <p style={{ color: '#FF9B87', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}

      {saved && (
        <p style={{ color: '#7FD5AA', fontSize: 13, marginTop: 8 }}>Patterns saved successfully!</p>
      )}

      {patterns.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ color: '#F5F5F7', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {patterns.length} new pattern{patterns.length !== 1 ? 's' : ''} identified
            </p>
            <p style={{ color: '#A1A1A6', fontSize: 13 }}>Review and confirm to save.</p>
          </div>

          {patterns.map((p, i) => (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  background: `${domainColors[p.domain] ?? '#6E6E73'}20`,
                  color: domainColors[p.domain] ?? '#6E6E73',
                  border: `1px solid ${domainColors[p.domain] ?? '#6E6E73'}40`,
                  padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                }}>
                  {p.domain}
                </span>
                <span style={{ color: '#6E6E73', fontSize: 12 }}>Confidence: {p.confidence}/5</span>
              </div>
              <p style={{ color: '#F5F5F7', fontSize: 14, marginBottom: 6 }}>{p.pattern}</p>
              {p.evidence && <p style={{ color: '#A1A1A6', fontSize: 12, marginBottom: 4 }}>Evidence: {p.evidence}</p>}
              {p.implication && (
                <p style={{ color: '#B8A4FF', fontSize: 12 }}>→ {p.implication}</p>
              )}
            </div>
          ))}

          <button
            onClick={confirmPatterns}
            disabled={saving}
            style={{
              background: 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.4)',
              color: '#7FD5AA', padding: '8px 20px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              marginTop: 8,
            }}
          >
            {saving ? 'Saving...' : `Save ${patterns.length} Patterns`}
          </button>
        </div>
      )}
    </div>
  )
}
