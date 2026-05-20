import { prisma } from '@/lib/db'
import { calcGoalMetrics, calcQuantitativeProgress, calcMilestoneProgress, getQuarterProgress } from '@/lib/calculations'
import GoalCard from '@/components/dashboard/GoalCard'
import QuarterOverview from '@/components/dashboard/QuarterOverview'
import AlertBanner from '@/components/dashboard/AlertBanner'
import DailyCommandCenter from '@/components/dashboard/DailyCommandCenter'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const user = await prisma.user.findFirst()
  if (!user) {
    return (
      <div style={{ color: '#FF6B6B', padding: '40px' }}>
        No user found. Run: npx prisma db seed
      </div>
    )
  }

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
        where: { status: 'active' },
        include: { tasks: { include: { goal: true } } },
        orderBy: { weekStart: 'desc' },
        take: 1,
      },
    },
  })

  const fitnessLogs = await prisma.fitnessLog.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 3,
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

  const todayMeals = todayMealPlan?.meals.filter(m => m.dayOfWeek === todayDayOfWeek) ?? []

  // Daily briefing (cached for today)
  const todayStr = new Date().toISOString().split('T')[0]
  const briefing = await prisma.dailyBriefing.findUnique({
    where: { userId_date: { userId: user.id, date: todayStr } },
  })

  if (!quarter) {
    return (
      <div style={{ color: '#F2C063', padding: '40px' }}>
        No active quarter. Go to <a href="/quarterly" style={{ color: '#B4A7E5' }}>Quarterly</a> to create one.
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
    const metrics = calcGoalMetrics({
      startDate: quarter.startDate,
      deadline: goal.deadline,
      progressPct,
      progressHistory: goal.progressUpdates.map(u => ({ loggedAt: u.loggedAt, pct: u.value })),
    })
    return { ...goal, progressPct, metrics }
  })

  const qProgress = getQuarterProgress(quarter.startDate, quarter.endDate)
  const totalWeight = goalsWithMetrics.reduce((s, g) => s + g.priorityWeight, 0)
  const weightedCompletion = goalsWithMetrics.reduce((sum, g) => sum + g.progressPct * g.priorityWeight, 0) / Math.max(1, totalWeight)

  const alerts = goalsWithMetrics.filter(
    g => g.metrics.status === 'critical' || g.metrics.status === 'at_risk'
  )

  const currentWeekPlan = quarter.weeklyPlans[0]
  const weekTasks = currentWeekPlan?.tasks ?? []
  const weeklyPlanId = currentWeekPlan?.id

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
        tomorrowMeals={[]}
        fitnessLog={fitnessLogs[0] ?? null}
        userId={user.id}
        quarterName={quarter.name}
        weeklyPlanId={weeklyPlanId}
        calendarConnected={calendarConnected}
        calendarIcsConnected={calendarIcsConnected}
      />
      </div>

      {/* ── SECTION 2: Strategic Overview ── */}
      <div className="animate-entrance-delay-1" style={{ marginTop: 4 }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#76746E', marginBottom: 16,
        }}>
          — Strategic Overview
        </div>

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
          />
        </div>

        {/* Active Goals — full width */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#76746E', marginBottom: 12,
          }}>
            — Active Goals
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {goalsWithMetrics.map((goal, i) => (
              <div key={goal.id} className={`animate-entrance-delay-${Math.min(i + 2, 6)}`}>
                <GoalCard goal={goal} metrics={goal.metrics} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
