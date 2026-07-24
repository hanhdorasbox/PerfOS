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
import { getOrCreateYearQuarters, currentYearAndQuarter, quarterDates } from '@/lib/quarters'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  active:  { label: 'Active',   color: '#64f0aa', dot: '#64f0aa' },
  planned: { label: 'Planned',  color: '#61adff', dot: '#61adff' },
  closed:  { label: 'Closed',   color: '#6E6E73', dot: '#6E6E73' },
}

const ROLE_META: Record<string, { color: string }> = {
  career_capital: { color: '#a085ff' },
  learning:       { color: '#61adff' },
  fitness:        { color: '#64f0aa' },
  finance:        { color: '#ffce53' },
  high_upside_bet:{ color: '#ffa360' },
  long_term:      { color: '#61adff' },
}

export default async function QuarterlyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string }>
}) {
  const sp   = await searchParams
  const now  = currentYearAndQuarter()
  const year = parseInt(sp.year ?? String(now.year))
  const qNum = parseInt(sp.q   ?? String(now.qNum))

  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168', padding: 40 }}>No user found.</div>

  // Ensure all 4 quarters exist for the selected year (upgrades legacy quarters)
  const yearQuarters = await getOrCreateYearQuarters(user.id, year)

  const selectedQ = yearQuarters.find(q => q.quarterNumber === qNum) ?? yearQuarters[1]

  // Adjacent years for the year selector
  const prevYear = year - 1
  const nextYear = year + 1

  // ── Metrics for selected quarter ────────────────────────────────────────────
  const isActive  = selectedQ.status === 'active'
  const isClosed  = selectedQ.status === 'closed'
  const isPlanned = selectedQ.status === 'planned'

  const qProgress = isActive ? getQuarterProgress(selectedQ.startDate, selectedQ.endDate) : null

  const goalsWithMetrics = selectedQ.goals.map(goal => {
    let progressPct = 0
    if (goal.trackingType === 'QUANTITATIVE' && goal.startValue != null && goal.targetValue != null && goal.currentValue != null) {
      progressPct = calcQuantitativeProgress(goal.startValue, goal.currentValue, goal.targetValue)
    } else if (goal.trackingType === 'MILESTONE') {
      progressPct = calcMilestoneProgress(goal.milestones)
    }
    const metrics = (isActive || isClosed)
      ? calcGoalMetrics({
          startDate: goal.createdAt,
          deadline: goal.deadline,
          progressPct,
          progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
        })
      : { status: 'planned' as const, statusLabel: 'Planned', expectedPct: 0, gap: 0, recommendation: '' }

    return { ...goal, progressPct, metrics }
  })

  const totalWeight        = goalsWithMetrics.reduce((s, g) => s + g.priorityWeight, 0)
  const weightedCompletion = totalWeight > 0 ? goalsWithMetrics.reduce((s, g) => s + g.progressPct * g.priorityWeight, 0) / totalWeight : 0
  const expectedPct        = qProgress?.pct ?? 0
  const gap                = weightedCompletion - expectedPct
  const gapColor           = gap >= 0 ? '#64f0aa' : gap >= -10 ? '#ffce53' : '#ff8168'

  const onTrackCount  = goalsWithMetrics.filter(g => ['ahead', 'on_track', 'completed'].includes(g.metrics.status)).length
  const watchCount    = goalsWithMetrics.filter(g => g.metrics.status === 'watch').length
  const atRiskCount   = goalsWithMetrics.filter(g => g.metrics.status === 'at_risk').length
  const criticalCount = goalsWithMetrics.filter(g => g.metrics.status === 'critical').length

  const portfolioBuckets = [
    { label: 'Core Commitments',   color: '#F5F5F7', goals: goalsWithMetrics.filter(g => !g.strategicRole || g.strategicRole === 'long_term') },
    { label: 'Growth Investments',  color: '#a085ff', goals: goalsWithMetrics.filter(g => g.strategicRole === 'career_capital' || g.strategicRole === 'learning') },
    { label: 'High-Upside Bets',    color: '#ffa360', goals: goalsWithMetrics.filter(g => g.strategicRole === 'high_upside_bet') },
    { label: 'Maintenance Systems', color: '#64f0aa', goals: goalsWithMetrics.filter(g => g.strategicRole === 'fitness' || g.strategicRole === 'finance') },
  ]

  // All quarters available to GoalManager for cross-quarter goal assignment
  const availableQuarters = yearQuarters.map(q => ({
    id: q.id, name: q.name, quarterNumber: q.quarterNumber, year: q.year, status: q.status,
    startDate: q.startDate.toISOString(),
  }))

  const smQ = STATUS_META[selectedQ.status] ?? STATUS_META.planned

  // Planned quarter activation date
  const activatesOn = isPlanned
    ? selectedQ.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Pre-quarter warning: activates in ≤7 days
  const daysUntilStart = isPlanned
    ? Math.ceil((selectedQ.startDate.getTime() - Date.now()) / 86_400_000)
    : null
  const showPreQuarterWarning = daysUntilStart !== null && daysUntilStart <= 7 && daysUntilStart >= 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Year + Quarter navigation ───────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Year row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={`/quarterly?year=${prevYear}&q=${qNum}`} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: '#6E6E73', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            textDecoration: 'none',
          }}>← {prevYear}</Link>

          <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', letterSpacing: '-0.02em' }}>{year}</span>

          <Link href={`/quarterly?year=${nextYear}&q=${qNum}`} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: '#6E6E73', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            textDecoration: 'none',
          }}>{nextYear} →</Link>
        </div>

        {/* Quarter tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {yearQuarters.map(q => {
            const sm  = STATUS_META[q.status] ?? STATUS_META.planned
            const sel = q.quarterNumber === selectedQ.quarterNumber
            return (
              <Link
                key={q.id}
                href={`/quarterly?year=${year}&q=${q.quarterNumber}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10, textDecoration: 'none',
                  fontSize: 13, fontWeight: 700,
                  background: sel ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${sel ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  color: sel ? '#F5F5F7' : '#6E6E73',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontWeight: 800 }}>Q{q.quarterNumber}</span>
                <span style={{
                  padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: sel ? `${sm.color}20` : 'rgba(255,255,255,0.06)',
                  color: sel ? sm.color : '#6E6E73',
                  border: `1px solid ${sel ? `${sm.color}40` : 'transparent'}`,
                }}>
                  {sm.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(180deg,#FFFFFF,#C7C4BC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            {selectedQ.name} — Strategic Control
          </h1>
          <p style={{ color: '#6E6E73', fontSize: 13, marginTop: 4 }}>
            {new Date(selectedQ.startDate).toLocaleDateString('cs-CZ')} –{' '}
            {new Date(selectedQ.endDate).toLocaleDateString('cs-CZ')}
            {isActive && qProgress && (
              <> · {Math.round(qProgress.pct)}% elapsed · {qProgress.daysRemaining}d remaining</>
            )}
          </p>
        </div>

        <GoalManager
          user={{ id: user.id, name: user.name, email: user.email }}
          quarter={{ id: selectedQ.id, name: selectedQ.name }}
          goals={selectedQ.goals.map(g => ({
            id: g.id, title: g.title, category: g.category,
            trackingType: g.trackingType, strategicRole: g.strategicRole ?? null,
            startValue: g.startValue ?? null, targetValue: g.targetValue ?? null,
            currentValue: g.currentValue ?? null, unit: g.unit ?? null,
            deadline: g.deadline.toISOString(), priorityWeight: g.priorityWeight,
            status: g.status,
          }))}
          availableQuarters={availableQuarters}
        />
      </div>

      {/* ── Status banner ──────────────────────────────────────────────────── */}
      {isPlanned && (
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(97, 173, 255,0.08)', border: '1px solid rgba(97, 173, 255,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#61adff', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#61adff' }}>Planning Mode</span>
            <span style={{ fontSize: 13, color: '#A1A1A6', marginLeft: 8 }}>
              Goals activate automatically on {activatesOn}.
              They will not appear in the current dashboard or weekly tasks until then.
            </span>
          </div>
        </div>
      )}

      {isClosed && (
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(110,110,115,0.08)', border: '1px solid rgba(110,110,115,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6E6E73', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#6E6E73' }}>
            Closed quarter — historical view. Goals here are archived and do not affect current execution.
          </span>
        </div>
      )}

      {showPreQuarterWarning && (
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(255, 206, 83,0.08)', border: '1px solid rgba(255, 206, 83,0.25)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffce53', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#ffce53', fontWeight: 600 }}>
            Q{selectedQ.quarterNumber} starts in {daysUntilStart} day{daysUntilStart === 1 ? '' : 's'}.
          </span>
          <span style={{ fontSize: 13, color: '#A1A1A6' }}>Review your planned goals before it activates.</span>
        </div>
      )}

      {/* ── Quarter Health (active + closed only) ──────────────────────────── */}
      {(isActive || isClosed) && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
            {isActive ? 'Quarter Health' : 'Final Results'}
          </div>
          <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Weighted Progress', value: `${Math.round(weightedCompletion)}%`, color: '#F5F5F7' },
              { label: 'Expected', value: `${Math.round(expectedPct)}%`, color: '#A1A1A6' },
              { label: 'Gap', value: `${gap >= 0 ? '+' : ''}${Math.round(gap)}%`, color: isActive ? gapColor : '#A1A1A6' },
              { label: 'Goals', value: String(goalsWithMetrics.length), color: '#F5F5F7' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {isActive && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: 'On Track', count: onTrackCount, color: '#64f0aa', bg: 'rgba(100, 240, 170,0.1)' },
                  { label: 'Watch',    count: watchCount,   color: '#ffce53', bg: 'rgba(255, 206, 83,0.1)' },
                  { label: 'At Risk',  count: atRiskCount,  color: '#ffa360', bg: 'rgba(255, 159, 107,0.1)' },
                  { label: 'Critical', count: criticalCount,color: '#ff8168', bg: 'rgba(255, 129, 104,0.1)' },
                ].map(s => (
                  <div key={s.label} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 999,
                    background: s.bg, border: `1px solid ${s.color}30`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
                  </div>
                ))}
              </div>

              <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, weightedCompletion)}%`, background: gapColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
                <div style={{ position: 'absolute', top: -3, left: `${Math.min(100, expectedPct)}%`, width: 2, height: 12, background: '#6E6E73', borderRadius: 1 }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Planning summary (planned quarters) ────────────────────────────── */}
      {isPlanned && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
            Planning Overview
          </div>
          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { label: 'Goals Planned', value: String(goalsWithMetrics.length), color: '#61adff' },
              { label: 'Activates', value: activatesOn ?? '—', color: '#F5F5F7', small: true },
              { label: 'Days Until Start', value: daysUntilStart != null ? `${daysUntilStart}d` : '—', color: '#A1A1A6' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: s.small ? 15 : 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Portfolio Balance ───────────────────────────────────────────────── */}
      {goalsWithMetrics.length > 0 && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 16 }}>
            Portfolio Balance
          </div>
          <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {portfolioBuckets.map(bucket => (
              <div key={bucket.label} style={{
                padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
              }}>
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
      )}

      {/* ── Goals table ────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
            {isPlanned ? 'Planned Goals' : isActive ? 'Active Goals' : 'Goals'}
          </div>
          {isPlanned && goalsWithMetrics.length === 0 && (
            <span style={{ fontSize: 12, color: '#6E6E73' }}>No goals yet — click "Manage Goals" to add some.</span>
          )}
        </div>

        {goalsWithMetrics.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 80px 60px 80px 80px 90px', gap: 8, padding: '4px 8px', marginBottom: 4, minWidth: 640 }}>
              {['', 'Goal', 'Role', 'Progress', 'Gap', 'Expected', 'Deadline', 'Action'].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {goalsWithMetrics.map(goal => (
                <QuarterlyGoalRow
                  key={goal.id}
                  goal={{
                    id: goal.id, title: goal.title, category: goal.category,
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
          </>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#6E6E73', fontSize: 13 }}>
            {isPlanned
              ? 'No goals planned yet. Use "Manage Goals" to start planning this quarter.'
              : 'No goals for this quarter.'}
          </div>
        )}
      </div>
    </div>
  )
}
