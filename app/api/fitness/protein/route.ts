import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, amount, target } = await req.json()
  const log = await prisma.proteinLog.create({ data: { userId, amount, target, date: new Date() } })
  return NextResponse.json(log)
}
