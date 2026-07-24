'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

interface AntiDriftReport {
  id: string
  periodType: string
  periodStart: string
  periodEnd: string
  advancementPct: number
  maintenancePct: number
  reactivePct: number
  busyworkPct: number
  momentum: string
  durableAssets?: string | null
  aiAnalysis?: string | null
  createdAt: string
}

interface Props {
  userId: string
  pastReports: AntiDriftReport[]
}

const MOMENTUM_COLORS: Record<string, string> = {
  forward_strongly: '#64f0aa',
  forward_slowly: '#61adff',
  stagnant: '#ffce53',
  fragmented: '#ffce53',
  overloaded: '#ff8168',
}

const MOMENTUM_LABELS: Record<string, string> = {
  forward_strongly: 'Forward — Strongly',
  forward_slowly: 'Forward — Slowly',
  stagnant: 'Stagnant',
  fragmented: 'Fragmented',
  overloaded: 'Overloaded',
}

export default function ReportGenerator({ userId, pastReports: initPastReports }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<null | 'monthly' | 'quarterly'>(null)
  const [error, setError] = useState('')
  const [latestReport, setLatestReport] = useState<AntiDriftReport | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pastReports, setPastReports] = useState<AntiDriftReport[]>(initPastReports)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deleteReport(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/anti-drift/report/${id}`, { method: 'DELETE' })
      setPastReports(prev => prev.filter(r => r.id !== id))
      if (latestReport?.id === id) setLatestReport(null)
    } finally {
      setDeleting(null)
    }
  }

  async function generate(periodType: 'monthly' | 'quarterly') {
    setLoading(periodType)
    setError('')
    try {
      const res = await fetch('/api/anti-drift/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, periodType }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setLatestReport(data)
      router.refresh()
    } catch {
      setError('Failed to generate report.')
    } finally {
      setLoading(null)
    }
  }

  function parseAnalysis(raw?: string | null) {
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  function renderReport(report: AntiDriftReport) {
    const analysis = parseAnalysis(report.aiAnalysis)
    const assets = (() => { try { return JSON.parse(report.durableAssets || '[]') } catch { return [] } })()
    const color = MOMENTUM_COLORS[report.momentum] || '#A1A1A6'

    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { label: 'Advancement', value: `${Math.round(report.advancementPct)}%`, color: '#64f0aa' },
            { label: 'Maintenance', value: `${Math.round(report.maintenancePct)}%`, color: '#61adff' },
            { label: 'Reactive', value: `${Math.round(report.reactivePct)}%`, color: '#ffce53' },
            { label: 'Busywork', value: `${Math.round(report.busyworkPct)}%`, color: '#ff8168' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: '#A1A1A6' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analysis.insights?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A1A1A6', marginBottom: 6 }}>INSIGHTS</div>
                {analysis.insights.map((ins: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: '#F5F5F7', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {ins}
                  </div>
                ))}
              </div>
            )}
            {analysis.recommendations?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A1A1A6', marginBottom: 6 }}>RECOMMENDATIONS</div>
                {analysis.recommendations.map((rec: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: '#A1A1A6', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    → {rec}
                  </div>
                ))}
              </div>
            )}
            {assets.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A1A1A6', marginBottom: 6 }}>DURABLE ASSETS CREATED</div>
                {assets.map((asset: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: '#64f0aa', padding: '2px 0' }}>✓ {asset}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Generate Report</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => generate('monthly')}
          disabled={loading !== null}
          className="btn-motion"
          style={{ background: 'rgba(160, 133, 255,0.15)', border: '1px solid rgba(160, 133, 255,0.3)', color: '#a085ff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {loading === 'monthly' && <Spinner size={13} color="#a085ff" strokeWidth={1.5} />}
          {loading === 'monthly' ? 'Generating…' : 'Generate Monthly Report'}
        </button>
        <button
          onClick={() => generate('quarterly')}
          disabled={loading !== null}
          className="btn-motion"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {loading === 'quarterly' && <Spinner size={13} color="#A1A1A6" strokeWidth={1.5} />}
          {loading === 'quarterly' ? 'Generating…' : 'Generate Quarterly Report'}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ff8168', marginBottom: 12 }}>{error}</div>}

      {latestReport && (
        <div style={{ marginBottom: 20, padding: 16, background: 'rgba(100, 240, 170,0.06)', border: '1px solid rgba(100, 240, 170,0.2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7' }}>
              {latestReport.periodType === 'monthly' ? 'Monthly' : 'Quarterly'} Report
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
              background: `${MOMENTUM_COLORS[latestReport.momentum]}22`,
              border: `1px solid ${MOMENTUM_COLORS[latestReport.momentum]}44`,
              color: MOMENTUM_COLORS[latestReport.momentum],
            }}>
              {MOMENTUM_LABELS[latestReport.momentum] || latestReport.momentum}
            </span>
          </div>
          {renderReport(latestReport)}
        </div>
      )}

      {pastReports.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#A1A1A6', marginBottom: 10 }}>Past Reports</div>
          {pastReports.map(report => {
            const isOpen = expandedId === report.id
            const color = MOMENTUM_COLORS[report.momentum] || '#A1A1A6'
            return (
              <div key={report.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4, opacity: deleting === report.id ? 0.4 : 1, transition: 'opacity 0.15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : report.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#F5F5F7', textTransform: 'capitalize' }}>{report.periodType} — {new Date(report.periodStart).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44` }}>
                        {MOMENTUM_LABELS[report.momentum] || report.momentum}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#A1A1A6' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  <button
                    onClick={() => deleteReport(report.id)}
                    disabled={deleting === report.id}
                    style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 13, padding: '0 8px', flexShrink: 0 }}
                    title="Delete"
                  >✕</button>
                </div>
                {isOpen && <div className="expand-enter">{renderReport(report)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
