import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'

function buildOAuth(userId?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/calendar/callback`
  )
}

async function getAuthedClient(userId: string) {
  const token = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  if (!token) return null

  const oauth2Client = buildOAuth()
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken || undefined,
    expiry_date: token.expiresAt.getTime(),
  })

  if (token.expiresAt < new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await prisma.googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
        },
      })
      oauth2Client.setCredentials(credentials)
    } catch {
      return null
    }
  }

  return oauth2Client
}

// GET /api/calendar/calendars?userId=X
// Returns list of all user's Google calendars
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const client = await getAuthedClient(userId)
  if (!client) return NextResponse.json({ connected: false, calendars: [] })

  try {
    const cal = google.calendar({ version: 'v3', auth: client })
    const res = await cal.calendarList.list({ maxResults: 50 })

    const calendars = (res.data.items || []).map(c => ({
      id: c.id,
      name: c.summary,
      description: c.description || null,
      color: c.backgroundColor || '#B4A7E5',
      primary: c.primary || false,
      accessRole: c.accessRole,
    }))

    // Also return currently connected calendars
    const token = await prisma.googleCalendarToken.findUnique({ where: { userId } })
    const connectedCalendars = token?.connectedCalendars
      ? JSON.parse(token.connectedCalendars)
      : null

    return NextResponse.json({ connected: true, calendars, connectedCalendars })
  } catch (e) {
    return NextResponse.json({ connected: true, calendars: [], error: String(e) })
  }
}

// POST /api/calendar/calendars
// Save selected calendars
export async function POST(req: NextRequest) {
  const { userId, calendars } = await req.json() as {
    userId: string
    calendars: { id: string; name: string; type: 'personal' | 'work'; color: string }[]
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await prisma.googleCalendarToken.update({
    where: { userId },
    data: { connectedCalendars: JSON.stringify(calendars) },
  })

  return NextResponse.json({ ok: true })
}
