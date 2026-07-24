import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/quarters'
import WeeklyPlanner from '@/components/weekly/WeeklyPlanner'

export const dynamic = 'force-dynamic'

export default async function WeeklyPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168', padding: 40 }}>No user found.</div>

  const quarter = await prisma.quarter.findFirst({
    where: { userId: user.id, status: 'active' },
    include: {
      goals: {
        where: { status: 'active' },
        orderBy: { priorityWeight: 'desc' },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  if (!quarter) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: '#ffce53' }}>No active quarter. <a href="/quarterly" style={{ color: '#a085ff' }}>Create one →</a></p>
      </div>
    )
  }

  const { monday, sunday } = getWeekBounds()

  // Find or return null — creation is handled by the API on first task add
  const weeklyPlan = await prisma.weeklyPlan.findFirst({
    where: {
      quarterId: quarter.id,
      status: 'active',
      weekStart: { gte: monday, lte: sunday },
    },
    include: {
      tasks: {
        include: { goal: { select: { id: true, title: true, category: true } } },
        orderBy: [{ priority: 'asc' }, { completed: 'asc' }, { effort: 'desc' }],
      },
    },
  })

  // Build sourceUrl for learning tasks: step.id → capabilityGoalId → /learning/[id]
  const learningTaskIds = (weeklyPlan?.tasks ?? [])
    .filter(t => t.sourceModule === 'learning' && t.sourceId)
    .map(t => t.sourceId!)
  const stepGoalMap = new Map<string, string>()
  if (learningTaskIds.length > 0) {
    const steps = await prisma.learningStep.findMany({
      where: { id: { in: learningTaskIds } },
      include: { milestone: { select: { capabilityGoalId: true } } },
    })
    for (const s of steps) stepGoalMap.set(s.id, s.milestone.capabilityGoalId)
  }

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const weekLabel = `${fmt(monday)} – ${fmt(sunday)}`

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>This Week</h1>
        <p style={{ color: '#6E6E73', fontSize: 13, marginTop: 4 }}>{weekLabel} · {quarter.name}</p>
      </div>

      <WeeklyPlanner
        userId={user.id}
        weeklyPlanId={weeklyPlan?.id}
        tasks={weeklyPlan?.tasks.map(t => ({
          id: t.id,
          title: t.title,
          effort: t.effort,
          priority: t.priority,
          completed: t.completed,
          completedAt: t.completedAt?.toISOString() ?? null,
          taskType: t.taskType ?? null,
          goal: t.goal ?? null,
          sourceModule: t.sourceModule ?? null,
          sourceId: t.sourceId ?? null,
          sourceUrl: t.sourceModule === 'learning' && t.sourceId && stepGoalMap.has(t.sourceId)
            ? `/learning/${stepGoalMap.get(t.sourceId)}?tab=plan`
            : null,
        })) ?? []}
        goals={quarter.goals.map(g => ({ id: g.id, title: g.title, category: g.category }))}
      />
    </div>
  )
}
