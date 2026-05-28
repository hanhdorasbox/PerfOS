'use client'
import Link from 'next/link'
import { GoalMetrics } from '@/lib/calculations'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  goal: any
  metrics: GoalMetrics
}

const statusColors: Record<string, string> = {
  ahead:     '#30D158',
  on_track:  '#0A84FF',
  watch:     '#FFD60A',
  at_risk:   '#FF9F0A',
  critical:  '#FF453A',
  completed: '#30D158',
}

// Progress fill color: blue as default, status color only for off-track states
function progressColor(status: string): string {
  if (status === 'ahead' || status === 'on_track' || status === 'completed') return '#0A84FF'
  return statusColors[status] ?? '#0A84FF'
}

export default function GoalCard({ goal, metrics }: Props) {
  const accentColor = statusColors[metrics.status] || '#A1A1A6'
  const fillColor   = progressColor(metrics.status)

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
            fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#6E6E73', marginBottom: 5,
          }}>
            {goal.category}
          </div>
          <Link href={`/goals/${goal.id}`} style={{
            fontSize: 17, fontWeight: 600, color: '#F5F5F7',
            textDecoration: 'none', letterSpacing: '-0.02em', lineHeight: 1.3,
            display: 'block',
          }}>
            {goal.title}
          </Link>
        </div>
        <span className={`badge-${metrics.status}`}>{metrics.statusLabel}</span>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{
            fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: '#F5F5F7', lineHeight: 1, letterSpacing: '-0.03em',
          }}>
            {Math.round(metrics.progressPct)}%
          </div>
          <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 3, letterSpacing: '0.02em' }}>complete</div>
        </div>

        {goal.trackingType === 'QUANTITATIVE' && goal.currentValue != null && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#A1A1A6', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {goal.currentValue} {goal.unit}
            </div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 3 }}>
              {goal.startValue} → {goal.targetValue} {goal.unit}
            </div>
          </div>
        )}

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 2 }}>Expected today</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#A1A1A6', letterSpacing: '-0.02em' }}>
            {Math.round(metrics.expectedPct)}%
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, marginTop: 2,
            color: metrics.gap >= 0 ? '#30D158' : '#FF453A',
          }}>
            {metrics.gap >= 0 ? '+' : ''}{Math.round(metrics.gap)}% gap
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
        fontSize: 13, color: '#A1A1A6', lineHeight: 1.55,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {metrics.recommendation}
      </div>

      {metrics.forecastedCompletionDate && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#6E6E73' }}>
          Forecast{' '}
          <span style={{
            color: metrics.forecastedCompletionDate > new Date(goal.deadline) ? '#FF453A' : '#30D158',
            fontWeight: 600,
          }}>
            {metrics.forecastedCompletionDate.toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
          </span>
          {' · '}deadline {new Date(goal.deadline).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
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
                background: m.completed ? '#30D158' : 'transparent',
                border: `2px solid ${m.completed ? '#30D158' : 'rgba(255,255,255,0.2)'}`,
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
