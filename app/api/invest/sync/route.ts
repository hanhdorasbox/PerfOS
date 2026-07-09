import { NextResponse } from 'next/server'
import { syncTrading212 } from '@/lib/invest/sync/trading212'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// "Sync teď" button in settings
export async function POST() {
  try {
    const result = await syncTrading212()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
