import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/calendar/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google Calendar not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local' },
      { status: 400 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    prompt: 'consent',
    state: req.nextUrl.searchParams.get('userId') || '',
  })

  return NextResponse.redirect(url)
}
