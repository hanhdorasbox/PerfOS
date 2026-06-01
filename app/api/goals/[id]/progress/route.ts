import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { calcQuantitativeProgress } from '@/lib/calculations'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { value, note } = await req.json()

  const rawValue = parseFloat(value)
  if (isNaN(rawValue)) {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
  }

  const goal = await prisma.goal.findUnique({ where: { id } })
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ProgressUpdate.value always stores a PERCENTAGE (0–100) so the chart history
  // is consistent regardless of goal type.
  // goal.currentValue stores the RAW metric value (e.g. 82 kg) for display.
  let pct: number
  if (
    goal.trackingType === 'QUANTITATIVE' &&
    goal.startValue != null &&
    goal.targetValue != null
  ) {
    pct = calcQuantitativeProgress(goal.startValue, rawValue, goal.targetValue)
  } else {
    // For MILESTONE type, user shouldn't be using this route manually —
    // progress is auto-derived from milestones. Accept the value as-is (treat as %).
    pct = Math.min(100, Math.max(0, rawValue))
  }

  // Atomic: both writes succeed or both fail
  await prisma.$transaction([
    prisma.progressUpdate.create({
      data: { goalId: id, value: pct, note: note || null },
    }),
    prisma.goal.update({
      where: { id },
      data: { currentValue: rawValue, updatedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
