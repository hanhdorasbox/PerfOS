import { prisma } from '@/lib/db'
import IdeaBoard from '@/components/ideas/IdeaBoard'
import AddIdeaForm from '@/components/ideas/AddIdeaForm'

export const dynamic = 'force-dynamic'

export default async function IdeasPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF9B87' }}>No user found</div>

  const ideas = await prisma.idea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Idea Pipeline</h1>
          <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
            Capture, evaluate, and convert ideas into action.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7', marginBottom: 14 }}>Add Idea</h3>
        <AddIdeaForm userId={user.id} />
      </div>

      <IdeaBoard ideas={ideas} userId={user.id} />
    </div>
  )
}
