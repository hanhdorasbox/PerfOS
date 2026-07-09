import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'
import type Anthropic from '@anthropic-ai/sdk'

const client = createAnthropicClient()

// Recipe web-search + generation can take a while
export const maxDuration = 120

/** All text blocks joined — with server tools the answer may span multiple blocks. */
function extractText(content: Anthropic.ContentBlock[]): string {
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n')
}

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

  const systemPrompt = `You are a performance nutrition planner AND a serious recipe developer. You write meal plans whose dishes people genuinely enjoy eating — real cuisine with real flavor, adapted to macro targets. Return ONLY valid JSON. No markdown. Always use metric units (g, kg, ml, °C). Never use Fahrenheit — use Celsius for all temperatures (e.g. "roast at 200 °C", "internal temperature 75 °C").`

  const userMessage = `Generate a 7-day meal plan. Week starts Monday.

Fitness goals: ${fitnessGoalTitles}
Latest metrics: ${latestFitness ? `weight=${latestFitness.weight}kg, waist=${latestFitness.waist}cm` : 'not available'}

STEP 1 — RESEARCH (use the web_search tool):
Before writing the plan, search the web for highly-rated recipes for the main dishes you intend to plan (e.g. "best chicken thigh marinade recipe", "highly rated salmon teriyaki recipe"). Base your recipes on what real, well-reviewed recipes do — their marinades, spice ratios, techniques — then adapt them to the macro targets. Use at most 5 searches, prioritizing the batch-cooked mains that repeat across the week.

PLAN RULES:
- Breakfast ONLY on day 1 (Tue), day 3 (Thu), day 5 (Sat), day 6 (Sun) — NOT on Mon (0), Wed (2), Fri (4)
- ALL days get lunch AND dinner
- Minimize variety: batch 2-3 lunches, batch 2-3 dinners
- High protein focus
- Avoid: ${avoidFoods.join(', ') || 'none'}
- Include favorites if possible: ${favoriteFoods.join(', ') || 'none'}
- Previously liked: ${likedMeals.slice(0, 5).join(', ') || 'none'}
- Previously disliked: ${dislikedMeals.slice(0, 5).join(', ') || 'none'}
${constraints?.dayOfWeek != null ? `Only regenerate day ${constraints.dayOfWeek}, use reasonable meals for other days.` : ''}

FLAVOR RULES (non-negotiable):
- Every dish must have a real flavor identity — name the cuisine or profile it draws from (e.g. Thai, Mexican, Mediterranean, Korean, Middle Eastern).
- Seasoning with only salt and pepper is FORBIDDEN. Every main must use at least 3 of: marinade, spice blend, aromatics (garlic/ginger/onion/chili), acid (citrus/vinegar), fresh herbs, umami boosters (soy, fish sauce, miso, parmesan, tomato paste).
- Proteins get a marinade or rub with specified quantities and times. Vegetables get proper treatment (roasting at high heat, charring, dressing) — never just boiled.
- Include a finishing touch where it matters: fresh herbs, a squeeze of lime, toasted seeds, a quick sauce.
- Keep it weeknight-realistic: ≤10 ingredients per recipe, ≤40 min active time, common supermarket ingredients.

RECIPE RULES:
- Every meal that is cooked gets a full "recipe" object (see JSON shape below) with exact metric quantities scaled per portion and numbered, technique-specific steps ("sear 3 min per side over high heat", "rest 5 min", "reduce sauce until it coats a spoon").
- For batch-cooked meals, provide the full recipe ONLY on the first occurrence (scaled to the total portions) and set "recipe": null with "isRepeated": true on the repeats.
- Simple assemblies (yogurt bowl, sandwich) still get a short recipe with quantities — 2-4 steps is fine.

SHOPPING LIST RULES:
- Split shopping into 2 purchase days based on when meals are cooked and how perishable ingredients are
- Typically: Buy Sunday for Mon–Wed meals, buy Wednesday/Thursday for Thu–Sun meals
- Put proteins, vegetables and perishables for each half-week in the correct buy day
- Include ALL recipe ingredients (spices/sauces too, unless pantry staples)
- Batch-cooking ingredients always go in the earlier buy day

Return JSON:
{
  "meals": [
    {
      "dayOfWeek": 0,
      "mealType": "lunch",
      "title": "...",
      "description": "one appetizing sentence",
      "calories": 450,
      "protein": 35,
      "isRepeated": false,
      "notes": "...",
      "recipe": {
        "cuisine": "Korean",
        "flavorProfile": "sweet-savory gochujang glaze",
        "prepMinutes": 15,
        "cookMinutes": 20,
        "portions": 3,
        "ingredients": [
          {"name": "chicken thighs", "amount": 600, "unit": "g"},
          {"name": "gochujang", "amount": 45, "unit": "g"}
        ],
        "steps": [
          "Whisk gochujang, soy, honey and ginger into a marinade; coat chicken and rest 15 min.",
          "Sear chicken 4 min per side over medium-high heat until caramelized."
        ]
      }
    }
  ],
  "shoppingList": [
    {
      "buyDay": "Sunday",
      "reason": "for Mon–Wed meals / batch cooking",
      "items": [
        {"item": "chicken thighs", "quantity": "1.5", "unit": "kg"},
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
  "aiNotes": "Brief note about the plan, the cuisines chosen and why it fits the fitness goal.",
  "targetCalories": 1850,
  "targetProtein": ${proteinTarget}
}`

  async function generate(withSearch: boolean) {
    const baseParams = {
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemPrompt,
      ...(withSearch
        ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] }
        : {}),
    }
    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]
    let response = await client.messages.create({ ...baseParams, messages })

    // Server-side tool loop may pause; resume up to 3 times
    let continuations = 0
    while (response.stop_reason === 'pause_turn' && continuations < 3) {
      messages = [...messages, { role: 'assistant', content: response.content }]
      response = await client.messages.create({ ...baseParams, messages })
      continuations++
    }
    return response
  }

  let response: Anthropic.Message
  try {
    response = await generate(true)
  } catch {
    // Web search unavailable (org/tooling) — fall back to knowledge-based recipes
    response = await generate(false)
  }

  const text = extractText(response.content)
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
          recipe: m.recipe ? JSON.stringify(m.recipe) : null,
        }))
      }
    },
    include: {
      meals: { orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }] },
    },
  })

  return NextResponse.json(plan)
}
