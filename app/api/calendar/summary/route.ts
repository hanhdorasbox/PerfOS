import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'

// Returns a time-use summary of the last N weeks for pattern analysis
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const weeks = parseInt(req.nextUrl.searchParams.get('weeks') || '4')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  if (!token?.connectedCalendars) return NextResponse.json({ available: false })

  const connectedCalendars: { id: string; name: string; type: 'personal' | 'work'; color: string }[] =
    JSON.parse(token.connectedCalendars)

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
        data: { accessToken: credentials.access_token!, expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000) },
      })
      oauth2Client.setCredentials(credentials)
    } catch {
      return NextResponse.json({ available: false, error: 'token_expired' })
    }
  }

  try {
    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setDate(timeMin.getDate() - weeks * 7)

    const cal = google.calendar({ version: 'v3', auth: oauth2Client })

    const allEvents = await Promise.all(
      connectedCalendars.map(async (cc) => {
        try {
          const res = await cal.events.list({
            calendarId: cc.id,
            timeMin: timeMin.toISOString(),
            timeMax: now.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 500,
          })
          return (res.data.items || [])
            .filter(e => e.start?.dateTime) // only timed events, not all-day
            .map(e => ({
              title: e.summary || '',
              start: e.start!.dateTime!,
              end: e.end?.dateTime || e.start!.dateTime!,
              calendarType: cc.type,
              calendarName: cc.name,
              durationMin: Math.round(
                (new Date(e.end?.dateTime || e.start!.dateTime!).getTime() -
                  new Date(e.start!.dateTime!).getTime()) / 60000
              ),
            }))
        } catch {
          return []
        }
      })
    )

    const events = allEvents.flat()

    // ── Aggregate time-use statistics ──────────────────────────────────────────

    // Hours by calendar type
    const hoursByType: Record<string, number> = {}
    for (const e of events) {
      hoursByType[e.calendarType] = (hoursByType[e.calendarType] || 0) + e.durationMin / 60
    }

    // Hours by day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const hoursByDow: number[] = new Array(7).fill(0)
    for (const e of events) {
      const dow = new Date(e.start).getDay()
      hoursByDow[dow] += e.durationMin / 60
    }
    const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Start time distribution — early (<9), core (9-17), evening (17-21), night (>21)
    const startHourBuckets = { early: 0, core: 0, evening: 0, night: 0 }
    for (const e of events) {
      const h = new Date(e.start).getHours()
      if (h < 9) startHourBuckets.early++
      else if (h < 17) startHourBuckets.core++
      else if (h < 21) startHourBuckets.evening++
      else startHourBuckets.night++
    }

    // Avg events per day (only days that have at least 1 event)
    const dayMap: Record<string, number> = {}
    for (const e of events) {
      const day = e.start.slice(0, 10)
      dayMap[day] = (dayMap[day] || 0) + 1
    }
    const activeDays = Object.keys(dayMap).length
    const avgEventsPerDay = activeDays > 0 ? Math.round((events.length / activeDays) * 10) / 10 : 0

    // Top recurring event titles (≥3 occurrences)
    const titleCount: Record<string, number> = {}
    for (const e of events) {
      const key = e.title.toLowerCase().trim()
      if (key) titleCount[key] = (titleCount[key] || 0) + 1
    }
    const recurringEvents = Object.entries(titleCount)
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, count]) => ({ title, count }))

    // Weekly hours totals
    const weeklyHours: { week: string; work: number; personal: number; total: number }[] = []
    for (let w = 0; w < weeks; w++) {
      const wEnd = new Date(now)
      wEnd.setDate(wEnd.getDate() - w * 7)
      const wStart = new Date(wEnd)
      wStart.setDate(wStart.getDate() - 7)
      const wLabel = wStart.toISOString().slice(0, 10)

      const wEvents = events.filter(e => {
        const d = new Date(e.start)
        return d >= wStart && d < wEnd
      })
      weeklyHours.push({
        week: wLabel,
        work: Math.round(wEvents.filter(e => e.calendarType === 'work').reduce((s, e) => s + e.durationMin / 60, 0) * 10) / 10,
        personal: Math.round(wEvents.filter(e => e.calendarType === 'personal').reduce((s, e) => s + e.durationMin / 60, 0) * 10) / 10,
        total: Math.round(wEvents.reduce((s, e) => s + e.durationMin / 60, 0) * 10) / 10,
      })
    }

    return NextResponse.json({
      available: true,
      weeksAnalyzed: weeks,
      totalEvents: events.length,
      activeDays,
      avgEventsPerDay,
      hoursByType: Object.fromEntries(
        Object.entries(hoursByType).map(([k, v]) => [k, Math.round(v * 10) / 10])
      ),
      hoursByDow: hoursByDow.map((h, i) => ({ day: dowLabels[i], hours: Math.round(h * 10) / 10 })),
      startHourDistribution: startHourBuckets,
      recurringEvents,
      weeklyHours: weeklyHours.reverse(), // chronological
    })
  } catch (e) {
    return NextResponse.json({ available: false, error: String(e) })
  }
}
