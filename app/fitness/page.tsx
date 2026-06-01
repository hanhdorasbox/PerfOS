import { prisma } from '@/lib/db'
import ActiveRegime from '@/components/fitness/ActiveRegime'
import FitnessInsights, { type PlannedCounts, type AlcoholLogEntry } from '@/components/fitness/FitnessInsights'

export const dynamic = 'force-dynamic'

// Monday ISO date of current week (server-side)
function getWeekId(): string {
  const now = new Date()
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().split('T')[0]
}

// Derive planned session counts from weeklyTargets JSON or parsed weeklySchedule
function parsePlanned(strategy: { weeklyTargets?: string | null; weeklySchedule?: string | null } | null): PlannedCounts {
  const zero = { strength: 0, cardio: 0, sauna: 0, walks: 0 }
  if (!strategy) return zero

  if (strategy.weeklyTargets) {
    try {
      const wt = JSON.parse(strategy.weeklyTargets) as Record<string, unknown>
      const strength = Number(wt.strength ?? wt.strengthSessions ?? 0)
      const cardio   = Number(wt.cardio   ?? wt.cardioSessions   ?? 0)
      const sauna    = Number(wt.sauna    ?? wt.saunaSessions    ?? 0)
      const walks    = Number(wt.walks    ?? wt.walkSessions     ?? wt.dailyWalks ?? 0)
      if (strength + cardio + sauna + walks > 0) return { strength, cardio, sauna, walks }
    } catch { /* fall through */ }
  }

  if (strategy.weeklySchedule) {
    try {
      const parsed = JSON.parse(strategy.weeklySchedule) as Record<string, unknown>[]
      if (!Array.isArray(parsed)) return zero
      const counts = { strength: 0, cardio: 0, sauna: 0, walks: 0 }
      for (const day of parsed) {
        const sessions: string[] = Array.isArray(day.sessions)
          ? (day.sessions as string[])
          : typeof day.activity === 'string'
          ? day.activity.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        for (const s of sessions) {
          const l = s.toLowerCase()
          if (/sauna/.test(l))                                  counts.sauna++
          else if (/cardio|run|cycle|swim|stairmaster/.test(l)) counts.cardio++
          else if (/walk|steps/.test(l))                        counts.walks++
          else if (!/rest|recovery|stretch|yoga/.test(l))       counts.strength++
        }
      }
      return counts
    } catch { /* fall through */ }
  }

  return zero
}

export default async function FitnessPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div>No user</div>

  const weekId = getWeekId()
  const weekStart = new Date(weekId + 'T00:00:00')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDayOfWeek = today.getDay() // 0=Sun, 6=Sat

  const [
    activeStrategy,
    draftStrategy,
    scheduleChangesWeek,
    alcoholLogsWeek,
    alcoholSettings,
    todayMealPlan,
  ] = await Promise.all([
    prisma.fitnessStrategy.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId: user.id, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    }),
    // This week's schedule changes (completed/skipped)
    prisma.fitnessScheduleChange.findMany({
      where: { userId: user.id, weekId, undone: false },
    }),
    // This week's alcohol logs
    prisma.alcoholLog.findMany({
      where: { userId: user.id, date: { gte: weekStart } },
      orderBy: { date: 'asc' },
    }),
    prisma.alcoholSettings.findFirst({ where: { userId: user.id } }),
    // Meal plan for today — protein derived from here
    prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        status: { in: ['approved', 'draft'] },
        weekStart: { lte: today },
      },
      include: {
        meals: {
          where: { dayOfWeek: todayDayOfWeek },
        },
      },
      orderBy: { weekStart: 'desc' },
    }),
  ])

  // Protein today: sum from meal plan meals (replaces manual protein log)
  const todayProteinFromMeals: number | null =
    todayMealPlan && todayMealPlan.meals.length > 0
      ? todayMealPlan.meals.reduce((s, m) => s + (m.protein ?? 0), 0)
      : null

  // Always use most recent strategy (draft overrides older active if newer)
  const mostRecentStrategy = (() => {
    if (activeStrategy && draftStrategy) {
      return draftStrategy.createdAt > activeStrategy.createdAt ? draftStrategy : activeStrategy
    }
    return activeStrategy ?? draftStrategy
  })()

  const isDraft = mostRecentStrategy?.status === 'draft'

  const serializedStrategy = mostRecentStrategy
    ? { ...mostRecentStrategy, createdAt: mostRecentStrategy.createdAt.toISOString() }
    : null

  // Protein target from strategy nutritionDir
  let proteinTarget = 150
  if (mostRecentStrategy?.nutritionDir) {
    try {
      const nutr = JSON.parse(mostRecentStrategy.nutritionDir) as { proteinTarget?: number; targetProtein?: number }
      const val = nutr.proteinTarget ?? nutr.targetProtein
      if (val && val > 0) proteinTarget = val
    } catch { /* use default */ }
  }

  // Plan vs Reality: planned from strategy, completed from schedule changes
  const planned = parsePlanned(mostRecentStrategy)
  const completed: PlannedCounts = { strength: 0, cardio: 0, sauna: 0, walks: 0 }
  for (const c of scheduleChangesWeek) {
    if (c.action === 'completed') {
      const t = c.sessionType === 'walk' ? 'walks' : c.sessionType as keyof PlannedCounts
      if (t in completed) completed[t]++
    }
  }

  const alcoholLogs: AlcoholLogEntry[] = alcoholLogsWeek.map(l => ({
    date: l.date.toISOString(),
    drinks: l.drinks,
    missedWorkout: l.missedWorkout,
    missedSteps: l.missedSteps,
    proteinHit: l.proteinHit ?? null,
    calorieOverage: l.calorieOverage ?? null,
  }))

  const alcoholBudget     = alcoholSettings?.weeklyBudget ?? 2
  const alcoholBudgetType = alcoholSettings?.budgetType ?? 'strict'

  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(180deg,#FFFFFF,#C7C4BC)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Fitness
      </h1>

      {/* 1. Active regime / weekly plan */}
      <ActiveRegime strategy={serializedStrategy} isDraft={isDraft} userId={user.id} />

      {/* 2. Insight cards (protein now derived from meal plan) */}
      <FitnessInsights
        planned={planned}
        completed={completed}
        todayProteinFromMeals={todayProteinFromMeals}
        proteinTarget={proteinTarget}
        alcoholLogs={alcoholLogs}
        alcoholBudget={alcoholBudget}
        alcoholBudgetType={alcoholBudgetType}
      />
    </div>
  )
}
