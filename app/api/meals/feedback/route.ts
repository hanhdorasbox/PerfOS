import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mealPlanId, mealTitle, liked, notes } = body

  // Update if feedback already exists for this meal in this plan
  const existing = await prisma.mealFeedback.findFirst({
    where: { mealPlanId, mealTitle },
  })

  let feedback
  if (existing) {
    feedback = await prisma.mealFeedback.update({
      where: { id: existing.id },
      data: { liked, notes: notes || null },
    })
  } else {
    feedback = await prisma.mealFeedback.create({
      data: { mealPlanId, mealTitle, liked, notes: notes || null },
    })
  }

  return NextResponse.json(feedback)
}
