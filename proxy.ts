import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LOCK_COOKIE, LOCK_TTL_MS, createToken, isLockConfigured, verifyToken } from '@/lib/auth/lock'

// App-wide passcode gate (Next 16 proxy, formerly middleware).
// Runs before every page/route in the matcher below.

function setLockCookie(res: NextResponse, token: string) {
  res.cookies.set(LOCK_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: LOCK_TTL_MS / 1000,
  })
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  // Endpoints that must stay reachable while locked
  const alwaysOpen =
    pathname === '/lock' ||
    pathname.startsWith('/api/unlock') ||
    pathname.startsWith('/api/lock') ||
    pathname.startsWith('/api/cron') || // cron routes are CRON_SECRET-gated
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon')
  if (alwaysOpen) return NextResponse.next()

  // No PIN configured → app stays open (never lock the owner out)
  if (!isLockConfigured()) return NextResponse.next()

  // Only finance data APIs are gated; other APIs (Performance OS, internal
  // cron fetches) stay open so nothing existing breaks.
  const isGatedApi = pathname.startsWith('/api/invest')
  const isApi = pathname.startsWith('/api/')
  if (isApi && !isGatedApi) return NextResponse.next()

  const token = req.cookies.get(LOCK_COOKIE)?.value
  const unlocked = await verifyToken(token)

  if (unlocked) {
    // Slide the session on real activity; skip prefetches so idle still counts
    const isPrefetch =
      req.headers.get('next-router-prefetch') === '1' ||
      req.headers.get('purpose') === 'prefetch'
    const res = NextResponse.next()
    if (!isPrefetch) setLockCookie(res, await createToken())
    return res
  }

  if (isGatedApi) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/lock'
  url.search = ''
  if (pathname !== '/') url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Run everywhere except Next internals and static asset files
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|svg|jpg|jpeg|webp|gif|ico|txt|xml|json|webmanifest)$).*)'],
}
