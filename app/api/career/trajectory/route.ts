import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      currentRole,
      currentLevel,
      responsibilities,
      keyStrengths,
      targetPath,
      targetRoleTitle,
      timeHorizon,
      gaps = [],
    } = await req.json()

    if (!userId || !currentRole || !targetPath) {
      return NextResponse.json({ error: 'userId, currentRole, targetPath required' }, { status: 400 })
    }

    // Deactivate old trajectories
    await prisma.careerTrajectory.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'archived' },
    })

    const trajectory = await prisma.careerTrajectory.create({
      data: {
        userId,
        currentRole,
        currentLevel: currentLevel ?? null,
        responsibilities: responsibilities ?? null,
        keyStrengths: Array.isArray(keyStrengths) ? JSON.stringify(keyStrengths) : keyStrengths ?? null,
        targetPath,
        targetRoleTitle: targetRoleTitle ?? null,
        timeHorizon: timeHorizon ?? null,
        status: 'active',
        gaps: {
          create: gaps.map((g: { gapType: string; title: string; description?: string; priority?: number }) => ({
            gapType: g.gapType,
            title: g.title,
            description: g.description ?? null,
            priority: g.priority ?? 2,
          })),
        },
      },
      include: { gaps: true },
    })

    return NextResponse.json({ trajectory })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
