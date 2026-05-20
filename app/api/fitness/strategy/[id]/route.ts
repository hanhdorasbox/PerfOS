import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.fitnessStrategy.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/fitness/strategy/[id]]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
