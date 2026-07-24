import { prisma } from '@/lib/db'
import FitnessStrategyView from '@/components/fitness/FitnessStrategyView'
import FitnessStrategyGenerator from '@/components/fitness/FitnessStrategyGenerator'
import StrategyHistory from '@/components/fitness/StrategyHistory'

export const dynamic = 'force-dynamic'

interface SerializedStrategy {
  id: string
  userId: string
  quarterId: string | null
  mainObjective: string
  objectiveShort: string | null
  strengthPlan: string | null
  cardioPlan: string | null
  saunaPlan: string | null
  nutritionDir: string | null
  weeklySchedule: string | null
  trackingMetrics: string | null
  risks: string | null
  decisionRules: string | null
  roadmap: string | null
  weeklyTargets: string | null
  immediateNextSteps: string | null
  intakeData: string | null
  workoutPlan: string | null
  status: string
  createdAt: string
}

export default async function FitnessStrategyPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168', padding: 40 }}>No user found.</div>

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const quarter = await prisma.quarter.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { startDate: 'desc' },
  })

  const [latestStrategy, allStrategies, fitnessLogs, workoutLogs] = await Promise.all([
    // Query for the latest strategy regardless of status (including drafts)
    prisma.fitnessStrategy.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fitnessStrategy.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.fitnessLog.findMany({
      where: { userId: user.id, date: { gte: ninetyDaysAgo } },
      orderBy: { date: 'desc' },
      take: 1,
    }),
    prisma.workoutLog.findMany({
      where: { userId: user.id, date: { gte: ninetyDaysAgo } },
      orderBy: { date: 'desc' },
    }),
  ])

  const serializeStrategy = (s: {
    id: string
    userId: string
    quarterId: string | null
    mainObjective: string
    objectiveShort: string | null
    strengthPlan: string | null
    cardioPlan: string | null
    saunaPlan: string | null
    nutritionDir: string | null
    weeklySchedule: string | null
    trackingMetrics: string | null
    risks: string | null
    decisionRules: string | null
    roadmap: string | null
    weeklyTargets: string | null
    immediateNextSteps: string | null
    intakeData: string | null
    workoutPlan: string | null
    status: string
    createdAt: Date
  }): SerializedStrategy => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  })

  // Prefill data from latest fitness log
  const latestLog = fitnessLogs[0] ?? null
  const prefillWaist = latestLog?.waist ?? null
  // Estimate training frequency from last 90 days (avg per week over 13 weeks)
  const prefillTrainingFreq = workoutLogs.length > 0
    ? Math.round(workoutLogs.length / 13)
    : null

  // Determine display logic:
  // 1. If there's a draft strategy → show it for activation/review, don't show generator
  // 2. If there's an active strategy → show it, offer "Start New Strategy Review" button
  // 3. If nothing → show the generator
  const draftStrategy = allStrategies.find(s => s.status === 'draft') ?? null
  const activeStrategy = allStrategies.find(s => s.status === 'active') ?? null

  const pastStrategies = allStrategies.filter(s => {
    if (draftStrategy && s.id === draftStrategy.id) return false
    if (activeStrategy && s.id === activeStrategy.id) return false
    return true
  })

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#EEEEF2', letterSpacing: '-0.02em', lineHeight: 1.3 }}>Fitness Strategy</h1>
        <p style={{ color: '#52525A', fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
          Structured quarterly plan aligned with your body composition goals.
        </p>
      </div>

      {draftStrategy ? (
        // Show draft for review/activation — don't show generator
        <div>
          <FitnessStrategyView strategy={serializeStrategy(draftStrategy)} />
        </div>
      ) : activeStrategy ? (
        // Show active strategy, offer new review
        <div>
          <FitnessStrategyView strategy={serializeStrategy(activeStrategy)} />
          <div style={{ marginTop: 20 }}>
            <FitnessStrategyGenerator
              userId={user.id}
              quarterId={quarter?.id}
              label="Start New Strategy Review"
              prefillWaist={prefillWaist}
              prefillTrainingFreq={prefillTrainingFreq}
            />
          </div>
        </div>
      ) : (
        // No strategy at all — show generator
        <div>
          <FitnessStrategyGenerator
            userId={user.id}
            quarterId={quarter?.id}
            prefillWaist={prefillWaist}
            prefillTrainingFreq={prefillTrainingFreq}
          />
        </div>
      )}

      <StrategyHistory strategies={pastStrategies.map(s => ({ ...s, createdAt: s.createdAt.toISOString() }))} />
    </main>
  )
}
