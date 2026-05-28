import { prisma } from '@/lib/db'
import {
  calcGoalMetrics,
  calcQuantitativeProgress,
  calcMilestoneProgress,
  getQuarterProgress,
} from '@/lib/calculations'
import Link from 'next/link'
import QuarterlyGoalRow from '@/components/quarterly/QuarterlyGoalRow'
import GoalManager from '@/components/quarterly/GoalManager'
import CreateQuarterForm from '@/components/quarterly/CreateQuarterForm'

export const dynamic = 'force-dynamic'

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  career_capital: { label: 'Career Capital', color: '#C9B8FF', bg: 'rgba(201,184,255,0.12)' },
  learning: { label: 'Learning', color: '#9FCBFF', bg: 'rgba(159,203,255,0.12)' },
  fitness: { label: 'Fitness', color: '#9FE7C0', bg: 'rgba(159,231,192,0.12)' },
  finance: { label: 'Finance', color: '#F3D58A', bg: 'rgba(243,213,138,0.12)' },
  high_upside_bet: { label: 'High-Upside Bet', color: '#F7B98E', bg: 'rgba(255,159,107,0.12)' },
  long_term: { label: 'Long-Term', color: '#9FCBFF', bg: 'rgba(77,217,217,0.12)' },
}

const STATUS_COLORS: Record<string, string> = {
  ahead: '#9FE7C0',
  on_track: '#9FE7C0',
  watch: '#F3D58A',
  at_risk: '#F7B98E',
  critical: '#FFB4A8',
  completed: '#C9B8FF',
  paused: '#6E6E73',
}

export default async function QuarterlyPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FFB4A8', padding: 40 }}>No user found.</div>

  // Fetch all quarters with goals
  const quarters = await prisma.quarter.findMany({
    where: { userId: user.id },
    include: {
      goals: {
        include: {
          milestones: true,
          progressUpdates: { orderBy: { loggedAt: 'asc' } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  const activeQuarter = quarters.find(q => q.status === 'active') || quarters[0]

  if (!activeQuarter) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F5F5F7' }}>Quarterly Plans</h1>
        <p style={{ color: '#6E6E73', marginTop: 8, fontSize: 14 }}>
          Start by creating a quarter, then add your goals.
        </p>
        <CreateQuarterForm />
      </div>
    )
  }

  const qProgress = getQuarterProgress(activeQuarter.startDate, activeQuarter.endDate)

  // Calculate metrics per goal
  const goalsWithMetrics = activeQuarter.goals.map(goal => {
    let progressPct = 0
    if (
      goal.trackingType === 'QUANTITATIVE' &&
      goal.startValue != null &&
      goal.targetValue != null &&
      goal.currentValue != null
    ) {
      progressPct = calcQuantitativeProgress(goal.startValue, goal.currentValue, goal.targetValue)
    } else if (goal.trackingType === 'MILESTONE') {
      progressPct = calcMilestoneProgress(goal.milestones)
    }
    const metrics = calcGoalMetrics({
      startDate: activeQuarter.startDate,
      deadline: goal.deadline,
      progressPct,
      progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
    })
    return { ...goal, progressPct, metrics }
  })

  // Health counts
  const onTrackCount = goalsWithMetrics.filter(g =>
    ['ahead', 'on_track', 'completed'].includes(g.metrics.status)
  ).length
  const watchCount = goalsWithMetrics.filter(g => g.metrics.status === 'watch').length
  const atRiskCount = goalsWithMetrics.filter(g => g.metrics.status === 'at_risk').length
  const criticalCount = goalsWithMetrics.filter(g => g.metrics.status === 'critical').length

  // Weighted completion
  const totalWeight = goalsWithMetrics.reduce((s, g) => s + g.priorityWeight, 0)
  const weightedCompletion =
    totalWeight > 0
      ? goalsWithMetrics.reduce((s, g) => s + g.progressPct * g.priorityWeight, 0) / totalWeight
      : 0
  const expectedPct = qProgress.pct
  const gap = weightedCompletion - expectedPct

  // Portfolio balance
  const coreCommitments = goalsWithMetrics.filter(
    g => !g.strategicRole || g.strategicRole === 'long_term'
  )
  const growthInvestments = goalsWithMetrics.filter(
    g => g.strategicRole === 'career_capital' || g.strategicRole === 'learning'
  )
  const highUpsideBets = goalsWithMetrics.filter(g => g.strategicRole === 'high_upside_bet')
  const maintenanceSystems = goalsWithMetrics.filter(
    g => g.strategicRole === 'fitness' || g.strategicRole === 'finance'
  )

  const portfolioBuckets = [
    { label: 'Core Commitments', goals: coreCommitments, color: '#F5F5F7' },
    { label: 'Growth Investments', goals: growthInvestments, color: '#C9B8FF' },
    { label: 'High-Upside Bets', goals: highUpsideBets, color: '#F7B98E' },
    { label: 'Maintenance Systems', goals: maintenanceSystems, color: '#9FE7C0' },
  ]

  const gapColor = gap >= 0 ? '#9FE7C0' : gap >= -10 ? '#F3D58A' : '#FFB4A8'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(180deg,#FFFFFF,#C7C4BC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {activeQuarter.name} — Strategic Control
          </h1>
          <p style={{ color: '#6E6E73', fontSize: 13, marginTop: 4 }}>
            {new Date(activeQuarter.startDate).toLocaleDateString('cs-CZ')} –{' '}
            {new Date(activeQuarter.endDate).toLocaleDateString('cs-CZ')}
            {' '}·{' '}{Math.round(qProgress.pct)}% elapsed{' '}·{' '}{qProgress.daysRemaining}d remaining
          </p>
        </div>
        {/* Manage button */}
        <GoalManager
          user={{ id: user.id, name: user.name, email: user.email }}
          quarter={{ id: activeQuarter.id, name: activeQuarter.name }}
          goals={activeQuarter.goals.map(g => ({
            id: g.id,
            title: g.title,
            category: g.category,
            trackingType: g.trackingType,
            strategicRole: g.strategicRole ?? null,
            startValue: g.startValue ?? null,
            targetValue: g.targetValue ?? null,
            currentValue: g.currentValue ?? null,
            unit: g.unit ?? null,
            deadline: g.deadline.toISOString(),
            priorityWeight: g.priorityWeight,
            status: g.status,
          }))}
        />

        {/* Quarter selector */}
        {quarters.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {quarters.slice(0, 4).map(q => (
              <span
                key={q.id}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: q.id === activeQuarter.id ? 'rgba(201,184,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${q.id === activeQuarter.id ? 'rgba(201,184,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: q.id === activeQuarter.id ? '#C9B8FF' : '#6E6E73',
                }}
              >
                {q.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quarter Health */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
          Quarter Health
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>Weighted Progress</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F5F5F7' }}>{Math.round(weightedCompletion)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>Expected</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#A1A1A6' }}>{Math.round(expectedPct)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>Gap</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: gapColor }}>
              {gap >= 0 ? '+' : ''}{Math.round(gap)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>Goals</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F5F5F7' }}>{goalsWithMetrics.length}</div>
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'On Track', count: onTrackCount, color: '#9FE7C0', bg: 'rgba(159,231,192,0.1)' },
            { label: 'Watch', count: watchCount, color: '#F3D58A', bg: 'rgba(243,213,138,0.1)' },
            { label: 'At Risk', count: atRiskCount, color: '#F7B98E', bg: 'rgba(255,159,107,0.1)' },
            { label: 'Critical', count: criticalCount, color: '#FFB4A8', bg: 'rgba(255,180,168,0.1)' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: s.bg,
                border: `1px solid ${s.color}30`,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16, position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, weightedCompletion)}%`, background: gap >= 0 ? '#9FE7C0' : gap >= -10 ? '#F3D58A' : '#FFB4A8', borderRadius: 3, transition: 'width 0.5s ease' }} />
          {/* Expected marker */}
          <div style={{ position: 'absolute', top: -3, left: `${Math.min(100, expectedPct)}%`, width: 2, height: 12, background: '#6E6E73', borderRadius: 1 }} />
        </div>
      </div>

      {/* Portfolio Balance */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
          Portfolio Balance
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {portfolioBuckets.map(bucket => (
            <div
              key={bucket.label}
              style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ fontSize: 11, color: bucket.color, fontWeight: 700, marginBottom: 8 }}>{bucket.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F5F7', marginBottom: 6 }}>{bucket.goals.length}</div>
              {bucket.goals.slice(0, 3).map(g => (
                <div key={g.id} style={{ fontSize: 11, color: '#6E6E73', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  · {g.title}
                </div>
              ))}
              {bucket.goals.length > 3 && (
                <div style={{ fontSize: 10, color: '#6E6E73' }}>+{bucket.goals.length - 3} more</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Goals Table */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
          Active Goals
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 80px 60px 80px 80px 90px', gap: 8, padding: '4px 8px', marginBottom: 4 }}>
          {['', 'Goal', 'Role', 'Progress', 'Gap', 'Expected', 'Deadline', 'Action'].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {goalsWithMetrics.map(goal => (
            <QuarterlyGoalRow
              key={goal.id}
              goal={{
                id: goal.id,
                title: goal.title,
                category: goal.category,
                strategicRole: goal.strategicRole,
                deadline: goal.deadline.toISOString(),
                progressPct: goal.progressPct,
                metrics: {
                  status: goal.metrics.status,
                  statusLabel: goal.metrics.statusLabel,
                  expectedPct: goal.metrics.expectedPct,
                  gap: goal.metrics.gap,
                },
              }}
            />
          ))}
        </div>
      </div>

      {/* Historical quarters (collapsed) */}
      {quarters.filter(q => q.id !== activeQuarter.id).length > 0 && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 12 }}>
            Past Quarters
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quarters
              .filter(q => q.id !== activeQuarter.id)
              .map(q => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#A1A1A6' }}>{q.name}</div>
                    <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>
                      {new Date(q.startDate).toLocaleDateString('cs-CZ')} –{' '}
                      {new Date(q.endDate).toLocaleDateString('cs-CZ')}
                      {' '}· {q.goals.length} goals
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(255,255,255,0.05)',
                      color: '#6E6E73',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    Closed
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
