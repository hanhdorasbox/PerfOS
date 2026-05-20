import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.workoutLog.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[fitness/workout DELETE]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
