import { prisma } from '@/lib/db'
import TrajectorySetup from '@/components/career/trajectory/TrajectorySetup'
import TrajectoryView from '@/components/career/trajectory/TrajectoryView'

export const dynamic = 'force-dynamic'

export default async function CareerTrajectoryPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B' }}>No user found</div>

  const [trajectory, activeQuarter] = await Promise.all([
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
