import { prisma } from '@/lib/db'
import CapabilityGoalCard from '@/components/learning/CapabilityGoalCard'
import AddCapabilityGoalForm from '@/components/learning/AddCapabilityGoalForm'

export const dynamic = 'force-dynamic'

export default async function LearningPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF9B87' }}>No user found</div>

  const [capabilityGoalsRaw, activeGoals] = await Promise.all([
    // Try full query with new schema (steps + new columns)
    prisma.capabilityGoal.findMany({
      where: { userId: user.id },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }).catch(async () => {
      // Fallback: DB schema migration hasn't run yet — query without new relations
      const legacy = await prisma.capabilityGoal.findMany({
        where: { userId: user.id },
        include: { milestones: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }).catch(() => [])
      // Normalise to new shape expected by components
      return legacy.map(g => ({
        ...g,
        roadmapType: null as string | null,
        deadline: null as Date | null,
        weeklyHours: null as number | null,
        detailLevel: 'standard',
        healthStatus: 'not_started',
        nextBestAction: null as string | null,
        archivedAt: null as Date | null,
        updatedAt: g.createdAt,
        milestones: g.milestones.map(m => ({
          ...m,
          phaseName: null as string | null,
          order: 0,
          description: null as string | null,
          estimatedHours: null as number | null,
          steps: [] as import('@prisma/client').LearningStep[],
        })),
      }))
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const capabilityGoals = capabilityGoalsRaw

  const activeGoalsList = capabilityGoals.filter(g => g.status === 'active')
  const completedGoalsList = capabilityGoals.filter(g => g.status === 'completed')
  const archivedGoalsList = capabilityGoals.filter(g => g.status === 'archived')

  // Compute aggregate stats
  const totalStepsAcrossAll = activeGoalsList.flatMap(g => g.milestones.flatMap(m => m.steps))
  const completedStepsAcrossAll = totalStepsAcrossAll.filter(s => s.completed)
  const overallPct = totalStepsAcrossAll.length > 0
    ? Math.round((completedStepsAcrossAll.length / totalStepsAcrossAll.length) * 100)
    : 0

  const onTrack = activeGoalsList.filter(g => g.healthStatus === 'on_track').length
  const atRisk = activeGoalsList.filter(g => ['at_risk', 'behind', 'stalled'].includes(g.healthStatus || '')).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Learning</h1>
          <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
            Capability acquisition, not content consumption.
          </p>
        </div>
      </div>

      {/* Stats bar — only show if there are active goals */}
      {activeGoalsList.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
        }}>
          {[
            { label: 'Active Roadmaps', value: activeGoalsList.length, color: '#B8A4FF' },
            { label: 'Steps Complete', value: `${completedStepsAcrossAll.length}/${totalStepsAcrossAll.length}`, color: '#7FD5AA' },
            { label: 'Overall Progress', value: `${overallPct}%`, color: '#80BDFF' },
            { label: 'At Risk', value: atRisk, color: atRisk > 0 ? '#ECC666' : '#6E6E73' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 20, fontWeight: 700, marginTop: 4 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create new roadmap */}
      <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
        <AddCapabilityGoalForm userId={user.id} goals={activeGoals} />
      </div>

      {/* Active */}
      {activeGoalsList.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Roadmaps
            <span style={{ color: '#6E6E73', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{activeGoalsList.length}</span>
            {onTrack > 0 && (
              <span style={{ color: '#7FD5AA', fontSize: 11, fontWeight: 600, marginLeft: 8 }}>· {onTrack} on track</span>
            )}
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {activeGoalsList.map(goal => (
              <CapabilityGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {activeGoalsList.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
          <p style={{ color: '#A1A1A6', fontSize: 15, marginBottom: 6 }}>No active roadmaps yet.</p>
          <p style={{ color: '#6E6E73', fontSize: 13 }}>Create your first learning roadmap above.</p>
        </div>
      )}

      {/* Completed */}
      {completedGoalsList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#7FD5AA', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Completed
            <span style={{ color: '#6E6E73', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{completedGoalsList.length}</span>
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {completedGoalsList.map(goal => (
              <CapabilityGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {/* Archived */}
      {archivedGoalsList.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6E6E73', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Archived
            <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{archivedGoalsList.length}</span>
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {archivedGoalsList.map(goal => (
              <CapabilityGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
