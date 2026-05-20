import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const userId = req.nextUrl.searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/?error=calendar_auth_failed`)
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/calendar/callback`
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)

    await prisma.googleCalendarToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        updatedAt: new Date(),
      },
    })

    // Redirect back to dashboard — CalendarWidget will detect needsSetup and show picker
    return NextResponse.redirect(`${appUrl}/?calendar=connected`)
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : ''
    const isRedirectMismatch = errMsg.toLowerCase().includes('redirect')
    return NextResponse.redirect(isRedirectMismatch ? `${appUrl}/calendar-setup` : `${appUrl}/?error=calendar_token_failed`)
  }
}
