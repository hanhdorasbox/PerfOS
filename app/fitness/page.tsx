import { prisma } from '@/lib/db'
import FitnessCharts from '@/components/fitness/FitnessCharts'
import WorkoutTracker from '@/components/fitness/WorkoutTracker'
import ActiveRegime from '@/components/fitness/ActiveRegime'
import BodyMetricLogger from '@/components/fitness/BodyMetricLogger'

export const dynamic = 'force-dynamic'

export default async function FitnessPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div>No user</div>

  const [fitnessLogs, workoutLogs, activeStrategy, draftStrategy] = await Promise.all([
    prisma.fitnessLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 365,
    }),
    prisma.workoutLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId: user.id, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Get today's protein
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const proteinToday = await prisma.proteinLog.findMany({
    where: { userId: user.id, date: { gte: today } },
    orderBy: { date: 'asc' },
  })
  const totalProtein = proteinToday.reduce((s, p) => s + p.amount, 0)

  // Always use the MOST RECENTLY GENERATED strategy for both display and calculations.
  // A freshly generated draft overrides an older active strategy so its values propagate immediately.
  const mostRecentStrategy = (() => {
    if (activeStrategy && draftStrategy) {
      return draftStrategy.createdAt > activeStrategy.createdAt ? draftStrategy : activeStrategy
    }
    return activeStrategy ?? draftStrategy
  })()

  const displayStrategy = mostRecentStrategy
  const isDraft = mostRecentStrategy?.status === 'draft'

  // Serialize strategy for client component
  const serializedStrategy = displayStrategy
    ? {
        ...displayStrategy,
        createdAt: displayStrategy.createdAt.toISOString(),
      }
    : null

  // Extract protein target — handle both field name variants the AI generates
  let proteinTarget = 150
  if (displayStrategy?.nutritionDir) {
    try {
      const nutr = JSON.parse(displayStrategy.nutritionDir) as { proteinTarget?: number; targetProtein?: number }
      const val = nutr.proteinTarget ?? nutr.targetProtein
      if (val && val > 0) proteinTarget = val
    } catch { /* use default */ }
  }

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

      <ActiveRegime strategy={serializedStrategy} isDraft={isDraft} userId={user.id} />

      <BodyMetricLogger
        userId={user.id}
        userHeight={user.height ?? null}
        logs={fitnessLogs.map(l => ({
          id: l.id,
          date: l.date.toISOString(),
          weight: l.weight ?? null,
          waist: l.waist ?? null,
          hip: l.hip ?? null,
          notes: l.notes ?? null,
        }))}
      />

      <FitnessCharts fitnessLogs={[...fitnessLogs].reverse().map(l => ({ ...l, date: l.date.toISOString() }))} />
      <WorkoutTracker
        workoutLogs={workoutLogs.map(w => ({ ...w, date: w.date.toISOString() }))}
        proteinToday={totalProtein}
        proteinLogs={proteinToday.map(p => ({ id: p.id, amount: p.amount, date: p.date.toISOString() }))}
        proteinTarget={proteinTarget}
        userId={user.id}
      />
    </div>
  )
}
