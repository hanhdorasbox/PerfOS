import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { planTasks } from '@/lib/execution-planner'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const plan = await prisma.mealPlan.update({
    where: { id },
    data: { status: 'approved' },
    include: { meals: true },
  })

  // Create a task for meal prep when plan is approved
  const mealsCount = plan.meals?.length ?? 0
  if (mealsCount > 0) {
    try {
      await planTasks(plan.userId, [{
        title: 'Batch cook this week\'s meals',
        description: `Prepare ${mealsCount} meals from the approved plan`,
        domain: 'nutrition',
        taskType: 'admin',
        priority: 'should',
        effort: 'deep',
        estimatedMinutes: 90,
        sourceModule: 'manual',
        sourceType: 'meal_prep_task',
        sourceId: plan.id,
        createdBy: 'system',
      }])
    } catch {
      // Silently fail if task creation errors
    }
  }

  return NextResponse.json(plan)
}
