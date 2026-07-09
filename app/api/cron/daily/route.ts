import { NextRequest, NextResponse } from 'next/server'
import { runDailyCron } from '@/lib/invest/cron/daily'

export const dynamic = 'force-dynamic'
// Sequential throttled fetching can take a while with many assets
export const maxDuration = 300

// Vercel Cron: every working day at 21:30 UTC (~22:30 Europe/Prague in
// winter; CEST shifts it to 23:30 — Vercel crons can't express timezones).
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailyCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
