import { prisma } from '@/lib/db'
import CapabilityGoalCard from '@/components/learning/CapabilityGoalCard'
import AddCapabilityGoalForm from '@/components/learning/AddCapabilityGoalForm'
import { Brain } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LearningPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168' }}>No user found</div>

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
        <div className="mob-2col" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
        }}>
          {[
            { label: 'Active Roadmaps', value: activeGoalsList.length, color: '#a085ff' },
            { label: 'Steps Complete', value: `${completedStepsAcrossAll.length}/${totalStepsAcrossAll.length}`, color: '#64f0aa' },
            { label: 'Overall Progress', value: `${overallPct}%`, color: '#61adff' },
            { label: 'At Risk', value: atRisk, color: atRisk > 0 ? '#ffce53' : '#6E6E73' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 20, fontWeight: 700, marginTop: 4 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Roadmap progress — steps-complete bar per active roadmap, coloured by health */}
      {activeGoalsList.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6E6E73', marginBottom: 16 }}>
            Roadmap progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeGoalsList.map(g => {
              const steps = g.milestones.flatMap(m => m.steps)
              const done = steps.filter(s => s.completed).length
              const pct = steps.length > 0 ? (done / steps.length) * 100 : 0
              const color = g.healthStatus === 'on_track'
                ? '#64f0aa'
                : ['at_risk', 'behind', 'stalled'].includes(g.healthStatus || '')
                  ? '#ffce53'
                  : '#61adff'
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#EEEEF2', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                    <span style={{ fontSize: 11, color: '#52525A', whiteSpace: 'nowrap' }}>{done}/{steps.length} steps</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#EEEEF2', fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
                  </div>
                </div>
              )
            })}
          </div>
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
              <span style={{ color: '#64f0aa', fontSize: 11, fontWeight: 600, marginLeft: 8 }}>· {onTrack} on track</span>
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
          <div style={{ marginBottom: 12, color: '#6E6E73', display: 'flex', justifyContent: 'center' }}><Brain size={40} /></div>
          <p style={{ color: '#A1A1A6', fontSize: 15, marginBottom: 6 }}>No active roadmaps yet.</p>
          <p style={{ color: '#6E6E73', fontSize: 13 }}>Create your first learning roadmap above.</p>
        </div>
      )}

      {/* Completed */}
      {completedGoalsList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64f0aa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
