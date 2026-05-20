import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const { goalId } = await params
  const body = await req.json()
  const eval_ = await prisma.careerCapitalGoalEval.upsert({
    where: { goalId },
    create: { goalId, ...body },
    update: body,
  })
  return NextResponse.json(eval_)
}
