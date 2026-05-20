import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, type, duration, notes } = await req.json()
  const log = await prisma.workoutLog.create({ data: { userId, type, duration, notes, date: new Date() } })
  return NextResponse.json(log)
}
