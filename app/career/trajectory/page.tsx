import { prisma } from '@/lib/db'
import TrajectorySetup from '@/components/career/trajectory/TrajectorySetup'
import TrajectoryView from '@/components/career/trajectory/TrajectoryView'

export const dynamic = 'force-dynamic'

export default async function CareerTrajectoryPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B' }}>No user found</div>

  let trajectory = null
  let activeQuarter = null

  try {
    const [t, q] = await Promise.all([
      prisma.careerTrajectory.findFirst({
        where: { userId: user.id, status: 'active' },
        include: {
          gaps: { orderBy: { priority: 'asc' } },
          quarterlyPlans: {
            orderBy: { createdAt: 'desc' },
            take: 4,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quarter.findFirst({
        where: { userId: user.id, status: 'active' },
        orderBy: { startDate: 'desc' },
      }),
    ])
    trajectory = t
    activeQuarter = q
  } catch (e) {
    console.error('[CareerTrajectoryPage] DB query failed:', e)
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA', marginBottom: 8 }}>Career Trajectory</h1>
        <div className="card" style={{ background: 'rgba(242,192,99,0.07)', border: '1px solid rgba(242,192,99,0.25)' }}>
          <p style={{ color: '#F2C063', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            ⚠ Database migration in progress
          </p>
          <p style={{ color: '#76746E', fontSize: 13 }}>
            New schema columns are being applied. Please refresh the page in a few seconds.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Career Trajectory</h1>
        <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>
          Your path from where you are to where you want to be.
        </p>
      </div>

      {!trajectory ? (
        <TrajectorySetup userId={user.id} />
      ) : (
        <TrajectoryView
          trajectory={trajectory}
          quarterId={activeQuarter?.id ?? null}
          userId={user.id}
        />
      )}
    </div>
  )
}
