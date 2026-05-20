import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Cascade: delete feedback and meals first
    await prisma.mealFeedback.deleteMany({ where: { mealPlanId: id } })
    await prisma.plannedMeal.deleteMany({ where: { mealPlanId: id } })
    await prisma.mealPlan.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[meals/plans DELETE]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
