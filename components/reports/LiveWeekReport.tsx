'use client'

import { useState, useCallback } from 'react'
import type { WeekLiveData } from '@/app/api/reports/live/route'

interface Report {
  id: string
  weekStart: string
  weekEnd: string
  status: string
  liveData: string | null
  updatedAt: string
}

interface Props {
  initialReport: Report | null
  userId: string
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  thriving:  { label: 'Thriving',  color: '#6BE3A4', bg: 'rgba(107,227,164,0.12)',  border: 'rgba(107,227,164,0.3)',  icon: '⚡' },
  stable:    { label: 'Stable',    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.3)',   icon: '●' },
  watch:     { label: 'Watch',     color: '#F2C063', bg: 'rgba(242,192,99,0.12)',   border: 'rgba(242,192,99,0.3)',   icon: '⚠' },
  risk:      { label: 'Risk',      color: '#FB923C', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.3)',   icon: '▲' },
  recovery:  { label: 'Recovery',  color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)',  border: 'rgba(255,107,107,0.3)',  icon: '↻' },
} as const

const GOAL_STATUS_COLOR: Record<string, string> = {
  ahead: '#6BE3A4', on_track: '#60A5FA', watch: '#F2C063', at_risk: '#FB923C', critical: '#FF6B6B', no_data: '#76746E',
}

const DOMAIN_STATUS_COLOR: Record<string, string> = {
  thriving: '#6BE3A4', stable: '#60A5FA', watch: '#F2C063', risk: '#FF6B6B', inactive: '#76746E',
}

const FORECAST_COLOR: Record<string, string> = {
  ahead: '#6BE3A4', on_track: '#60A5FA', late: '#F2C063', stalled: '#FF6B6B',
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${color}20`, border: `1px solid ${color}40`, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

function Bar({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
      {children}
    </p>
  )
}

function BulletList({ items, color = '#B8B6B0', numbered = false }: { items: string[]; color?: string; numbered?: boolean }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {numbered
            ? <span style={{ background: `${color}18`, color, fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            : <span style={{ color, flexShrink: 0, marginTop: 3, fontSize: 10 }}>●</span>}
          <span style={{ color: '#FAFAFA', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveWeekReport({ initialReport, userId }: Props) {
  const [report, setReport] = useState<Report | null>(initialReport)
  const [data, setData] = useState<WeekLiveData | null>(() => {
    if (!initialReport?.liveData) return null
    try { return JSON.parse(initialReport.liveData) } catch { return null }
  })
  const [refreshing, setRefreshing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true); setError(null)
    try {
      const res = await fetch('/api/reports/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const updated = await res.json() as Report
      setReport(updated)
      if (updated.liveData) setData(JSON.parse(updated.liveData))
    } catch { setError('Failed to refresh') } finally { setRefreshing(false) }
  }, [userId])

  const analyze = useCallback(async () => {
    if (!report) return
    setAnalyzing(true); setError(null)
    try {
      const res = await fetch('/api/reports/live/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, userId }),
      })
      const result = await res.json() as { ai: WeekLiveData['ai'] }
      if (result.ai) setData(prev => prev ? { ...prev, ai: result.ai } : prev)
    } catch { setError('AI analysis failed') } finally { setAnalyzing(false) }
  }, [report, userId])

  if (!data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <p style={{ color: '#B8B6B0', fontSize: 14, marginBottom: 16 }}>No live data yet for this week.</p>
        <button onClick={refresh} disabled={refreshing} style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.3)', color: '#B4A7E5', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {refreshing ? 'Loading…' : 'Load Live Report'}
        </button>
      </div>
    )
  }

  const statusCfg = STATUS_CFG[data.snapshot.status as keyof typeof STATUS_CFG] || STATUS_CFG.stable
  const weekStartFmt = report ? new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  const weekEndFmt = report ? new Date(report.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  const updatedAgo = report ? (() => {
    const mins = Math.round((Date.now() - new Date(report.updatedAt).getTime()) / 60000)
    return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
  })() : ''

  return (
    <div>
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FAFAFA' }}>
            Week of {weekStartFmt}–{weekEndFmt}
          </h2>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(107,227,164,0.15)', border: '1px solid rgba(107,227,164,0.3)', color: '#6BE3A4' }}>
            ● LIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#76746E', fontSize: 11 }}>Updated {updatedAgo}</span>
          <button onClick={refresh} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: refreshing ? '#76746E' : '#B8B6B0', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: refreshing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Week progress bar ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <span key={d} style={{ color: '#76746E', fontSize: 10, fontWeight: 500 }}>{d}</span>
          ))}
        </div>
        <Bar pct={data.weekProgress} color={statusCfg.color} height={6} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: '#76746E', fontSize: 11 }}>{data.weekProgress}% through the week</span>
          <span style={{ color: '#76746E', fontSize: 11 }}>{data.daysLeft} day{data.daysLeft !== 1 ? 's' : ''} left</span>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── A. EXECUTIVE SNAPSHOT ─────────────────────────────────────────── */}
      <div style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.1em', color: statusCfg.color }}>
            {statusCfg.icon} {statusCfg.label.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {data.snapshot.wins.length > 0 && (
            <div>
              <p style={{ color: '#6BE3A4', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>✓ Wins</p>
              <BulletList items={data.snapshot.wins} color="#6BE3A4" />
            </div>
          )}
          {data.snapshot.risks.length > 0 && (
            <div>
              <p style={{ color: '#F2C063', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>⚠ Risks</p>
              <BulletList items={data.snapshot.risks} color="#F2C063" />
            </div>
          )}
        </div>
        {(data.snapshot.focus || data.snapshot.systemNote) && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${statusCfg.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.snapshot.focus && (
              <p style={{ fontSize: 13, color: '#FAFAFA' }}>
                <span style={{ color: statusCfg.color, fontWeight: 700 }}>→ Focus: </span>{data.snapshot.focus}
              </p>
            )}
            {data.snapshot.systemNote && (
              <p style={{ fontSize: 12, color: '#B8B6B0' }}>
                <span style={{ color: '#76746E', fontWeight: 700 }}>System: </span>{data.snapshot.systemNote}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Avatar metrics row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'XP This Week', value: `+${data.avatar.xpThisWeek}`, color: '#B4A7E5' },
          { label: 'Tasks Done', value: data.avatar.tasksCompleted, color: '#60A5FA' },
          { label: 'Goals Advanced', value: data.avatar.goalsAdvanced, color: '#6BE3A4' },
          { label: 'Week Rating', value: `${data.avatar.weekRating}/5`, color: data.avatar.weekRating >= 4 ? '#6BE3A4' : data.avatar.weekRating >= 3 ? '#F2C063' : '#FF6B6B' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ color: '#76746E', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
            <p style={{ color: m.color, fontSize: 20, fontWeight: 700 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── B. GOAL PROGRESS ──────────────────────────────────────────────── */}
      {data.goals.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <SectionLabel>B · Goal Progress</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.goals.map(g => {
              const color = GOAL_STATUS_COLOR[g.status] || '#B8B6B0'
              return (
                <div key={g.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 700 }}>{g.title}</span>
                        <Chip label={g.status.replace('_', ' ')} color={color} />
                      </div>
                      {g.nextMilestone && (
                        <p style={{ color: '#76746E', fontSize: 11 }}>Next: {g.nextMilestone}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ color, fontSize: 18, fontWeight: 700 }}>{g.currentPct}%</p>
                      <p style={{ color: '#76746E', fontSize: 11 }}>
                        {g.gap >= 0 ? <span style={{ color: '#6BE3A4' }}>+{g.gap}% ahead</span> : <span style={{ color: '#F2C063' }}>{g.gap}% behind</span>}
                      </p>
                    </div>
                  </div>
                  <Bar pct={g.currentPct} color={color} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: '#76746E', fontSize: 10 }}>Progress: {g.currentPct}%</span>
                    <span style={{ color: '#76746E', fontSize: 10 }}>Expected: {g.expectedPct}%{g.weekDelta !== 0 ? ` · +${g.weekDelta}% this week` : ''}</span>
                    <span style={{ color: '#76746E', fontSize: 10 }}>{g.daysToDeadline}d left</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── C. TASK EXECUTION ─────────────────────────────────────────────── */}
      {data.tasks && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <SectionLabel>C · Task Execution</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Completion', value: `${data.tasks.rate}%`, sub: `${data.tasks.completed}/${data.tasks.planned} done`, color: data.tasks.rate >= 70 ? '#6BE3A4' : data.tasks.rate >= 50 ? '#F2C063' : '#FF6B6B' },
              { label: 'Priority-1', value: `${data.tasks.p1Rate}%`, sub: `${data.tasks.p1Completed}/${data.tasks.p1Planned} must-do`, color: data.tasks.p1Rate >= 80 ? '#6BE3A4' : data.tasks.p1Rate >= 50 ? '#F2C063' : '#FF6B6B' },
              { label: 'Missed', value: data.tasks.missed, sub: `tasks not done`, color: data.tasks.missed === 0 ? '#6BE3A4' : data.tasks.missed <= 2 ? '#F2C063' : '#FF6B6B' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <p style={{ color: '#76746E', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: m.color, fontSize: 20, fontWeight: 700 }}>{m.value}</p>
                <p style={{ color: '#76746E', fontSize: 11, marginTop: 2 }}>{m.sub}</p>
              </div>
            ))}
          </div>
          <Bar pct={data.tasks.rate} color={data.tasks.rate >= 70 ? '#6BE3A4' : data.tasks.rate >= 50 ? '#F2C063' : '#FF6B6B'} />
        </div>
      )}

      {/* ── E. DOMAIN BREAKDOWN ───────────────────────────────────────────── */}
      {data.domains.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>E · Domain Breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {data.domains.map(d => {
              const dColor = DOMAIN_STATUS_COLOR[d.status] || '#76746E'
              return (
                <div key={d.name} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${dColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 700 }}>{d.name}</span>
                    <Chip label={d.status} color={dColor} />
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {d.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} style={{ color: '#B8B6B0', fontSize: 12, lineHeight: 1.4 }}>· {b}</li>
                    ))}
                  </ul>
                  {d.nextAction && (
                    <p style={{ color: dColor, fontSize: 11, marginTop: 8, fontWeight: 600 }}>→ {d.nextAction}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── F. ANTI-DRIFT ─────────────────────────────────────────────────── */}
      {data.antiDrift.total > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <SectionLabel>F · Anti-Drift — {data.antiDrift.total} work items</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Advancement', value: data.antiDrift.advancementPct, color: '#6BE3A4' },
              { label: 'Maintenance', value: data.antiDrift.maintenancePct, color: '#60A5FA' },
              { label: 'Reactive',    value: data.antiDrift.reactivePct,    color: '#F2C063' },
              { label: 'Busywork',    value: data.antiDrift.busyworkPct,    color: '#FF6B6B' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <p style={{ color: m.color, fontSize: 22, fontWeight: 700 }}>{m.value}%</p>
                <p style={{ color: '#76746E', fontSize: 10, marginTop: 2 }}>{m.label}</p>
                <div style={{ marginTop: 6 }}><Bar pct={m.value} color={m.color} height={4} /></div>
              </div>
            ))}
          </div>
          {data.antiDrift.advancementPct < 30 && (
            <p style={{ color: '#F2C063', fontSize: 12 }}>⚠ Less than 30% of effort went to advancement — add 2 advancement blocks next week</p>
          )}
          {data.antiDrift.busyworkPct > 25 && (
            <p style={{ color: '#FF6B6B', fontSize: 12 }}>⚠ High busywork ({data.antiDrift.busyworkPct}%) — review if these tasks are goal-linked</p>
          )}
        </div>
      )}

      {/* ── G. FORECAST ───────────────────────────────────────────────────── */}
      {data.forecast.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <SectionLabel>G · Forecast — if current pace continues</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.forecast.map(f => {
              const color = FORECAST_COLOR[f.status] || '#B8B6B0'
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                      <Chip label={f.status.replace('_', ' ')} color={color} />
                    </div>
                    <p style={{ color: '#76746E', fontSize: 11, marginTop: 2 }}>
                      {f.status === 'stalled' ? 'No progress this week — timeline at risk'
                        : f.daysLate > 0 ? `${f.daysLate} days late at current pace`
                        : `On track — projected ${f.projectedFinalPct}% by deadline`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color, fontSize: 16, fontWeight: 700 }}>{f.currentPct}%</p>
                    <p style={{ color: '#76746E', fontSize: 10 }}>{f.daysToDeadline}d left</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AI ANALYSIS SECTION ───────────────────────────────────────────── */}
      {!data.ai ? (
        <div style={{ textAlign: 'center', padding: '20px 0', marginBottom: 16 }}>
          <button
            onClick={analyze}
            disabled={analyzing}
            style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.35)', color: '#B4A7E5', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer' }}
          >
            {analyzing ? '⏳ Analyzing with AI…' : '✦ Generate AI Analysis'}
          </button>
          <p style={{ color: '#76746E', fontSize: 12, marginTop: 8 }}>
            Generates task patterns, next week plan, system adjustments
          </p>
        </div>
      ) : (
        <>
          {/* ── H. NEXT WEEK PLAN ──────────────────────────────────────── */}
          {(data.ai.nextWeekPriorities?.length > 0 || data.ai.nextWeekTasks?.length > 0) && (
            <div style={{ background: 'rgba(107,227,164,0.05)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <SectionLabel>H · Next Week Plan</SectionLabel>
              {data.ai.nextWeekPriorities?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Top priorities</p>
                  <BulletList items={data.ai.nextWeekPriorities} color="#6BE3A4" numbered />
                </div>
              )}
              {data.ai.nextWeekTasks?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Suggested tasks</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.ai.nextWeekTasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <span style={{ background: 'rgba(107,227,164,0.15)', color: '#6BE3A4', fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{t.title}</span>
                          {t.day && <span style={{ color: '#76746E', fontSize: 11, marginLeft: 8 }}>{t.day}</span>}
                          {t.why && <p style={{ color: '#76746E', fontSize: 11, marginTop: 1 }}>{t.why}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.ai.toDrop?.length > 0 && (
                <div>
                  <p style={{ color: '#F2C063', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Drop or defer</p>
                  <BulletList items={data.ai.toDrop} color="#F2C063" />
                </div>
              )}
            </div>
          )}

          {/* ── I. AVATAR IMPACT ───────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
            <SectionLabel>I · Avatar Impact</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'XP Gained',       value: `+${data.avatar.xpThisWeek}`,            color: '#B4A7E5' },
                { label: 'Strongest Domain', value: data.avatar.strongestDomain ?? '—',      color: '#6BE3A4' },
                { label: 'Week Rating',      value: `${'★'.repeat(data.avatar.weekRating)}${'☆'.repeat(5 - data.avatar.weekRating)}`, color: data.avatar.weekRating >= 4 ? '#6BE3A4' : data.avatar.weekRating >= 3 ? '#F2C063' : '#FF6B6B' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ color: '#76746E', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
                  <p style={{ color: m.color, fontSize: 16, fontWeight: 700 }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── J. SYSTEM ADJUSTMENTS ──────────────────────────────────── */}
          {(data.ai.systemAdjustments?.length > 0 || data.ai.taskPatterns?.length > 0) && (
            <div style={{ background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <SectionLabel>J · System Adjustments for Next Week</SectionLabel>
              {data.ai.taskPatterns?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Task patterns detected</p>
                  <BulletList items={data.ai.taskPatterns} color="#B4A7E5" />
                </div>
              )}
              {data.ai.systemAdjustments?.length > 0 && (
                <div>
                  <p style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Apply next week</p>
                  <BulletList items={data.ai.systemAdjustments} color="#B4A7E5" numbered />
                </div>
              )}
              {data.ai.executiveBullets?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(180,167,229,0.15)' }}>
                  <BulletList items={data.ai.executiveBullets} color="#76746E" />
                </div>
              )}
            </div>
          )}

          {/* Chief of staff message */}
          {data.ai.chiefMsg && (
            <div style={{ padding: '16px 20px', background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.2)', borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Chief of Staff</p>
              <p style={{ color: '#FAFAFA', fontSize: 14, fontStyle: 'italic', lineHeight: 1.6 }}>
                &ldquo;{data.ai.chiefMsg}&rdquo;
              </p>
            </div>
          )}

          {/* Re-analyze button */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <button onClick={analyze} disabled={analyzing} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#76746E', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
              {analyzing ? 'Regenerating…' : '↻ Regenerate AI analysis'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
