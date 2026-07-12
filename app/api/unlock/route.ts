import { NextRequest, NextResponse } from 'next/server'
import { LOCK_COOKIE, LOCK_TTL_MS, createToken, isLockConfigured, verifyPin } from '@/lib/auth/lock'

export const dynamic = 'force-dynamic'

// Verify the PIN and, on success, set the signed unlock cookie.
export async function POST(req: NextRequest) {
  if (!isLockConfigured()) {
    // Nothing to unlock — behave as already open
    return NextResponse.json({ ok: true, configured: false })
  }

  const body = await req.json().catch(() => null)
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  if (!pin || !verifyPin(pin)) {
    // Small delay to blunt brute-forcing
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(LOCK_COOKIE, await createToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: LOCK_TTL_MS / 1000,
  })
  return res
}
