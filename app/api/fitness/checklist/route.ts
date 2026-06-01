import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Execution-based setup tasks — these replace any body-metric tasks from old strategies
const EXECUTION_SETUP_TASKS = [
  'Confirm this week\'s training schedule.',
  'Complete your first planned workout to start Week 1.',
  'Set protein support plan for the next 3 days.',
  'Set alcohol limit for this week.',
]

const BODY_METRIC_PATTERN = /\b(waist|circumference|body composition|body measurement|baseline|current weight|kg target|cm target|weight|measure)\b/i

function sanitizeSteps(steps: string[]): string[] {
  const clean = steps.filter(s => !BODY_METRIC_PATTERN.test(s))
  // If we filtered out everything, return execution-based defaults
  if (clean.length === 0) return EXECUTION_SETUP_TASKS
  // If we have very few clean steps, pad with execution defaults that aren't duplicated
  const combined = [...clean]
  for (const task of EXECUTION_SETUP_TASKS) {
    if (combined.length >= 4) break
    if (!combined.some(s => s.toLowerCase().includes(task.toLowerCase().slice(0, 20)))) {
      combined.push(task)
    }
  }
  return combined
}

// GET /api/fitness/checklist?strategyId=xxx
// Returns checklist items for the strategy, auto-creating from immediateNextSteps if none exist yet.
export async function GET(req: NextRequest) {
  const strategyId = req.nextUrl.searchParams.get('strategyId')
  if (!strategyId) return NextResponse.json({ error: 'strategyId required' }, { status: 400 })

  // Return existing items if already seeded
  const existing = await prisma.strategyChecklistItem.findMany({
    where: { strategyId },
    orderBy: { orderIndex: 'asc' },
  })

  if (existing.length > 0) {
    // Retroactively sanitize body-metric items: replace title in DB and return clean version
    const sanitized = await Promise.all(existing.map(async item => {
      if (BODY_METRIC_PATTERN.test(item.title) && !item.completed) {
        // Find a suitable replacement not already in the list
        const existingTitles = existing.map(i => i.title)
        const replacement = EXECUTION_SETUP_TASKS.find(t => !existingTitles.includes(t)) ?? EXECUTION_SETUP_TASKS[0]
        const updated = await prisma.strategyChecklistItem.update({
          where: { id: item.id },
          data: { title: replacement },
        }).catch(() => item) // Fallback to original on error
        return { ...item, title: (updated as typeof item).title }
      }
      return item
    }))

    return NextResponse.json(sanitized.map(i => ({
      id: i.id,
      title: i.title,
      orderIndex: i.orderIndex,
      completed: i.completed,
      completedAt: i.completedAt?.toISOString() ?? null,
    })))
  }

  // Auto-initialize from immediateNextSteps stored on the strategy
  const strategy = await prisma.fitnessStrategy.findUnique({
    where: { id: strategyId },
    select: { immediateNextSteps: true },
  })

  if (!strategy) return NextResponse.json([])

  let rawSteps: string[] = []
  try {
    const parsed = strategy.immediateNextSteps ? JSON.parse(strategy.immediateNextSteps) : []
    rawSteps = Array.isArray(parsed) ? (parsed as unknown[]).filter((s): s is string => typeof s === 'string') : []
  } catch { rawSteps = [] }

  // Use execution-based defaults if no steps or all steps are body-metric
  const steps = rawSteps.length > 0 ? sanitizeSteps(rawSteps) : EXECUTION_SETUP_TASKS

  // Create one DB row per step
  const items = await prisma.$transaction(
    steps.map((title, i) =>
      prisma.strategyChecklistItem.create({
        data: { strategyId, title, orderIndex: i, completed: false },
      })
    )
  )

  return NextResponse.json(items.map(i => ({
    id: i.id,
    title: i.title,
    orderIndex: i.orderIndex,
    completed: i.completed,
    completedAt: null,
  })))
}

// PATCH /api/fitness/checklist
// Body: { id: string, completed: boolean }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id?: string; completed?: boolean }
  const { id, completed } = body

  if (!id || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'id and completed required' }, { status: 400 })
  }

  const updated = await prisma.strategyChecklistItem.update({
    where: { id },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  })

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    orderIndex: updated.orderIndex,
    completed: updated.completed,
    completedAt: updated.completedAt?.toISOString() ?? null,
  })
}
