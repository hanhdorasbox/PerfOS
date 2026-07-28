import { NextRequest, NextResponse } from 'next/server'
import { runNewsCron } from '@/lib/invest/news/engine'

export const dynamic = 'force-dynamic'
// Sequential throttled news fetch + per-ticker LLM triage can take a while
export const maxDuration = 300

// Vercel Cron: weekdays at 22:00 UTC (~23:00 Europe/Prague in winter, midnight
// in summer) — after the US close, so the day's earnings and news land in one
// sweep. Vercel crons can't express timezones. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runNewsCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
