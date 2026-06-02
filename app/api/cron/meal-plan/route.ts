import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Vercel cron calls this every Monday at 05:00 UTC.
// Generates a draft meal plan for the week if none exists yet.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  const results: Array<{ userId: string; status: string }> = []

  for (const user of users) {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)

    const existing = await prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        weekStart: { gte: weekStart, lt: new Date(weekStart.getTime() + 86_400_000) },
      },
    })

    if (existing) {
      results.push({ userId: user.id, status: 'skipped — plan exists' })
      continue
    }

    try {
      const base = req.nextUrl.origin
      const res = await fetch(`${base}/api/meals/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      results.push({ userId: user.id, status: res.ok ? 'generated' : `error ${res.status}` })
    } catch (e) {
      results.push({ userId: user.id, status: `error: ${e}` })
    }
  }

  return NextResponse.json({ ok: true, results })
}
