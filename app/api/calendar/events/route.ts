import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'

async function getAuthedClient(userId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  if (!token) return { client: null, token: null }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/calendar/callback`
  )
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
          updatedAt: new Date(),
        },
      })
      oauth2Client.setCredentials(credentials)
    } catch {
      return { client: null, token }
    }
  }

  return { client: oauth2Client, token }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const date = req.nextUrl.searchParams.get('date') // YYYY-MM-DD

  if (!userId) return NextResponse.json({ events: [] })

  const { client, token } = await getAuthedClient(userId)
  if (!client || !token) return NextResponse.json({ events: [], connected: false })

  // Determine which calendar IDs to query
  const connectedCalendars: { id: string; name: string; type: 'personal' | 'work'; color: string }[] =
    token.connectedCalendars ? JSON.parse(token.connectedCalendars) : [{ id: 'primary', name: 'Primary', type: 'personal', color: '#B4A7E5' }]

  const needsSetup = !token.connectedCalendars
  if (needsSetup) {
    return NextResponse.json({ events: [], connected: true, needsSetup: true })
  }

  try {
    const targetDate = date ? new Date(date + 'T00:00:00') : new Date()
    const dayStart = new Date(targetDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(targetDate)
    dayEnd.setHours(23, 59, 59, 999)

    const cal = google.calendar({ version: 'v3', auth: client })

    // Fetch from all connected calendars in parallel
    const allEvents = await Promise.all(
      connectedCalendars.map(async (cc) => {
        try {
          const res = await cal.events.list({
            calendarId: cc.id,
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 50,
          })
          return (res.data.items || []).map(e => ({
            id: `${cc.id}_${e.id}`,
            title: e.summary || '(no title)',
            start: e.start?.dateTime || e.start?.date || '',
            end: e.end?.dateTime || e.end?.date || '',
            allDay: !e.start?.dateTime,
            location: e.location || null,
            calendarName: cc.name,
            calendarType: cc.type,
            calendarColor: cc.color,
          }))
        } catch {
          return []
        }
      })
    )

    // Merge and sort
    const events = allEvents
      .flat()
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({ events, connected: true, needsSetup: false })
  } catch {
    return NextResponse.json({ events: [], connected: true, error: 'fetch_failed' })
  }
}
