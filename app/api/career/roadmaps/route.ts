import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/career/roadmaps?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json([], { status: 200 })

  const roadmaps = await prisma.careerRoadmap.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, goal: true, timeframe: true, roadmap: true, createdAt: true },
  })

  return NextResponse.json(roadmaps.map(r => ({
    id: r.id,
    goal: r.goal,
    timeframe: r.timeframe,
    roadmap: JSON.parse(r.roadmap),
    createdAt: r.createdAt.toISOString(),
  })))
}

// DELETE /api/career/roadmaps?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.careerRoadmap.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
