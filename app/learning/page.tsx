import { prisma } from '@/lib/db'
import CapabilityGoalCard from '@/components/learning/CapabilityGoalCard'
import AddCapabilityGoalForm from '@/components/learning/AddCapabilityGoalForm'

export const dynamic = 'force-dynamic'

export default async function LearningPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B' }}>No user found</div>

  const [capabilityGoals, activeGoals] = await Promise.all([
    prisma.capabilityGoal.findMany({
      where: { userId: user.id },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Learning</h1>
          <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>
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
            { label: 'Active Roadmaps', value: activeGoalsList.length, color: '#B4A7E5' },
            { label: 'Steps Complete', value: `${completedStepsAcrossAll.length}/${totalStepsAcrossAll.length}`, color: '#6BE3A4' },
            { label: 'Overall Progress', value: `${overallPct}%`, color: '#60A5FA' },
            { label: 'At Risk', value: atRisk, color: atRisk > 0 ? '#F2C063' : '#76746E' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#76746E', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Roadmaps
            <span style={{ color: '#76746E', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{activeGoalsList.length}</span>
            {onTrack > 0 && (
              <span style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 600, marginLeft: 8 }}>· {onTrack} on track</span>
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
          <p style={{ color: '#B8B6B0', fontSize: 15, marginBottom: 6 }}>No active roadmaps yet.</p>
          <p style={{ color: '#76746E', fontSize: 13 }}>Create your first learning roadmap above.</p>
        </div>
      )}

      {/* Completed */}
      {completedGoalsList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6BE3A4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Completed
            <span style={{ color: '#76746E', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>{completedGoalsList.length}</span>
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
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#76746E', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
