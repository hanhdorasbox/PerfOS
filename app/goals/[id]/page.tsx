import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress } from '@/lib/calculations'
import GoalDetailChart from '@/components/goals/GoalDetailChart'
import ProgressLogger from '@/components/goals/ProgressLogger'
import MilestoneList from '@/components/goals/MilestoneList'

export const dynamic = 'force-dynamic'

export default async function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      progressUpdates: { orderBy: { loggedAt: 'asc' } },
      quarter: true,
    }
  })
  if (!goal) return notFound()

  let progressPct = 0
  if (goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null && goal.currentValue != null) {
    progressPct = calcQuantitativeProgress(goal.startValue, goal.currentValue, goal.targetValue)
  } else if (goal.trackingType === 'MILESTONE') {
    progressPct = calcMilestoneProgress(goal.milestones)
  }
  const metrics = calcGoalMetrics({ startDate: goal.quarter.startDate, deadline: goal.deadline, progressPct })

  const statusColors: Record<string, string> = {
    ahead: '#6BE3A4', on_track: '#60A5FA', watch: '#F2C063',
    at_risk: '#FB923C', critical: '#FF6B6B', completed: '#6BE3A4'
  }
  const color = statusColors[metrics.status] || '#B8B6B0'

  const recentUpdates = goal.progressUpdates.slice().reverse().slice(0, 12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <Link href="/" style={{ fontSize: '12px', color: '#76746E', textDecoration: 'none' }}>← Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FAFAFA', marginTop: '8px' }}>{goal.title}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontSize: '12px', color: '#76746E' }}>{goal.category} · {goal.quarter.name}</span>
          <span className={`badge-${metrics.status}`}>{metrics.statusLabel}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        {[
          { label: 'Progress', value: `${Math.round(progressPct)}%`, color },
          { label: 'Expected', value: `${Math.round(metrics.expectedPct)}%`, color: '#B8B6B0' },
          { label: 'Gap', value: `${metrics.gap >= 0 ? '+' : ''}${Math.round(metrics.gap)}%`, color: metrics.gap >= 0 ? '#6BE3A4' : '#FF6B6B' },
          { label: 'Days left', value: `${Math.round(metrics.daysRemaining)}d`, color: '#B8B6B0' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: '#76746E', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>
          Progress vs Expected Trajectory
        </div>
        <GoalDetailChart
          progressUpdates={goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt.toISOString(), value: u.value }))}
          startDate={goal.quarter.startDate.toISOString()}
          deadline={goal.deadline.toISOString()}
          startValue={goal.startValue}
          targetValue={goal.targetValue}
          trackingType={goal.trackingType}
        />
      </div>

      {/* Advisor recommendation */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '8px' }}>
          Advisor Recommendation
        </div>
        <div style={{ fontSize: '13px', color: '#B8B6B0', lineHeight: 1.6, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          {metrics.recommendation}
        </div>
        {metrics.forecastedCompletionDate && (
          <div style={{ marginTop: 8, fontSize: '12px', color: '#76746E' }}>
            Forecasted completion:{' '}
            <span style={{ color: metrics.forecastedCompletionDate > goal.deadline ? '#FF6B6B' : '#6BE3A4' }}>
              {metrics.forecastedCompletionDate.toLocaleDateString('cs-CZ')}
            </span>
            {' '}(deadline: {goal.deadline.toLocaleDateString('cs-CZ')})
          </div>
        )}
      </div>

      {/* Milestones — interactive */}
      {goal.milestones.length > 0 && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>
            Milestones
          </div>
          <MilestoneList milestones={goal.milestones.map(m => ({ ...m, dueDate: m.dueDate ?? null }))} />
        </div>
      )}

      {/* Progress log + add form */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>
          Progress Log
        </div>

        {recentUpdates.length === 0 && (
          <div style={{ fontSize: '12px', color: '#76746E', fontStyle: 'italic', marginBottom: 12 }}>No progress logged yet.</div>
        )}

        {recentUpdates.map(u => (
          <div key={u.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px' }}>
              <span style={{ color: '#76746E' }}>{new Date(u.loggedAt).toLocaleDateString('cs-CZ')}</span>
              <span style={{ color: '#FAFAFA', fontFamily: 'monospace', fontWeight: 700 }}>
                {u.value}{goal.unit ? ` ${goal.unit}` : ''}
              </span>
            </div>
            {u.note && (
              <div style={{ marginTop: 3, fontSize: '11px', color: '#B8B6B0', lineHeight: 1.5 }}>
                {u.note}
              </div>
            )}
          </div>
        ))}

        <ProgressLogger goalId={goal.id} unit={goal.unit} trackingType={goal.trackingType} />
      </div>
    </div>
  )
}
