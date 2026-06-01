'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { WeekLiveData } from '@/lib/types/reports'

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
  thriving:  { label: 'Thriving',  color: '#7FD5AA', bg: 'rgba(127,213,170,0.12)',  border: 'rgba(127,213,170,0.3)',  icon: '▲' },
  stable:    { label: 'Stable',    color: '#80BDFF', bg: 'rgba(128,189,255,0.12)',   border: 'rgba(128,189,255,0.3)',   icon: '●' },
  watch:     { label: 'Watch',     color: '#ECC666', bg: 'rgba(236,198,102,0.12)',   border: 'rgba(236,198,102,0.3)',   icon: '!' },
  risk:      { label: 'Risk',      color: '#F5A56A', bg: 'rgba(245,165,106,0.12)',   border: 'rgba(245,165,106,0.3)',   icon: '▲' },
  recovery:  { label: 'Recovery',  color: '#FF9B87', bg: 'rgba(255,155,135,0.12)',  border: 'rgba(255,155,135,0.3)',  icon: '↻' },
} as const

const GOAL_STATUS_COLOR: Record<string, string> = {
  ahead: '#7FD5AA', on_track: '#80BDFF', watch: '#ECC666', at_risk: '#F5A56A', critical: '#FF9B87', no_data: '#6E6E73',
}

const DOMAIN_STATUS_COLOR: Record<string, string> = {
  thriving: '#7FD5AA', stable: '#80BDFF', watch: '#ECC666', risk: '#FF9B87', inactive: '#6E6E73',
}

const FORECAST_COLOR: Record<string, string> = {
  ahead: '#7FD5AA', on_track: '#80BDFF', late: '#ECC666', stalled: '#FF9B87',
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
    <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
      {children}
    </p>
  )
}

function BulletList({ items, color = '#A1A1A6', numbered = false }: { items: string[]; color?: string; numbered?: boolean }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {numbered
            ? <span style={{ background: `${color}18`, color, fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            : <span style={{ color, flexShrink: 0, marginTop: 3, fontSize: 10 }}>●</span>}
          <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
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
  const [refreshing, setRefreshing] = useState(!initialReport?.liveData) // auto-start if no data
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track which task indices have been added to the week plan
  const [addedTasks, setAddedTasks] = useState<Set<number>>(new Set())
  const [addingAll, setAddingAll] = useState(false)

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

  // Auto-load on mount if no live data yet
  useEffect(() => {
    if (!data) { refresh() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh every 5 minutes while the page is open
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => { refresh() }, 5 * 60 * 1000)
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [refresh])

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

  // Add a single AI-suggested task to this week's plan
  const addTask = useCallback(async (task: { title: string; why?: string; day?: string }, index: number) => {
    if (!report) return
    try {
      const res = await fetch(`/api/reports/${report.id}/add-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tasks: [{ ...task, priority: index < 2 ? 1 : 2 }] }),
      })
      if (res.ok) setAddedTasks(prev => new Set(prev).add(index))
    } catch { /* ignore */ }
  }, [report, userId])

  // Add all AI-suggested tasks to this week's plan at once
  const addAllTasks = useCallback(async () => {
    if (!report || !data?.ai?.nextWeekTasks?.length) return
    setAddingAll(true)
    try {
      const tasks = data.ai.nextWeekTasks.map((t, i) => ({ ...t, priority: (i < 2 ? 1 : 2) as 1 | 2 }))
      const res = await fetch(`/api/reports/${report.id}/add-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tasks }),
      })
      if (res.ok) setAddedTasks(new Set(data.ai.nextWeekTasks.map((_, i) => i)))
    } catch { /* ignore */ } finally { setAddingAll(false) }
  }, [report, userId, data])

  if (!data) {
    // Skeleton loading state — shown while auto-loading on mount
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ height: 22, width: 140, background: 'rgba(255,255,255,0.06)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 20, width: 50, background: 'rgba(127,213,170,0.15)', borderRadius: 99 }} />
          </div>
          <div style={{ height: 28, width: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 16 }} />
        {/* Snapshot skeleton */}
        <div style={{ background: 'rgba(128,189,255,0.06)', border: '1px solid rgba(128,189,255,0.15)', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ height: 14, width: 80, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[0, 1].map(i => (
              <div key={i}>
                <div style={{ height: 10, width: 60, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 10 }} />
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ height: 12, width: `${70 + j * 10}%`, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 6 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* KPI row skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ height: 9, width: '60%', background: 'rgba(255,255,255,0.06)', borderRadius: 3, margin: '0 auto 8px' }} />
              <div style={{ height: 24, width: '50%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, margin: '0 auto' }} />
            </div>
          ))}
        </div>
        {/* Goals skeleton */}
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ height: 9, width: 100, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 14 }} />
          {[0,1,2].map(i => (
            <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 8, borderLeft: '3px solid rgba(255,255,255,0.08)' }}>
              <div style={{ height: 13, width: `${50 + i * 15}%`, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginBottom: 10 }} />
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
            </div>
          ))}
        </div>
        {error && (
          <div style={{ background: 'rgba(255,155,135,0.1)', border: '1px solid rgba(255,155,135,0.2)', color: '#FF9B87', borderRadius: 8, padding: '8px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={refresh} style={{ background: 'none', border: '1px solid rgba(255,155,135,0.4)', color: '#FF9B87', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Retry</button>
          </div>
        )}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
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
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F7' }}>
            Week of {weekStartFmt}–{weekEndFmt}
          </h2>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.3)', color: '#7FD5AA' }}>
            ● LIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#6E6E73', fontSize: 11 }}>Updated {updatedAgo}</span>
          <button onClick={refresh} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: refreshing ? '#6E6E73' : '#A1A1A6', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: refreshing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Week progress bar ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <span key={d} style={{ color: '#6E6E73', fontSize: 10, fontWeight: 500 }}>{d}</span>
          ))}
        </div>
        <Bar pct={data.weekProgress} color={statusCfg.color} height={6} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: '#6E6E73', fontSize: 11 }}>{data.weekProgress}% through the week</span>
          <span style={{ color: '#6E6E73', fontSize: 11 }}>{data.daysLeft} day{data.daysLeft !== 1 ? 's' : ''} left</span>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,155,135,0.1)', border: '1px solid rgba(255,155,135,0.2)', color: '#FF9B87', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
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
              <p style={{ color: '#7FD5AA', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>✓ Wins</p>
              <BulletList items={data.snapshot.wins} color="#7FD5AA" />
            </div>
          )}
          {data.snapshot.risks.length > 0 && (
            <div>
              <p style={{ color: '#ECC666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Risks</p>
              <BulletList items={data.snapshot.risks} color="#ECC666" />
            </div>
          )}
        </div>
        {(data.snapshot.focus || data.snapshot.systemNote) && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${statusCfg.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.snapshot.focus && (
              <p style={{ fontSize: 13, color: '#F5F5F7' }}>
                <span style={{ color: statusCfg.color, fontWeight: 700 }}>→ Focus: </span>{data.snapshot.focus}
              </p>
            )}
            {data.snapshot.systemNote && (
              <p style={{ fontSize: 12, color: '#A1A1A6' }}>
                <span style={{ color: '#6E6E73', fontWeight: 700 }}>System: </span>{data.snapshot.systemNote}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Avatar metrics row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'XP This Week', value: `+${data.avatar.xpThisWeek}`, color: '#B8A4FF' },
          { label: 'Tasks Done', value: data.avatar.tasksCompleted, color: '#80BDFF' },
          { label: 'Goals Advanced', value: data.avatar.goalsAdvanced, color: '#7FD5AA' },
          { label: 'Week Rating', value: `${data.avatar.weekRating}/5`, color: data.avatar.weekRating >= 4 ? '#7FD5AA' : data.avatar.weekRating >= 3 ? '#ECC666' : '#FF9B87' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
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
              const color = GOAL_STATUS_COLOR[g.status] || '#A1A1A6'
              return (
                <div key={g.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 700 }}>{g.title}</span>
                        <Chip label={g.status.replace('_', ' ')} color={color} />
                      </div>
                      {g.nextMilestone && (
                        <p style={{ color: '#6E6E73', fontSize: 11 }}>Next: {g.nextMilestone}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ color, fontSize: 18, fontWeight: 700 }}>{g.currentPct}%</p>
                      <p style={{ color: '#6E6E73', fontSize: 11 }}>
                        {g.gap >= 0 ? <span style={{ color: '#7FD5AA' }}>+{g.gap}% ahead</span> : <span style={{ color: '#ECC666' }}>{g.gap}% behind</span>}
                      </p>
                    </div>
                  </div>
                  <Bar pct={g.currentPct} color={color} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: '#6E6E73', fontSize: 10 }}>Progress: {g.currentPct}%</span>
                    <span style={{ color: '#6E6E73', fontSize: 10 }}>Expected: {g.expectedPct}%{g.weekDelta !== 0 ? ` · +${g.weekDelta}% this week` : ''}</span>
                    <span style={{ color: '#6E6E73', fontSize: 10 }}>{g.daysToDeadline}d left</span>
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
              { label: 'Completion', value: `${data.tasks.rate}%`, sub: `${data.tasks.completed}/${data.tasks.planned} done`, color: data.tasks.rate >= 70 ? '#7FD5AA' : data.tasks.rate >= 50 ? '#ECC666' : '#FF9B87' },
              { label: 'Priority-1', value: `${data.tasks.p1Rate}%`, sub: `${data.tasks.p1Completed}/${data.tasks.p1Planned} must-do`, color: data.tasks.p1Rate >= 80 ? '#7FD5AA' : data.tasks.p1Rate >= 50 ? '#ECC666' : '#FF9B87' },
              { label: 'Missed', value: data.tasks.missed, sub: `tasks not done`, color: data.tasks.missed === 0 ? '#7FD5AA' : data.tasks.missed <= 2 ? '#ECC666' : '#FF9B87' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: m.color, fontSize: 20, fontWeight: 700 }}>{m.value}</p>
                <p style={{ color: '#6E6E73', fontSize: 11, marginTop: 2 }}>{m.sub}</p>
              </div>
            ))}
          </div>
          <Bar pct={data.tasks.rate} color={data.tasks.rate >= 70 ? '#7FD5AA' : data.tasks.rate >= 50 ? '#ECC666' : '#FF9B87'} />
        </div>
      )}

      {/* ── E. DOMAIN BREAKDOWN ───────────────────────────────────────────── */}
      {data.domains.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>E · Domain Breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {data.domains.map(d => {
              const dColor = DOMAIN_STATUS_COLOR[d.status] || '#6E6E73'
              return (
                <div key={d.name} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${dColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 700 }}>{d.name}</span>
                    <Chip label={d.status} color={dColor} />
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {d.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} style={{ color: '#A1A1A6', fontSize: 12, lineHeight: 1.4 }}>· {b}</li>
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
              { label: 'Advancement', value: data.antiDrift.advancementPct, color: '#7FD5AA' },
              { label: 'Maintenance', value: data.antiDrift.maintenancePct, color: '#80BDFF' },
              { label: 'Reactive',    value: data.antiDrift.reactivePct,    color: '#ECC666' },
              { label: 'Busywork',    value: data.antiDrift.busyworkPct,    color: '#FF9B87' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <p style={{ color: m.color, fontSize: 22, fontWeight: 700 }}>{m.value}%</p>
                <p style={{ color: '#6E6E73', fontSize: 10, marginTop: 2 }}>{m.label}</p>
                <div style={{ marginTop: 6 }}><Bar pct={m.value} color={m.color} height={4} /></div>
              </div>
            ))}
          </div>
          {data.antiDrift.advancementPct < 30 && (
            <p style={{ color: '#ECC666', fontSize: 12 }}>Less than 30% of effort went to advancement — add 2 advancement blocks next week</p>
          )}
          {data.antiDrift.busyworkPct > 25 && (
            <p style={{ color: '#FF9B87', fontSize: 12 }}>High busywork ({data.antiDrift.busyworkPct}%) — review if these tasks are goal-linked</p>
          )}
        </div>
      )}

      {/* ── G. FORECAST ───────────────────────────────────────────────────── */}
      {data.forecast.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <SectionLabel>G · Forecast — if current pace continues</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.forecast.map(f => {
              const color = FORECAST_COLOR[f.status] || '#A1A1A6'
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                      <Chip label={f.status.replace('_', ' ')} color={color} />
                    </div>
                    <p style={{ color: '#6E6E73', fontSize: 11, marginTop: 2 }}>
                      {f.status === 'stalled' ? 'No progress this week — timeline at risk'
                        : f.daysLate > 0 ? `${f.daysLate} days late at current pace`
                        : `On track — projected ${f.projectedFinalPct}% by deadline`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color, fontSize: 16, fontWeight: 700 }}>{f.currentPct}%</p>
                    <p style={{ color: '#6E6E73', fontSize: 10 }}>{f.daysToDeadline}d left</p>
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
            style={{ background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.35)', color: '#B8A4FF', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer' }}
          >
            {analyzing ? 'Analyzing with AI…' : 'Generate AI Analysis'}
          </button>
          <p style={{ color: '#6E6E73', fontSize: 12, marginTop: 8 }}>
            Generates task patterns, next week plan, system adjustments
          </p>
        </div>
      ) : (
        <>
          {/* ── H. NEXT WEEK PLAN ──────────────────────────────────────── */}
          {(data.ai.nextWeekPriorities?.length > 0 || data.ai.nextWeekTasks?.length > 0) && (
            <div style={{ background: 'rgba(127,213,170,0.05)', border: '1px solid rgba(127,213,170,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <SectionLabel>H · Next Week Plan</SectionLabel>
              {data.ai.nextWeekPriorities?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#7FD5AA', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Top priorities</p>
                  <BulletList items={data.ai.nextWeekPriorities} color="#7FD5AA" numbered />
                </div>
              )}
              {data.ai.nextWeekTasks?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ color: '#7FD5AA', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Suggested tasks
                    </p>
                    <button
                      onClick={addAllTasks}
                      disabled={addingAll || addedTasks.size === data.ai.nextWeekTasks.length}
                      style={{
                        background: addedTasks.size === data.ai.nextWeekTasks.length
                          ? 'rgba(127,213,170,0.1)' : 'rgba(127,213,170,0.15)',
                        border: '1px solid rgba(127,213,170,0.3)',
                        color: '#7FD5AA', borderRadius: 6, padding: '4px 12px',
                        fontSize: 11, fontWeight: 700, cursor: addingAll ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {addingAll ? '…' : addedTasks.size === data.ai.nextWeekTasks.length
                        ? `✓ All ${data.ai.nextWeekTasks.length} added`
                        : `+ Add all ${data.ai.nextWeekTasks.length} to week`}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.ai.nextWeekTasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: addedTasks.has(i) ? 'rgba(127,213,170,0.04)' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${addedTasks.has(i) ? 'rgba(127,213,170,0.15)' : 'transparent'}`, transition: 'all 0.2s' }}>
                        <span style={{ background: 'rgba(127,213,170,0.15)', color: '#7FD5AA', fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: addedTasks.has(i) ? '#7FD5AA' : '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{t.title}</span>
                          {t.day && <span style={{ color: '#6E6E73', fontSize: 11, marginLeft: 8 }}>{t.day}</span>}
                          {t.why && <p style={{ color: '#6E6E73', fontSize: 11, marginTop: 1 }}>{t.why}</p>}
                        </div>
                        <button
                          onClick={() => addTask(t, i)}
                          disabled={addedTasks.has(i)}
                          style={{
                            flexShrink: 0,
                            background: addedTasks.has(i) ? 'rgba(127,213,170,0.1)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${addedTasks.has(i) ? 'rgba(127,213,170,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            color: addedTasks.has(i) ? '#7FD5AA' : '#6E6E73',
                            borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                            cursor: addedTasks.has(i) ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {addedTasks.has(i) ? '✓ Added' : '+ Week'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.ai.toDrop?.length > 0 && (
                <div>
                  <p style={{ color: '#ECC666', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Drop or defer</p>
                  <BulletList items={data.ai.toDrop} color="#ECC666" />
                </div>
              )}
            </div>
          )}

          {/* ── I. AVATAR IMPACT ───────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
            <SectionLabel>I · Avatar Impact</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'XP Gained',       value: `+${data.avatar.xpThisWeek}`,            color: '#B8A4FF' },
                { label: 'Strongest Domain', value: data.avatar.strongestDomain ?? '—',      color: '#7FD5AA' },
                { label: 'Week Rating',      value: `${'★'.repeat(data.avatar.weekRating)}${'☆'.repeat(5 - data.avatar.weekRating)}`, color: data.avatar.weekRating >= 4 ? '#7FD5AA' : data.avatar.weekRating >= 3 ? '#ECC666' : '#FF9B87' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{m.label}</p>
                  <p style={{ color: m.color, fontSize: 16, fontWeight: 700 }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── J. SYSTEM ADJUSTMENTS ──────────────────────────────────── */}
          {(data.ai.systemAdjustments?.length > 0 || data.ai.taskPatterns?.length > 0) && (
            <div style={{ background: 'rgba(184,164,255,0.06)', border: '1px solid rgba(184,164,255,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <SectionLabel>J · System Adjustments for Next Week</SectionLabel>
              {data.ai.taskPatterns?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#B8A4FF', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Task patterns detected</p>
                  <BulletList items={data.ai.taskPatterns} color="#B8A4FF" />
                </div>
              )}
              {data.ai.systemAdjustments?.length > 0 && (
                <div>
                  <p style={{ color: '#B8A4FF', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Apply next week</p>
                  <BulletList items={data.ai.systemAdjustments} color="#B8A4FF" numbered />
                </div>
              )}
              {data.ai.executiveBullets?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(184,164,255,0.15)' }}>
                  <BulletList items={data.ai.executiveBullets} color="#6E6E73" />
                </div>
              )}
            </div>
          )}

          {/* Chief of staff message */}
          {data.ai.chiefMsg && (
            <div style={{ padding: '16px 20px', background: 'rgba(184,164,255,0.06)', border: '1px solid rgba(184,164,255,0.2)', borderRadius: 12, marginBottom: 16 }}>
              <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Chief of Staff</p>
              <p style={{ color: '#F5F5F7', fontSize: 14, fontStyle: 'italic', lineHeight: 1.6 }}>
                &ldquo;{data.ai.chiefMsg}&rdquo;
              </p>
            </div>
          )}

          {/* Re-analyze button */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <button onClick={analyze} disabled={analyzing} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
              {analyzing ? 'Regenerating…' : '↻ Regenerate AI analysis'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
