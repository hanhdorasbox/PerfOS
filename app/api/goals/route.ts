import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      userId: string
      quarterId: string
      title: string
      category: string
      trackingType: string
      strategicRole?: string
      startValue?: number | null
      targetValue?: number | null
      currentValue?: number | null
      unit?: string | null
      deadline: string
      priorityWeight?: number
    }

    const { userId, quarterId, title, category, trackingType, strategicRole,
      startValue, targetValue, currentValue, unit, deadline, priorityWeight } = body

    if (!userId || !quarterId || !title?.trim() || !deadline) {
      return NextResponse.json({ error: 'userId, quarterId, title and deadline required' }, { status: 400 })
    }

    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) {
      return NextResponse.json({ error: 'deadline must be a valid date' }, { status: 400 })
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        quarterId,
        title: title.trim(),
        category: category || 'personal',
        trackingType: trackingType || 'MILESTONE',
        strategicRole: strategicRole || null,
        startValue: startValue ?? null,
        targetValue: targetValue ?? null,
        currentValue: currentValue ?? null,
        unit: unit || null,
        deadline: deadlineDate,
        priorityWeight: priorityWeight ?? 1.0,
        status: 'active',
      },
    })

    return NextResponse.json(goal)
  } catch (e) {
    console.error('[goals POST]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
