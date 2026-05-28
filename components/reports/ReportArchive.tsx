'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  weekStart: string
  weekEnd: string
  executiveSummary: string | null
  goalBreakdown: string | null
  status: string
  liveData: string | null
}

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  thriving: { color: '#30D158', label: 'Thriving' },
  stable:   { color: '#0A84FF', label: 'Stable'   },
  watch:    { color: '#FFD60A', label: 'Watch'     },
  risk:     { color: '#FF9F0A', label: 'Risk'      },
  recovery: { color: '#FF453A', label: 'Recovery'  },
  strong:   { color: '#30D158', label: 'Strong'    },
  neutral:  { color: '#0A84FF', label: 'Neutral'   },
  weak:     { color: '#FFD60A', label: 'Weak'      },
}

function deriveStatus(report: Report): string {
  if (report.status && STATUS_CFG[report.status]) return report.status
  try {
    const gb = JSON.parse(report.goalBreakdown || '[]')
    if (!gb.length) return 'neutral'
    const avg = gb.reduce((s: number, g: { delta?: number }) => s + (g.delta || 0), 0) / gb.length
    return avg >= 5 ? 'strong' : avg >= 0 ? 'neutral' : 'weak'
  } catch { return 'neutral' }
}

function getArchiveMetrics(report: Report): { taskRate: number | null; goalsOnTrack: number | null; xp: number | null } {
  if (!report.liveData) return { taskRate: null, goalsOnTrack: null, xp: null }
  try {
    const d = JSON.parse(report.liveData)
    return {
      taskRate: d.tasks?.rate ?? null,
      goalsOnTrack: d.goals ? d.goals.filter((g: { status: string }) => g.status === 'on_track' || g.status === 'ahead').length : null,
      xp: d.avatar?.xpThisWeek ?? null,
    }
  } catch { return { taskRate: null, goalsOnTrack: null, xp: null } }
}

export default function ReportArchive({ reports: initReports }: { reports: Report[] }) {
  const [reports, setReports] = useState<Report[]>(initReports)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (reports.length === 0) return null

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return
    setDeleting(id); setError('')
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setReports(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setTimeout(() => setError(''), 4000)
    } finally { setDeleting(null) }
  }

  return (
    <div>
      {error && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF453A', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map(report => {
          const status = deriveStatus(report)
          const cfg = STATUS_CFG[status] || STATUS_CFG.neutral
          const metrics = getArchiveMetrics(report)
          return (
            <div
              key={report.id}
              className="card"
              style={{ opacity: deleting === report.id ? 0.4 : 1, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7' }}>
                        {new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(report.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${cfg.color}20`, border: `1px solid ${cfg.color}40`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {metrics.taskRate !== null && (
                        <span style={{ color: '#6E6E73', fontSize: 11 }}>Tasks: <span style={{ color: metrics.taskRate >= 70 ? '#30D158' : '#FFD60A' }}>{metrics.taskRate}%</span></span>
                      )}
                      {metrics.goalsOnTrack !== null && (
                        <span style={{ color: '#6E6E73', fontSize: 11 }}>On track: <span style={{ color: '#0A84FF' }}>{metrics.goalsOnTrack}</span></span>
                      )}
                      {metrics.xp !== null && (
                        <span style={{ color: '#6E6E73', fontSize: 11 }}>XP: <span style={{ color: '#BF5AF2' }}>+{metrics.xp}</span></span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#A1A1A6' }}>→</span>
                </div>
              </Link>
              <button
                onClick={() => deleteReport(report.id)}
                disabled={deleting === report.id}
                style={{ background: 'none', border: '1px solid rgba(255,107,107,0.2)', color: '#FF453A', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
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
