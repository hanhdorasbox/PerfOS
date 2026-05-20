import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { status } = await req.json()
    const goal = await prisma.capabilityGoal.update({
      where: { id },
      data: { status },
    })
    return NextResponse.json({ goal })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
