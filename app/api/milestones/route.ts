import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { goalId, title, weight } = await req.json()
  if (!goalId || !title?.trim()) {
    return NextResponse.json({ error: 'goalId and title required' }, { status: 400 })
  }
  const milestone = await prisma.milestone.create({
    data: {
      goalId,
      title: title.trim(),
      weight: Number(weight) || 25,
      completed: false,
    },
  })
  return NextResponse.json(milestone)
}
