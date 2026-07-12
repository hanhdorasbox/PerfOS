import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyCron } from '@/lib/invest/cron/weekly'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Vercel Cron: Friday evening — weekly fundamentals refresh
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runWeeklyCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
