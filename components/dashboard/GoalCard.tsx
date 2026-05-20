'use client'
import Link from 'next/link'
import { GoalMetrics } from '@/lib/calculations'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  goal: any
  metrics: GoalMetrics
}

const statusColors: Record<string, string> = {
  ahead: '#6BE3A4', on_track: '#60A5FA', watch: '#F2C063', at_risk: '#FB923C', critical: '#FF6B6B', completed: '#6BE3A4'
}

export default function GoalCard({ goal, metrics }: Props) {
  const color = statusColors[metrics.status] || '#B8B6B0'

  // Build chart data from progress updates
  const chartData = goal.progressUpdates?.map((u: any) => ({
    date: new Date(u.loggedAt).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' }),
    actual: goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null
      ? Math.round((u.value - goal.startValue) / (goal.targetValue - goal.startValue) * 100)
      : u.value,
    expected: Math.round(((new Date(u.loggedAt).getTime() - new Date(goal.createdAt).getTime()) / (new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime())) * 100),
  })) || []

  return (
    <div className="card card-interactive" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#76746E', marginBottom: '4px' }}>
            {goal.category}
          </div>
          <Link href={`/goals/${goal.id}`} style={{ fontSize: '16px', fontWeight: 700, color: '#FAFAFA', textDecoration: 'none' }}>
            {goal.title}
          </Link>
        </div>
        <span className={`badge-${metrics.status}`}>{metrics.statusLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '32px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#FAFAFA', lineHeight: 1 }}>
            {Math.round(metrics.progressPct)}%
          </div>
          <div style={{ fontSize: '11px', color: '#76746E', marginTop: '2px' }}>complete</div>
        </div>
        {goal.trackingType === 'QUANTITATIVE' && goal.currentValue != null && (
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#B8B6B0', lineHeight: 1 }}>
              {goal.currentValue} {goal.unit}
            </div>
            <div style={{ fontSize: '11px', color: '#76746E', marginTop: '2px' }}>
              {goal.startValue} → {goal.targetValue} {goal.unit}
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: '#76746E' }}>Expected today</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#B8B6B0' }}>{Math.round(metrics.expectedPct)}%</div>
          <div style={{ fontSize: '11px', color: metrics.gap >= 0 ? '#6BE3A4' : '#FF6B6B', fontWeight: 700 }}>
            {metrics.gap >= 0 ? '+' : ''}{Math.round(metrics.gap)}% gap
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
          {/* Expected marker */}
          <div style={{ position: 'absolute', top: 0, left: `${metrics.expectedPct}%`, width: '2px', height: '100%', background: 'rgba(255,255,255,0.25)', zIndex: 2 }} />
          {/* Actual fill */}
          <div className="progress-fill" style={{ height: '100%', width: `${metrics.progressPct}%`, borderRadius: '3px', background: color }} />
        </div>
      </div>

      {/* Mini chart if we have data */}
      {chartData.length > 2 && (
        <div style={{ height: '60px', marginBottom: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="actual" stroke={color} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expected" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Tooltip contentStyle={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recommendation */}
      <div style={{ fontSize: '12px', color: '#76746E', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', lineHeight: 1.5 }}>
        {metrics.recommendation}
      </div>

      {metrics.forecastedCompletionDate && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#76746E' }}>
          Forecasted completion: <span style={{ color: metrics.forecastedCompletionDate > new Date(goal.deadline) ? '#FF6B6B' : '#6BE3A4', fontWeight: 600 }}>
            {metrics.forecastedCompletionDate.toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}
          </span>
          {' '}(deadline: {new Date(goal.deadline).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })})
        </div>
      )}

      {/* Milestones if any */}
      {goal.milestones?.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: '8px' }}>Milestones</div>
          {goal.milestones.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '12px' }}>{m.completed ? '✓' : '○'}</span>
              <span style={{ fontSize: '12px', color: m.completed ? '#76746E' : '#B8B6B0', textDecoration: m.completed ? 'line-through' : 'none', flex: 1 }}>{m.title}</span>
              <span style={{ fontSize: '10px', color: '#76746E' }}>{m.weight}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
