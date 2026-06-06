import { prisma } from '@/lib/db'
import BudgetBoard from '@/components/budget/BudgetBoard'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ padding: 40, color: '#6E6E73' }}>No user found.</div>

  const items = await prisma.lifeMenuItem.findMany({
    where: { userId: user.id, type: 'buy' },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#F5F5F7', margin: 0 }}>Budget List</h1>
        <p style={{ color: '#6E6E73', fontSize: 14, marginTop: 6 }}>
          Things to buy — wishlist, approvals, and purchase tracking.
        </p>
      </div>
      <BudgetBoard
        items={items.map(i => ({
          ...i,
          estimatedCost: i.estimatedCost ?? undefined,
          actualCost: i.actualCost ?? undefined,
          timeNeededMinutes: i.timeNeededMinutes ?? undefined,
          curiosityScore: i.curiosityScore ?? undefined,
          joyScore: i.joyScore ?? undefined,
          utilityScore: i.utilityScore ?? undefined,
          goalSupportScore: i.goalSupportScore ?? undefined,
          regretRisk: i.regretRisk ?? undefined,
          comfortZoneLevel: i.comfortZoneLevel ?? undefined,
          repeatPotential: i.repeatPotential ?? undefined,
          recoveryValue: i.recoveryValue ?? undefined,
          careerValue: i.careerValue ?? undefined,
          ratingAfter: i.ratingAfter ?? undefined,
          plannedDate: i.plannedDate?.toISOString() ?? undefined,
          triedAt: i.triedAt?.toISOString() ?? undefined,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
        }))}
        userId={user.id}
      />
    </main>
  )
}
