import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

interface WorkoutExercise {
  name: string
  sets: number
  reps: string
  notes?: string | null
  substitution?: string | null
  alternatives?: string[] | null
}

interface WorkoutDay {
  label: string
  theme: string
  exercises: WorkoutExercise[]
}

interface WorkoutPlan {
  progressionRule: string
  trackingNote: string
  days: WorkoutDay[]
}

function tryParse(s: string | null | undefined) {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

/**
 * POST /api/fitness/strategy/alternatives
 * Suggests 3 alternatives for one exercise and persists them into the
 * strategy's workoutPlan so the picker works offline next time.
 */
export async function POST(req: NextRequest) {
  try {
    const { strategyId, dayLabel, exerciseIndex } = await req.json() as {
      strategyId: string; dayLabel: string; exerciseIndex: number
    }
    if (!strategyId || !dayLabel || exerciseIndex == null) {
      return NextResponse.json({ error: 'strategyId, dayLabel and exerciseIndex required' }, { status: 400 })
    }

    const strategy = await prisma.fitnessStrategy.findUnique({ where: { id: strategyId } })
    if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })

    const workoutPlan = tryParse(strategy.workoutPlan) as WorkoutPlan | null
    const day = workoutPlan?.days?.find(d => d.label.toLowerCase() === dayLabel.toLowerCase())
    const exercise = day?.exercises?.[exerciseIndex]
    if (!workoutPlan || !day || !exercise) {
      return NextResponse.json({ error: 'Exercise not found in workout plan' }, { status: 404 })
    }

    const existing = [
      ...(exercise.alternatives ?? []),
      ...(exercise.substitution ? [exercise.substitution] : []),
    ]

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: 'You are a strength coach. Reply with JSON only — no prose.',
      messages: [{
        role: 'user',
        content: `Suggest exactly 3 alternative exercises for "${exercise.name}" (${exercise.sets} × ${exercise.reps}) on a "${day.theme}" day.
Rules:
- Same primary muscle group and similar training effect; vary equipment or angle.
- Real, common gym exercise names only.
- Exclude these (already offered): ${existing.length > 0 ? existing.join(', ') : 'none'}.
- User context: ${strategy.mainObjective ?? 'general strength & body recomposition'}.
Return: {"alternatives": ["...", "...", "..."]}`,
      }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 })
    const parsed = JSON.parse(jsonMatch[0]) as { alternatives?: string[] }
    const fresh = (parsed.alternatives ?? []).filter(a => typeof a === 'string' && a.trim()).slice(0, 3)
    if (fresh.length === 0) return NextResponse.json({ error: 'No alternatives generated' }, { status: 500 })

    // Persist: merge into the exercise's alternatives (dedupe, keep substitution folded in)
    const merged = [...new Set([...existing, ...fresh])]
    const updatedPlan: WorkoutPlan = {
      ...workoutPlan,
      days: workoutPlan.days.map(d =>
        d.label.toLowerCase() !== dayLabel.toLowerCase() ? d : {
          ...d,
          exercises: d.exercises.map((ex, i) =>
            i !== exerciseIndex ? ex : { ...ex, alternatives: merged, substitution: null }
          ),
        }
      ),
    }

    await prisma.fitnessStrategy.update({
      where: { id: strategyId },
      data: { workoutPlan: JSON.stringify(updatedPlan) },
    })

    return NextResponse.json({ ok: true, alternatives: merged, workoutPlan: updatedPlan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
