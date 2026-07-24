import { prisma } from '@/lib/db'
import MealPlanView from '@/components/meals/MealPlanView'
import FoodPreferencesEditor from '@/components/meals/FoodPreferencesEditor'
import MealPlanStarter from '@/components/meals/MealPlanStarter'
import PastMealPlans from '@/components/meals/PastMealPlans'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

export default async function MealsPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#ff8168', padding: 40 }}>No user found.</div>

  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const [currentPlan, foodPreferences, pastPlans] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        weekStart: { gte: weekStart, lte: weekEnd },
      },
      include: {
        meals: { orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }] },
        feedback: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.foodPreference.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }),
    prisma.mealPlan.findMany({
      where: { userId: user.id, status: 'approved' },
      orderBy: { weekStart: 'desc' },
      take: 10,
      include: { meals: { select: { id: true } } },
    }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializePlan = (plan: any) => ({
    ...plan,
    weekStart: plan.weekStart.toISOString(),
    createdAt: plan.createdAt.toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meals: plan.meals.map((m: any) => ({ ...m })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    feedback: plan.feedback?.map((f: any) => ({ ...f, createdAt: f.createdAt.toISOString() })) || [],
  })

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Weekly Meal Planning</h1>
            <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
              High-protein, minimal-variety meals aligned with your fitness goals.
            </p>
          </div>
          <a
            href="/meals/recipes"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(100, 240, 170,0.08)', border: '1px solid rgba(100, 240, 170,0.2)', borderRadius: 8, color: '#64f0aa', fontSize: 13, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}
          >
            <BookOpen size={13} /> Recipe Library
          </a>
        </div>
      </div>

      {!currentPlan ? (
        <MealPlanStarter userId={user.id} weekStart={weekStart.toISOString()} />
      ) : (
        <MealPlanView plan={serializePlan(currentPlan)} userId={user.id} />
      )}

      <div style={{ marginTop: 24 }}>
        <FoodPreferencesEditor preferences={foodPreferences} userId={user.id} />
      </div>

      <PastMealPlans
        plans={pastPlans.map(p => ({
          id: p.id,
          weekStart: p.weekStart.toISOString(),
          targetCalories: p.targetCalories ?? null,
          targetProtein: p.targetProtein ?? null,
          mealCount: p.meals.length,
        }))}
      />
    </main>
  )
}
