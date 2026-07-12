import { NextResponse } from 'next/server'
import { LOCK_COOKIE } from '@/lib/auth/lock'

export const dynamic = 'force-dynamic'

// Clear the unlock cookie (manual lock / idle lock).
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(LOCK_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
