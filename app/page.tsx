import { prisma } from '@/lib/db'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress, getQuarterProgress } from '@/lib/calculations'
import GoalCard from '@/components/dashboard/GoalCard'
import QuarterOverview from '@/components/dashboard/QuarterOverview'
import AlertBanner from '@/components/dashboard/AlertBanner'
import DailyCommandCenter from '@/components/dashboard/DailyCommandCenter'
import CollapsibleSection from '@/components/dashboard/CollapsibleSection'
import EmptyWeekBanner from '@/components/dashboard/EmptyWeekBanner'
import { ensureQuarterStatuses } from '@/lib/quarters'
import { rolloverIncompleteTasks } from '@/lib/execution-planner'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const user = await prisma.user.findFirst()
  if (!user) {
    return (
      <div style={{ color: '#FF9B87', padding: '40px' }}>
        No user found. Run: npx prisma db seed
      </div>
    )
  }

  // Auto-sync quarter statuses based on today's date
  await ensureQuarterStatuses(user.id)

  // Current week bounds — ensures we only load THIS week's plan (H1)
  const _now = new Date()
  const _dow = _now.getDay()
  const _mon = new Date(_now); _mon.setDate(_now.getDate() - (_dow === 0 ? 6 : _dow - 1)); _mon.setHours(0,0,0,0)
  const _sun = new Date(_mon); _sun.setDate(_mon.getDate() + 6); _sun.setHours(23,59,59,999)

  const quarter = await prisma.quarter.findFirst({
    where: { userId: user.id, status: 'active' },
    include: {
      goals: {
        include: {
          milestones: true,
          progressUpdates: { orderBy: { loggedAt: 'asc' } },
          weeklyTasks: { include: { goal: true } },
        },
      },
      weeklyPlans: {
        // H1: current week only — avoids stale tasks from previous unclosed plans
        where: { status: 'active', weekStart: { gte: _mon, lte: _sun } },
        include: { tasks: { include: { goal: true } } },
        orderBy: { weekStart: 'desc' },
        take: 1,
      },
    },
  })

  // Use most recently created strategy (draft or active) — a fresh draft overrides an older active
  const activeStrategy = await prisma.fitnessStrategy.findFirst({
    where: { userId: user.id, status: { in: ['active', 'draft'] } },
    orderBy: { createdAt: 'desc' },
  })

  // Meal plan: find the one whose week contains today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDayOfWeek = today.getDay()

  const todayMealPlan = await prisma.mealPlan.findFirst({
    where: {
      userId: user.id,
      status: { in: ['approved', 'draft'] },
      weekStart: { lte: today },
    },
    include: { meals: true },
    orderBy: { weekStart: 'desc' },
  })

  const todayMeals    = todayMealPlan?.meals.filter(m => m.dayOfWeek === todayDayOfWeek) ?? []
  // H6: tomorrow's meals (was always [] before)
  const tomorrowDayOfWeek = (todayDayOfWeek + 1) % 7
  const tomorrowMeals = todayMealPlan?.meals.filter(m => m.dayOfWeek === tomorrowDayOfWeek) ?? []

  // Daily briefing (cached for today)
  const todayStr = new Date().toISOString().split('T')[0]
  const briefing = await prisma.dailyBriefing.findUnique({
    where: { userId_date: { userId: user.id, date: todayStr } },
  })

  if (!quarter) {
    return (
      <div style={{ color: '#ECC666', padding: '40px' }}>
        No active quarter. Go to <a href="/quarterly" style={{ color: '#B8A4FF' }}>Quarterly</a> to create one.
      </div>
    )
  }

  // ── Calculate goal metrics ────────────────────────────────────────────────
  const goalsWithMetrics = quarter.goals.map(goal => {
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
    // C1: use goal.createdAt as start (not quarter start) — goals created mid-quarter
    // had wrong expected% and velocity when quarter.startDate was used.
    // C2: mark goals with no data so alert filtering can exclude them.
    const hasData = goal.trackingType === 'QUANTITATIVE'
      ? goal.currentValue != null
      : goal.milestones.length > 0
    const metrics = calcGoalMetrics({
      startDate: goal.createdAt,
      deadline: goal.deadline,
      progressPct,
      progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
    })
    return { ...goal, progressPct, hasData, metrics }
  })

  const qProgress = getQuarterProgress(quarter.startDate, quarter.endDate)
  const totalWeight = goalsWithMetrics.reduce((s, g) => s + g.priorityWeight, 0)
  const weightedCompletion = goalsWithMetrics.reduce((sum, g) => sum + g.progressPct * g.priorityWeight, 0) / Math.max(1, totalWeight)

  // C2: skip goals with no data (false critical for brand-new QUANTITATIVE goals)
  // C4: skip paused goals
  // M6: include 'watch' as an early-warning tier
  const alerts = goalsWithMetrics.filter(g =>
    g.hasData &&
    g.status !== 'paused' &&
    (g.metrics.status === 'critical' || g.metrics.status === 'at_risk' || g.metrics.status === 'watch')
  )

  // M10: health counts for QuarterOverview
  const atRiskCount  = goalsWithMetrics.filter(g => g.hasData && (g.metrics.status === 'at_risk' || g.metrics.status === 'critical')).length
  const watchCount   = goalsWithMetrics.filter(g => g.hasData && g.metrics.status === 'watch').length

  let currentWeekPlan = quarter.weeklyPlans[0]
  let weekTasks = currentWeekPlan?.tasks ?? []
  const weeklyPlanId = currentWeekPlan?.id

  // Auto-rollover: when a new week plan is empty, carry forward incomplete tasks from last week
  if (currentWeekPlan && weekTasks.length === 0) {
    const planAge = Date.now() - new Date((currentWeekPlan as any).createdAt ?? 0).getTime()
    const isNewPlan = planAge < 48 * 60 * 60 * 1000 // less than 2 days old

    if (isNewPlan) {
      const previousPlan = await prisma.weeklyPlan.findFirst({
        where: {
          quarterId: quarter.id,
          weekStart: { lt: _mon },
          id: { not: currentWeekPlan.id },
        },
        orderBy: { weekStart: 'desc' },
      })

      if (previousPlan) {
        await rolloverIncompleteTasks(previousPlan.id, currentWeekPlan.id)
        const refreshed = await prisma.weeklyPlan.findUnique({
          where: { id: currentWeekPlan.id },
          include: { tasks: { include: { goal: true } } },
        })
        weekTasks = refreshed?.tasks ?? []
      }
    }
  }

  // Calendar connection status
  const calendarToken = await prisma.googleCalendarToken.findUnique({ where: { userId: user.id } })
  const calendarConnected = !!calendarToken
  const calendarIcsConnected = !!user.calendarIcsSources

  // Serialize briefing for client component
  const serializedBriefing = briefing
    ? {
        ...briefing,
        generatedAt: briefing.generatedAt.toISOString(),
      }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── SECTION 1: Daily Command Center ── */}
      <div className="animate-entrance">
      <DailyCommandCenter
        briefing={serializedBriefing}
        goals={goalsWithMetrics}
        tasks={weekTasks}
        strategy={activeStrategy}
        todayMeals={todayMeals}
        tomorrowMeals={tomorrowMeals}
        userId={user.id}
        quarterName={quarter.name}
        weeklyPlanId={weeklyPlanId}
        calendarConnected={calendarConnected}
        calendarIcsConnected={calendarIcsConnected}
      />
      </div>

      {/* ── Empty week banner — auto-generate tasks from goals ── */}
      {weekTasks.length === 0 && (
        <EmptyWeekBanner userId={user.id} />
      )}

      {/* ── SECTION 2: Strategic Overview ── */}
      <div className="animate-entrance-delay-1" style={{ marginTop: 4 }}>
        <CollapsibleSection
          title="Strategic Overview"
          defaultCollapsed={false}
          badge={atRiskCount > 0 ? `${atRiskCount} at risk` : undefined}
        >
          {alerts.length > 0 && (
            <AlertBanner
              alerts={alerts.map(g => ({
                goalTitle: g.title,
                status: g.metrics.status,
                message: g.metrics.recommendation,
              }))}
            />
          )}

          <div style={{ marginTop: alerts.length > 0 ? 16 : 0 }}>
            <QuarterOverview
              quarter={quarter}
              qProgress={qProgress}
              weightedCompletion={weightedCompletion}
              goalCount={quarter.goals.length}
              atRiskCount={atRiskCount}
              watchCount={watchCount}
            />
          </div>

          {/* Active Goals — full width */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 500, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: '#6E6E73', marginBottom: 14,
            }}>
              Active Goals
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {goalsWithMetrics.map((goal, i) => (
                <div key={goal.id} className={`animate-entrance-delay-${Math.min(i + 2, 6)}`}>
                  <GoalCard goal={goal} metrics={goal.metrics} />
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
