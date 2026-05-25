import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    // Allow updating: status, currentRole, currentLevel, targetPath, targetRoleTitle, timeHorizon,
    // readinessScore, readinessBreakdown, executionRoadmap, nextBestAction
    const allowed = [
      'status', 'currentRole', 'currentLevel', 'targetPath', 'targetRoleTitle',
      'timeHorizon', 'readinessScore', 'readinessBreakdown', 'executionRoadmap', 'nextBestAction',
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }
    const trajectory = await prisma.careerTrajectory.update({ where: { id }, data })
    return NextResponse.json({ trajectory })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Delete gaps and quarter plans first
    await prisma.trajectoryGap.deleteMany({ where: { trajectoryId: id } })
    await prisma.trajectoryQuarterPlan.deleteMany({ where: { trajectoryId: id } })
    await prisma.careerTrajectory.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
