import { prisma } from '@/lib/db'
import TrajectorySetup from '@/components/career/trajectory/TrajectorySetup'
import TrajectoryView from '@/components/career/trajectory/TrajectoryView'

export const dynamic = 'force-dynamic'

export default async function CareerTrajectoryPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FFB4A8' }}>No user found</div>

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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7', marginBottom: 8 }}>Career Trajectory</h1>
        <div className="card" style={{ background: 'rgba(243,213,138,0.07)', border: '1px solid rgba(243,213,138,0.25)' }}>
          <p style={{ color: '#F3D58A', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            ⚠ Database migration in progress
          </p>
          <p style={{ color: '#6E6E73', fontSize: 13 }}>
            New schema columns are being applied. Please refresh the page in a few seconds.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Career Trajectory</h1>
        <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
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
