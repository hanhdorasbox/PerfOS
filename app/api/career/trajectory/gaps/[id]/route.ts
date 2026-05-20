import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { closed } = await req.json()
    const gap = await prisma.trajectoryGap.update({
      where: { id },
      data: {
        closed: Boolean(closed),
        closedAt: closed ? new Date() : null,
      },
    })
    return NextResponse.json({ gap })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
