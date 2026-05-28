import { prisma } from '@/lib/db'
import AlcoholTracker from '@/components/habits/AlcoholTracker'

export const dynamic = 'force-dynamic'

export default async function HabitsPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div>No user found</div>

  const since = new Date()
  since.setDate(since.getDate() - 56) // 8 weeks

  const [logs, settings] = await Promise.all([
    prisma.alcoholLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.alcoholSettings.findUnique({ where: { userId: user.id } }),
  ])

  return (
    <main className="animate-entrance" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Habit Breaker</h1>
        <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
          Track what actually costs you — sleep, workouts, recovery, and momentum.
        </p>
      </div>

      <AlcoholTracker
        userId={user.id}
        initialLogs={logs.map(l => ({
          ...l,
          date: l.date.toISOString(),
          createdAt: l.createdAt.toISOString(),
        }))}
        initialSettings={settings
          ? {
              ...settings,
              createdAt: settings.createdAt.toISOString(),
              updatedAt: settings.updatedAt.toISOString(),
            }
          : null}
      />
    </main>
  )
}
