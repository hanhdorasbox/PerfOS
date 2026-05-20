'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  weekStart: string
  weekEnd: string
  executiveSummary: string | null
  goalBreakdown: string | null
}

const STRENGTH_COLORS: Record<string, string> = {
  strong: '#6BE3A4',
  neutral: '#60A5FA',
  weak: '#FF6B6B',
}

function getStrength(goalBreakdown: string | null): string | null {
  try {
    const gb = JSON.parse(goalBreakdown || '[]')
    if (!gb.length) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avg = gb.reduce((s: number, g: any) => s + (g.delta || 0), 0) / gb.length
    if (avg >= 5) return 'strong'
    if (avg >= 0) return 'neutral'
    return 'weak'
  } catch { return null }
}

export default function ReportArchive({ reports: initReports }: { reports: Report[] }) {
  const [reports, setReports] = useState<Report[]>(initReports)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (reports.length === 0) return null

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return
    setDeleting(id)
    setError('')
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error || 'Delete failed')
      }
      setReports(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setTimeout(() => setError(''), 4000)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8B6B0', marginBottom: 12 }}>
        Report Archive
      </div>

      {error && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map(report => {
          const strength = getStrength(report.goalBreakdown)
          const color = strength ? STRENGTH_COLORS[strength] : '#B8B6B0'
          return (
            <div
              key={report.id}
              className="card"
              style={{
                opacity: deleting === report.id ? 0.4 : 1,
                transition: 'opacity 0.15s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA', marginBottom: 4 }}>
                      Week of {new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' '}–{' '}
                      {new Date(report.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                    {report.executiveSummary && (
                      <div style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.5, maxWidth: 560 }}>
                        {report.executiveSummary.slice(0, 160)}{report.executiveSummary.length > 160 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                    {strength && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: `${color}22`, border: `1px solid ${color}44`, color, textTransform: 'capitalize' }}>
                        {strength}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#B8B6B0' }}>→</span>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => deleteReport(report.id)}
                disabled={deleting === report.id}
                style={{ background: 'none', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
              >
                {deleting === report.id ? '…' : 'Delete'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
