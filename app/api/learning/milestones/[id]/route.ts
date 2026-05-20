import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { completed, evidence } = await req.json()
    const milestone = await prisma.learningMilestone.update({
      where: { id },
      data: {
        completed: Boolean(completed),
        completedAt: completed ? new Date() : null,
        evidence: evidence ?? undefined,
      },
    })
    return NextResponse.json({ milestone })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
