'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GoalMetrics } from '@/lib/calculations'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  goal: any
  metrics: GoalMetrics
}

const statusColors: Record<string, string> = {
  ahead:     '#7FD5AA',
  on_track:  '#80BDFF',
  watch:     '#ECC666',
  at_risk:   '#F5A56A',
  critical:  '#FF9B87',
  completed: '#7FD5AA',
}

// Progress fill color: blue as default, status color only for off-track states
function progressColor(status: string): string {
  if (status === 'ahead' || status === 'on_track' || status === 'completed') return '#80BDFF'
  return statusColors[status] ?? '#80BDFF'
}

export default function GoalCard({ goal, metrics }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const accentColor = statusColors[metrics.status] || '#A1A1A6'
  const fillColor   = progressColor(metrics.status)

  // Deadline urgency coloring
  const daysUntilDeadline = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
  const isDeadlineSoon = daysUntilDeadline !== null && daysUntilDeadline < 3
  const isDeadlineCritical = daysUntilDeadline !== null && daysUntilDeadline < 1
  const deadlineColor = isDeadlineCritical ? '#FF9B87' : isDeadlineSoon ? '#ECC666' : undefined

  // H8: inline quick-log for QUANTITATIVE goals
  const [logOpen, setLogOpen]   = useState(false)
  const [logValue, setLogValue] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  async function quickLog() {
    if (!logValue.trim()) return
    setLogSaving(true)
    try {
      await fetch(`/api/goals/${goal.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseFloat(logValue), note: null }),
      })
      setLogValue(''); setLogOpen(false)
      startTransition(() => router.refresh())
    } finally {
      setLogSaving(false)
    }
  }

  // C2: no-data flag for QUANTITATIVE goals
  const hasNoData = goal.trackingType === 'QUANTITATIVE' && goal.currentValue == null

  const chartData = goal.progressUpdates?.map((u: any) => ({
    date: new Date(u.loggedAt).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' }),
    actual: goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null
      ? Math.round((u.value - goal.startValue) / (goal.targetValue - goal.startValue) * 100)
      : u.value,
    expected: Math.round(
      ((new Date(u.loggedAt).getTime() - new Date(goal.createdAt).getTime()) /
       (new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime())) * 100
    ),
  })) || []

  return (
    <div className="card card-interactive" style={{ padding: '22px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#52525A', marginBottom: 6,
          }}>
            {goal.category}
          </div>
          <Link href={`/goals/${goal.id}`} style={{
            fontSize: 16, fontWeight: 600, color: '#EEEEF2',
            textDecoration: 'none', letterSpacing: '-0.02em', lineHeight: 1.35,
            display: 'block',
          }}>
            {goal.title}
          </Link>
        </div>
        <span className={`badge-${metrics.status}`}>{metrics.statusLabel}</span>
      </div>

      {/* C2: No-data callout for brand-new QUANTITATIVE goals */}
      {hasNoData && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 12, color: '#6E6E73' }}>No data logged yet — </span>
          <button onClick={() => setLogOpen(v => !v)} style={{ fontSize: 12, color: '#B8A4FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            log first value
          </button>
        </div>
      )}

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{
            fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: hasNoData ? '#48484A' : '#F5F5F7', lineHeight: 1, letterSpacing: '-0.03em',
          }}>
            {Math.round(metrics.progressPct)}%
          </div>
          <div style={{ fontSize: 10, color: '#52525A', marginTop: 4, letterSpacing: '0.02em' }}>complete</div>
        </div>

        {goal.trackingType === 'QUANTITATIVE' && goal.currentValue != null && (
          <div>
            <div style={{ fontSize: 19, fontWeight: 600, color: '#9E9EA6', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {goal.currentValue} {goal.unit}
            </div>
            <div style={{ fontSize: 11, color: '#52525A', marginTop: 3 }}>
              {goal.startValue} → {goal.targetValue} {goal.unit}
            </div>
          </div>
        )}

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#52525A', marginBottom: 3 }}>Expected today</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9E9EA6', letterSpacing: '-0.02em' }}>
            {Math.round(metrics.expectedPct)}%
          </div>
          <div style={{
            fontSize: 12, fontWeight: 500, marginTop: 3,
            color: metrics.gap >= 0 ? '#7FD5AA' : '#E8907A',
          }}>
            {metrics.gap >= 0 ? '+' : ''}{Math.round(metrics.gap)}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Expected marker */}
          <div style={{
            position: 'absolute', top: 0, left: `${Math.min(99, metrics.expectedPct)}%`,
            width: 2, height: '100%', background: 'rgba(255,255,255,0.2)', zIndex: 2,
          }} />
          {/* Actual fill */}
          <div className="progress-fill" style={{
            height: '100%', width: `${metrics.progressPct}%`,
            borderRadius: 999, background: fillColor,
          }} />
        </div>
      </div>

      {/* Mini sparkline */}
      {chartData.length > 2 && (
        <div style={{ height: 52, marginBottom: 14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone" dataKey="actual"
                stroke={fillColor} strokeWidth={2} dot={false}
              />
              <Line
                type="monotone" dataKey="expected"
                stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                strokeDasharray="3 3" dot={false}
              />
              <Tooltip contentStyle={{
                background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, fontSize: 11, color: '#F5F5F7',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recommendation note */}
      <div style={{
        fontSize: 13, color: '#9E9EA6', lineHeight: 1.6,
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.025)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.055)',
        letterSpacing: '-0.005em',
      }}>
        {metrics.recommendation}
      </div>

      {metrics.forecastedCompletionDate && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#52525A' }}>
          Forecast{' '}
          <span style={{
            color: metrics.forecastedCompletionDate > new Date(goal.deadline) ? '#E8907A' : '#7FD5AA',
            fontWeight: 500,
          }}>
            {metrics.forecastedCompletionDate.toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
          </span>
          {' · '}deadline {' '}
          <span style={{ color: deadlineColor ?? '#52525A', fontWeight: deadlineColor ? 600 : 400 }}>
            {new Date(goal.deadline).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
            {isDeadlineCritical ? ' ⚠️' : isDeadlineSoon ? ' ⏰' : ''}
          </span>
        </div>
      )}

      {/* H8: Quick log progress for QUANTITATIVE goals */}
      {goal.trackingType === 'QUANTITATIVE' && (
        <div style={{ marginTop: 12 }}>
          {!logOpen ? (
            <button onClick={() => setLogOpen(true)} style={{ fontSize: 11, color: '#B8A4FF', background: 'none', border: '1px dashed rgba(184,164,255,0.3)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', width: '100%' }}>
              + Log Progress
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                value={logValue}
                onChange={e => setLogValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && quickLog()}
                placeholder={`New value${goal.unit ? ` (${goal.unit})` : ''}`}
                autoFocus
                style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(184,164,255,0.3)', color: '#F5F5F7', fontSize: 13, outline: 'none' }}
              />
              <button onClick={quickLog} disabled={logSaving || !logValue.trim()} style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.35)', color: '#B8A4FF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {logSaving ? '…' : 'Save'}
              </button>
              <button onClick={() => setLogOpen(false)} style={{ padding: '6px 10px', borderRadius: 7, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {goal.milestones?.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10,
          }}>
            Milestones
          </div>
          {goal.milestones.map((m: any) => (
            <div key={m.id} style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: m.completed ? '#7FD5AA' : 'transparent',
                border: `2px solid ${m.completed ? '#7FD5AA' : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m.completed && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: 13, flex: 1,
                color: m.completed ? '#6E6E73' : '#A1A1A6',
                textDecoration: m.completed ? 'line-through' : 'none',
              }}>{m.title}</span>
              <span style={{ fontSize: 11, color: '#48484A' }}>{m.weight}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
