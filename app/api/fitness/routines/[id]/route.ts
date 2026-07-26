import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const user = await prisma.user.findFirst()
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })
  // Scope the delete to the current user so a stray id can't remove another's row.
  await prisma.workoutRoutine.deleteMany({ where: { id, userId: user.id } })
  return NextResponse.json({ ok: true })
}
