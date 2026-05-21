import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, quarterId, intakeData } = body

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Pull 90 days of historical data for context
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [fitnessLogs, workoutLogs, previousStrategy, fitnessGoals] = await Promise.all([
    prisma.fitnessLog.findMany({
      where: { userId, date: { gte: ninetyDaysAgo } },
      orderBy: { date: 'asc' },
      take: 30,
    }),
    prisma.workoutLog.findMany({
      where: { userId, date: { gte: ninetyDaysAgo } },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    prisma.fitnessStrategy.findFirst({
      where: { userId, status: { in: ['active', 'inactive'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goal.findMany({
      where: { userId, category: { in: ['fitness', 'health', 'body', 'strength'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const latestLog = fitnessLogs[fitnessLogs.length - 1]
  const oldestLog = fitnessLogs[0]
  const weightTrend = latestLog && oldestLog && latestLog.id !== oldestLog.id
    ? `${oldestLog.weight ?? '?'}kg → ${latestLog.weight ?? '?'}kg over ${fitnessLogs.length} measurements`
    : latestLog ? `Current: ${latestLog.weight ?? '?'}kg, waist: ${latestLog.waist ?? '?'}cm` : 'No body measurements in DB'

  const workoutFrequencyActual = workoutLogs.length > 0
    ? `${workoutLogs.length} sessions in last 90 days (avg ${(workoutLogs.length / 13).toFixed(1)}/week)`
    : 'No workout logs'

  const historicalContext = {
    bodyMetricTrend: weightTrend,
    workoutFrequency: workoutFrequencyActual,
    previousStrategyObjective: previousStrategy?.mainObjective ?? null,
    previousStrategyStatus: previousStrategy?.status ?? null,
    fitnessGoals: fitnessGoals.map(g => ({ title: g.title, status: g.status })),
  }

  const systemPrompt = `You are a professional strength and conditioning coach generating a quarterly fitness strategy with a concrete, gym-ready exercise plan.

IMPORTANT: Only recommend what is justified by the user's actual stated inputs and historical data.
- Do NOT invent sauna days unless the user mentioned sauna
- Do NOT specify exact calorie numbers unless the user asked for calorie tracking
- Do NOT recommend 4 sessions/week if the user said they prefer 3
- Every major recommendation must have a clear reason tied to the user's goal, history, or constraints
- If the user said "unsure" about nutrition, recommend a simple approach, not a complex one
- Always use metric units: kilograms, centimetres, kilometres. Use Celsius (°C) for temperatures — never Fahrenheit.
- WALKING: If the user walks on specific days (walkingDays), respect those days in the weekly schedule. If walkingRole is "tracked-cardio", include those walks as cardio sessions in the schedule. If "recovery", mark those days as "Walk (recovery)" in the schedule. If "step-target", reflect the walkTarget in cardioPlan.walkingTarget and don't block those days with heavy training. Preserve the user's walking rhythm.
- WORKOUT PLAN: The workoutPlan must contain a SPECIFIC exercise for every planned strength day — not just muscle group labels. Include exact exercise names, sets, rep ranges. Select exercises appropriate for the split, focus priority, and user limitations. Include at least 5–7 exercises per day. Use compound lifts as primary movements and isolation as finishers.

Return ONLY valid JSON, no markdown.`

  const prompt = `Generate a quarterly fitness strategy from this intake:

INTAKE DATA:
${JSON.stringify(intakeData, null, 2)}

HISTORICAL DATA FROM PERFOS:
${JSON.stringify(historicalContext, null, 2)}

Return JSON with this exact structure:
{
  "mainObjective": "specific 1-sentence objective grounded in the intake",
  "reasoning": "2-3 sentences explaining why this strategy is appropriate for this user",
  "strengthPlan": {
    "sessionsPerWeek": number,
    "split": "string",
    "emphasis": "string — keep under 40 chars",
    "sessionDuration": "e.g. 50–60 min",
    "focusPriority": "string — e.g. Lower body + glutes, Upper/Lower balanced",
    "notes": "string — specific rationale referencing user's stated preferences"
  },
  "cardioPlan": {
    "included": boolean,
    "sessionsPerWeek": number or null,
    "type": "string or null",
    "duration": "string or null",
    "walkingTarget": "string or null — e.g. 8000 steps/day if user mentioned walking",
    "notes": "string"
  },
  "saunaPlan": {
    "included": boolean,
    "sessionsPerWeek": number or null,
    "days": ["string"] or null,
    "duration": "string or null",
    "integration": "string or null"
  },
  "nutritionDir": {
    "approach": "string — deficit / maintenance / slight surplus / protein-focused / minimal",
    "proteinTarget": number or null,
    "caloricTracking": boolean,
    "mealPlanLinked": boolean,
    "keyRule": "string — the single most important nutrition rule for this quarter",
    "rationale": "string — why this approach fits the goal"
  },
  "weeklySchedule": [
    {"day": "Monday", "sessions": ["string"]},
    {"day": "Tuesday", "sessions": []},
    {"day": "Wednesday", "sessions": ["string"]},
    {"day": "Thursday", "sessions": []},
    {"day": "Friday", "sessions": ["string"]},
    {"day": "Saturday", "sessions": []},
    {"day": "Sunday", "sessions": []}
  ],
  "successMetrics": {
    "primary": "string — the ONE metric that defines success this quarter",
    "secondary": ["string", "string"],
    "maintenance": ["string"]
  },
  "weeklyTargets": {
    "strength": "string — e.g. 3 sessions completed",
    "cardio": "string or null",
    "sauna": "string or null",
    "protein": "string or null",
    "bodyMetricCadence": "string — e.g. Weigh and measure waist every Sunday"
  },
  "roadmap": [
    {
      "phase": "Phase 1",
      "weekRange": "Weeks 1–4",
      "title": "Establish & Baseline",
      "purpose": "string — 1 sentence",
      "focus": ["string", "string"],
      "execute": ["string", "string", "string"],
      "monitor": "string — what Project Hanh will track",
      "decisionPoint": "string — what you evaluate at end of phase"
    },
    {
      "phase": "Phase 2",
      "weekRange": "Weeks 5–8",
      "title": "Adjust & Progress",
      "purpose": "string",
      "focus": ["string", "string"],
      "execute": ["string", "string"],
      "monitor": "string",
      "decisionPoint": "string"
    },
    {
      "phase": "Phase 3",
      "weekRange": "Weeks 9–12",
      "title": "Consolidate & Finish",
      "purpose": "string",
      "focus": ["string", "string"],
      "execute": ["string", "string"],
      "monitor": "string",
      "decisionPoint": "string"
    }
  ],
  "immediateNextSteps": [
    "string — first concrete action",
    "string",
    "string"
  ],
  "trackingMetrics": ["string", "string", "string"],
  "risks": "string",
  "decisionRules": "string",
  "workoutPlan": {
    "progressionRule": "string — e.g. When you complete all reps in the top of the range with clean form across all sets, add 2.5 kg on compounds next session. Add 1.25 kg on isolation. If performance drops two sessions in a row, reduce load by 10% and rebuild.",
    "trackingNote": "string — what to log every session, e.g. Track weight, sets and reps for all compound lifts. Note energy and form quality.",
    "days": [
      {
        "label": "Lower Body A",
        "theme": "Squat & Posterior Chain",
        "exercises": [
          {
            "name": "Barbell squat",
            "sets": 4,
            "reps": "6–8",
            "notes": "Primary compound. Control descent, drive through heels.",
            "substitution": "Hack squat or leg press if barbell unavailable"
          },
          {
            "name": "Romanian deadlift",
            "sets": 3,
            "reps": "8–10",
            "notes": "Hip hinge focus. Keep bar close to legs.",
            "substitution": "Dumbbell RDL"
          },
          {
            "name": "Leg press",
            "sets": 3,
            "reps": "10–12",
            "notes": "Quad emphasis. Full range of motion.",
            "substitution": null
          },
          {
            "name": "Bulgarian split squat",
            "sets": 3,
            "reps": "8–10 per leg",
            "notes": "Unilateral balance and glute activation.",
            "substitution": "Reverse lunge"
          },
          {
            "name": "Seated leg curl",
            "sets": 3,
            "reps": "10–12",
            "notes": "Hamstring isolation.",
            "substitution": "Lying leg curl"
          },
          {
            "name": "Standing calf raise",
            "sets": 3,
            "reps": "12–15",
            "notes": "Full stretch at bottom.",
            "substitution": null
          }
        ]
      }
    ]
  }
}

IMPORTANT for workoutPlan:
- Generate one "days" entry for EACH planned strength training day in the weeklySchedule.
- The "label" must match what appears in the weeklySchedule sessions array for that day (e.g. "Lower Body A", "Upper Body A", "Full Body A").
- Select exercises specifically suited to the user's focus priorities, limitations, and split.
- If the user has lower body / glute focus, program accordingly (more hip hinge, glute isolation, unilateral work).
- Each day must have at least 5 exercises.
- Rep ranges must reflect the training goal: strength = 4–6 / 5–8, hypertrophy = 8–12, conditioning = 12–15.
- Do NOT use generic labels — use real exercise names: "Barbell back squat", "Cable lateral raise", "Lat pulldown", etc.`

  /** Safely coerce any value to a string or null. Objects/arrays are JSON-stringified. */
  function toStr(v: unknown): string | null {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return JSON.stringify(v)
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = (response.content[0] as { type: string; text: string }).text
    // Strip markdown code fences if present
    const text = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'No JSON in AI response' }, { status: 500 })
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, '\nRaw text:', rawText.slice(0, 500))
      return NextResponse.json({ error: `JSON parse failed: ${String(parseErr)}` }, { status: 500 })
    }

    // Create in DRAFT status — user must explicitly activate
    const strategy = await prisma.fitnessStrategy.create({
      data: {
        userId,
        quarterId: quarterId ? String(quarterId) : null,
        status: 'draft',
        mainObjective: toStr(parsed.mainObjective) || 'Quarterly fitness objective',
        strengthPlan: JSON.stringify(parsed.strengthPlan ?? null),
        cardioPlan: JSON.stringify(parsed.cardioPlan ?? null),
        saunaPlan: JSON.stringify(parsed.saunaPlan ?? null),
        nutritionDir: JSON.stringify(parsed.nutritionDir ?? null),
        weeklySchedule: JSON.stringify(parsed.weeklySchedule ?? null),
        trackingMetrics: JSON.stringify(parsed.trackingMetrics ?? null),
        risks: toStr(parsed.risks),
        decisionRules: toStr(parsed.decisionRules),
        roadmap: JSON.stringify(parsed.roadmap ?? null),
        weeklyTargets: JSON.stringify(parsed.weeklyTargets ?? null),
        immediateNextSteps: JSON.stringify(parsed.immediateNextSteps ?? null),
        workoutPlan: JSON.stringify(parsed.workoutPlan ?? null),
        intakeData: JSON.stringify(intakeData ?? null),
      },
    })

    return NextResponse.json(strategy)
  } catch (e) {
    console.error('[strategy/generate] Error:', e)
    const userMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
