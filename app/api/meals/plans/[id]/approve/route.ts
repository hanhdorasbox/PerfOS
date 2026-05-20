import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const plan = await prisma.mealPlan.update({
    where: { id },
    data: { status: 'approved' },
  })
  return NextResponse.json(plan)
}
