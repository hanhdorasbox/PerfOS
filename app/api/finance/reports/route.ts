import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const reports = await prisma.financeReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })

  return NextResponse.json(reports)
}
