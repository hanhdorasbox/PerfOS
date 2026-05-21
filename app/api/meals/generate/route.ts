import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, weekStart: weekStartStr, constraints } = body

  const weekStart = weekStartStr ? new Date(weekStartStr) : (() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const s = new Date(now)
    s.setDate(now.getDate() + diff)
    s.setHours(0, 0, 0, 0)
    return s
  })()

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [foodPreferences, activeGoals, fitnessLogs, recentFeedback, activeStrategy] = await Promise.all([
    prisma.foodPreference.findMany({ where: { userId } }),
    prisma.quarter.findFirst({
      where: { userId, status: 'active' },
      include: {
        goals: {
          where: { category: 'fitness' },
          take: 3,
        }
      }
    }),
    prisma.fitnessLog.findMany({ where: { userId, date: { gte: ninetyDaysAgo } }, orderBy: { date: 'desc' }, take: 10 }),
    prisma.mealFeedback.findMany({
      where: {
        mealPlan: { userId },
        createdAt: { gte: ninetyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId, status: { in: ['active', 'draft'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
  ])

  // Read protein target from active strategy — check both field name variants the AI generates
  let proteinTarget = 150
  if (activeStrategy?.nutritionDir) {
    try {
      const nutr = JSON.parse(activeStrategy.nutritionDir) as { proteinTarget?: number; targetProtein?: number }
      const val = nutr.proteinTarget ?? nutr.targetProtein
      if (val && val > 0) proteinTarget = val
    } catch { /* use default */ }
  }

  const avoidFoods = foodPreferences
    .filter(p => p.type === 'dislike' || p.type === 'allergy')
    .map(p => p.food)
  const favoriteFoods = foodPreferences
    .filter(p => p.type === 'favorite')
    .map(p => p.food)

  const latestFitness = fitnessLogs[0]
  const fitnessGoalTitles = activeGoals?.goals.map(g => g.title).join(', ') || 'General fitness'

  const likedMeals = recentFeedback.filter(f => f.liked).map(f => f.mealTitle)
  const dislikedMeals = recentFeedback.filter(f => !f.liked).map(f => f.mealTitle)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: `You are a performance nutrition planner. Generate high-protein, minimal-variety meal plans. Return ONLY valid JSON. No markdown. Always use metric units (g, kg, ml, °C). Never use Fahrenheit — use Celsius for all temperatures (e.g. "pečte při 200 °C", "vnitřní teplota 75 °C").`,
    messages: [{
      role: 'user',
      content: `Generate a 7-day meal plan. Week starts Monday.

Fitness goals: ${fitnessGoalTitles}
Latest metrics: ${latestFitness ? `weight=${latestFitness.weight}kg, waist=${latestFitness.waist}cm` : 'not available'}

RULES:
- Breakfast ONLY on day 1 (Tue), day 3 (Thu), day 5 (Sat), day 6 (Sun) — NOT on Mon (0), Wed (2), Fri (4)
- ALL days get lunch AND dinner
- Minimize variety: batch 2-3 lunches, batch 2-3 dinners
- High protein focus
- Avoid: ${avoidFoods.join(', ') || 'none'}
- Include favorites if possible: ${favoriteFoods.join(', ') || 'none'}
- Previously liked: ${likedMeals.slice(0, 5).join(', ') || 'none'}
- Previously disliked: ${dislikedMeals.slice(0, 5).join(', ') || 'none'}
${constraints?.dayOfWeek != null ? `Only regenerate day ${constraints.dayOfWeek}, use reasonable meals for other days.` : ''}

SHOPPING LIST RULES:
- Split shopping into 2 purchase days based on when meals are cooked and how perishable ingredients are
- Typically: Buy Sunday for Mon–Wed meals, buy Wednesday/Thursday for Thu–Sun meals
- Put proteins, vegetables and perishables for each half-week in the correct buy day
- Batch-cooking ingredients always go in the earlier buy day

Return JSON:
{
  "meals": [
    {"dayOfWeek": 0, "mealType": "lunch", "title": "...", "description": "...", "calories": 450, "protein": 35, "isRepeated": false, "notes": "..."},
    ...
  ],
  "shoppingList": [
    {
      "buyDay": "Sunday",
      "reason": "for Mon–Wed meals / batch cooking",
      "items": [
        {"item": "chicken breast", "quantity": "1.5", "unit": "kg"},
        {"item": "rice", "quantity": "600", "unit": "g"}
      ]
    },
    {
      "buyDay": "Wednesday",
      "reason": "for Thu–Sun meals, fresher ingredients",
      "items": [
        {"item": "salmon fillet", "quantity": "900", "unit": "g"}
      ]
    }
  ],
  "batchCooking": [{"meal": "title", "portions": 3, "cookDay": "Sunday", "instructions": "..."}],
  "aiNotes": "Brief note about the plan and why it fits the fitness goal.",
  "targetCalories": 1850,
  "targetProtein": ${proteinTarget}
}`
    }]
  })

  const text = (response.content[0] as any).text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })
  const parsed = JSON.parse(match[0])

  // Delete existing draft plan for this week if any
  const existing = await prisma.mealPlan.findFirst({
    where: { userId, weekStart: { gte: weekStart, lt: new Date(weekStart.getTime() + 86400000) } },
  })
  if (existing && existing.status === 'draft') {
    await prisma.plannedMeal.deleteMany({ where: { mealPlanId: existing.id } })
    await prisma.mealPlan.delete({ where: { id: existing.id } })
  }

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      weekStart,
      status: 'draft',
      fitnessGoal: fitnessGoalTitles,
      targetCalories: parsed.targetCalories || null,
      targetProtein: parsed.targetProtein || null,
      shoppingList: JSON.stringify(parsed.shoppingList || []),
      batchCooking: JSON.stringify(parsed.batchCooking || []),
      aiNotes: parsed.aiNotes || null,
      meals: {
        create: (parsed.meals || []).map((m: any) => ({
          dayOfWeek: m.dayOfWeek,
          mealType: m.mealType,
          title: m.title,
          description: m.description || null,
          calories: m.calories || null,
          protein: m.protein || null,
          isRepeated: m.isRepeated || false,
          notes: m.notes || null,
        }))
      }
    },
    include: {
      meals: { orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }] },
    },
  })

  return NextResponse.json(plan)
}
