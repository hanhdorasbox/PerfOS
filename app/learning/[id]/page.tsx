import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RoadmapDetailView from '@/components/learning/RoadmapDetailView'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoadmapDetailPage({ params }: Props) {
  const { id } = await params
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168' }}>No user found</div>

  const goal = await prisma.capabilityGoal.findUnique({
    where: { id },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: { steps: { orderBy: { order: 'asc' } } },
      },
      linkedGoal: { select: { id: true, title: true } },
    },
  })

  if (!goal || goal.userId !== user.id) notFound()

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/learning"
          style={{ color: '#6E6E73', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Learning
        </Link>
      </div>
      <RoadmapDetailView goal={goal} />
    </div>
  )
}
