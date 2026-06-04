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
  const metrics = calcGoalMetrics({
    startDate: goal.createdAt, // C1: goal's own start date
    deadline: goal.deadline,
    progressPct,
    progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
  })

  const statusColors: Record<string, string> = {
    ahead: '#7FD5AA', on_track: '#80BDFF', watch: '#ECC666',
    at_risk: '#F5A56A', critical: '#FF9B87', completed: '#7FD5AA'
  }
  const color = statusColors[metrics.status] || '#A1A1A6'

  const recentUpdates = goal.progressUpdates.slice().reverse().slice(0, 12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <Link href="/" style={{ fontSize: '12px', color: '#6E6E73', textDecoration: 'none' }}>← Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#F5F5F7', marginTop: '8px' }}>{goal.title}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontSize: '12px', color: '#6E6E73' }}>{goal.category} · {goal.quarter.name}</span>
          <span className={`badge-${metrics.status}`}>{metrics.statusLabel}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        {[
          { label: 'Progress', value: `${Math.round(progressPct)}%`, color },
          { label: 'Expected', value: `${Math.round(metrics.expectedPct)}%`, color: '#A1A1A6' },
          { label: 'Gap', value: `${metrics.gap >= 0 ? '+' : ''}${Math.round(metrics.gap)}%`, color: metrics.gap >= 0 ? '#7FD5AA' : '#FF9B87' },
          { label: 'Days left', value: `${Math.round(metrics.daysRemaining)}d`, color: '#A1A1A6' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: '#6E6E73', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>
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
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '8px' }}>
          Advisor Recommendation
        </div>
        <div style={{ fontSize: '13px', color: '#A1A1A6', lineHeight: 1.6, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          {metrics.recommendation}
        </div>
        {metrics.forecastedCompletionDate && (
          <div style={{ marginTop: 8, fontSize: '12px', color: '#6E6E73' }}>
            Forecasted completion:{' '}
            <span style={{ color: metrics.forecastedCompletionDate > goal.deadline ? '#FF9B87' : '#7FD5AA' }}>
              {metrics.forecastedCompletionDate.toLocaleDateString('cs-CZ')}
            </span>
            {' '}(deadline: {goal.deadline.toLocaleDateString('cs-CZ')})
          </div>
        )}
      </div>

      {/* Milestones — interactive */}
      {goal.milestones.length > 0 && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>
            Milestones
          </div>
          <MilestoneList milestones={goal.milestones.map(m => ({ ...m, dueDate: m.dueDate ?? null }))} />
        </div>
      )}

      {/* Progress log + add form */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>
          Progress Log
        </div>

        {recentUpdates.length === 0 && (
          <div style={{ fontSize: '12px', color: '#6E6E73', fontStyle: 'italic', marginBottom: 12 }}>No progress logged yet.</div>
        )}

        {recentUpdates.map(u => (
          <div key={u.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px' }}>
              <span style={{ color: '#6E6E73' }}>{new Date(u.loggedAt).toLocaleDateString('cs-CZ')}</span>
              <span style={{ color: '#F5F5F7', fontFamily: 'monospace', fontWeight: 700 }}>
                {u.value}{goal.unit ? ` ${goal.unit}` : ''}
              </span>
            </div>
            {u.note && (
              <div style={{ marginTop: 3, fontSize: '11px', color: '#A1A1A6', lineHeight: 1.5 }}>
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
