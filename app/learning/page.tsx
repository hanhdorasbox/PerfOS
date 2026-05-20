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
      include: { milestones: { orderBy: { id: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const activeCapabilityGoals = capabilityGoals.filter(g => g.status === 'active')
  const completedCapabilityGoals = capabilityGoals.filter(g => g.status === 'completed')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Learning</h1>
          <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>
            Capability acquisition, not content consumption.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FAFAFA', marginBottom: 16 }}>Add Capability Goal</h3>
        <AddCapabilityGoalForm userId={user.id} goals={activeGoals} />
      </div>

      {activeCapabilityGoals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FAFAFA', marginBottom: 14 }}>
            Active Capability Goals
            <span style={{ color: '#76746E', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{activeCapabilityGoals.length}</span>
          </h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {activeCapabilityGoals.map(goal => (
              <CapabilityGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {activeCapabilityGoals.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
          <p style={{ color: '#B8B6B0', fontSize: 15 }}>No capability goals yet. Add your first one above.</p>
        </div>
      )}

      {completedCapabilityGoals.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#76746E', marginBottom: 14 }}>
            Completed
            <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{completedCapabilityGoals.length}</span>
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {completedCapabilityGoals.map(goal => (
              <CapabilityGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
