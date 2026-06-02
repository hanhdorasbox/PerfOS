import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/quarters'

// Vercel cron calls this every Friday at 18:00 UTC.
// Generates a weekly report if none exists yet for the current week.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { monday: weekStart } = getWeekBounds()
  const users = await prisma.user.findMany({ select: { id: true } })
  const results: Array<{ userId: string; status: string }> = []

  for (const user of users) {
    const existing = await prisma.weeklyReport.findFirst({
      where: { userId: user.id, weekStart },
    })

    if (existing) {
      results.push({ userId: user.id, status: 'skipped — report exists' })
      continue
    }

    // Only generate if there's an active quarter
    const quarter = await prisma.quarter.findFirst({ where: { userId: user.id, status: 'active' } })
    if (!quarter) {
      results.push({ userId: user.id, status: 'skipped — no active quarter' })
      continue
    }

    try {
      const base = req.nextUrl.origin
      const res = await fetch(`${base}/api/reports/generate`, {
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
