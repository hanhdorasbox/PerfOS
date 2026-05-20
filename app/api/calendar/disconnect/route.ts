import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  await prisma.googleCalendarToken.deleteMany({ where: { userId } })
  return NextResponse.json({ ok: true })
}
