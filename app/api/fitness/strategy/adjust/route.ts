import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

function tryParse(s: string | null | undefined) {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { strategyId, mode, frequencyConfig } = body as {
      strategyId: string
      mode: 'realistic' | 'ambitious' | 'frequency'
      frequencyConfig?: {
        strength?: number
        cardio?: number
        sauna?: number
        walkTarget?: string
        preferredDays?: string[]
        sessionDuration?: string
      }
    }

    if (!strategyId || !mode) {
      return NextResponse.json({ error: 'strategyId and mode required' }, { status: 400 })
    }

    const strategy = await prisma.fitnessStrategy.findUnique({ where: { id: strategyId } })
    if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })

    const sp   = tryParse(strategy.strengthPlan)
    const cp   = tryParse(strategy.cardioPlan)
    const sauna = tryParse(strategy.saunaPlan)
    const nutr = tryParse(strategy.nutritionDir)
    const schedule = tryParse(strategy.weeklySchedule)
    const weeklyTargets = tryParse(strategy.weeklyTargets)
    const workoutPlan = tryParse(strategy.workoutPlan)

    let adjustmentInstruction = ''

    if (mode === 'realistic') {
      adjustmentInstruction = `Make this strategy LESS intensive and MORE realistic:
- Reduce strength sessions by 1 if currently 4+, or reduce session duration by 10-15 min
- Reduce cardio frequency by 1 if currently 3+, or shorten cardio sessions
- Simplify the workout split if complex
- Remove optional accessory work if volume is high
- Reduce weekly movement targets slightly if ambitious
- Keep the main goal intact — just make execution easier and more sustainable
- Do NOT add new components`
    } else if (mode === 'ambitious') {
      adjustmentInstruction = `Make this strategy MORE ambitious and challenging:
- Add 1 extra strength session per week if recovery allows (max 5)
- Add 1 extra cardio session if currently ≤2
- Increase rep progression targets slightly
- Add 1-2 optional accessory exercises to existing workouts
- Increase walking target by 1000 steps if applicable
- Keep it realistic — challenging but not extreme
- Do NOT remove existing sessions`
    } else if (mode === 'frequency' && frequencyConfig) {
      adjustmentInstruction = `Adjust the strategy frequency based on these user preferences:
- Strength sessions per week: ${frequencyConfig.strength ?? 'unchanged'}
- Cardio sessions per week: ${frequencyConfig.cardio ?? 'unchanged'}
- Sauna/recovery sessions per week: ${frequencyConfig.sauna ?? 'unchanged'}
- Walking target: ${frequencyConfig.walkTarget || 'unchanged'}
- Preferred workout days: ${frequencyConfig.preferredDays?.join(', ') || 'unchanged'}
- Session duration: ${frequencyConfig.sessionDuration || 'unchanged'}

Recalculate and update the weekly schedule, workout plan, training targets, and all related fields to match.`
    }

    const systemPrompt = `You are a professional strength and conditioning coach adjusting an existing quarterly fitness strategy.

Return ONLY valid JSON with the exact same structure as the original strategy. Do not add new fields. Do not omit any fields.
Keep all unchanged fields identical to their original values. Only modify what the adjustment instruction requires.
Always use metric units.`

    const userMessage = `Here is the current strategy:
${JSON.stringify({
  mainObjective: strategy.mainObjective,
  strengthPlan: sp,
  cardioPlan: cp,
  saunaPlan: sauna,
  nutritionDir: nutr,
  weeklySchedule: schedule,
  weeklyTargets,
  workoutPlan,
  immediateNextSteps: tryParse(strategy.immediateNextSteps),
  trackingMetrics: tryParse(strategy.trackingMetrics),
  risks: strategy.risks,
  decisionRules: strategy.decisionRules,
  roadmap: tryParse(strategy.roadmap),
}, null, 2)}

ADJUSTMENT REQUIRED:
${adjustmentInstruction}

Return the complete adjusted strategy as JSON with these exact fields:
mainObjective, strengthPlan, cardioPlan, saunaPlan, nutritionDir, weeklySchedule, weeklyTargets, workoutPlan, immediateNextSteps, trackingMetrics, risks, decisionRules, roadmap`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])

    const updated = await prisma.fitnessStrategy.update({
      where: { id: strategyId },
      data: {
        mainObjective:     parsed.mainObjective ?? strategy.mainObjective,
        strengthPlan:      parsed.strengthPlan      ? JSON.stringify(parsed.strengthPlan)      : strategy.strengthPlan,
        cardioPlan:        parsed.cardioPlan        ? JSON.stringify(parsed.cardioPlan)        : strategy.cardioPlan,
        saunaPlan:         parsed.saunaPlan         ? JSON.stringify(parsed.saunaPlan)         : strategy.saunaPlan,
        nutritionDir:      parsed.nutritionDir      ? JSON.stringify(parsed.nutritionDir)      : strategy.nutritionDir,
        weeklySchedule:    parsed.weeklySchedule    ? JSON.stringify(parsed.weeklySchedule)    : strategy.weeklySchedule,
        weeklyTargets:     parsed.weeklyTargets     ? JSON.stringify(parsed.weeklyTargets)     : strategy.weeklyTargets,
        workoutPlan:       parsed.workoutPlan       ? JSON.stringify(parsed.workoutPlan)       : strategy.workoutPlan,
        immediateNextSteps: parsed.immediateNextSteps ? JSON.stringify(parsed.immediateNextSteps) : strategy.immediateNextSteps,
        trackingMetrics:   parsed.trackingMetrics   ? JSON.stringify(parsed.trackingMetrics)   : strategy.trackingMetrics,
        risks:             parsed.risks             ?? strategy.risks,
        decisionRules:     parsed.decisionRules     ?? strategy.decisionRules,
        roadmap:           parsed.roadmap           ? JSON.stringify(parsed.roadmap)           : strategy.roadmap,
      },
    })

    return NextResponse.json({ ok: true, strategy: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
