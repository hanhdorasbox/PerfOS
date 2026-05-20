import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface IcsSource {
  url: string
  name: string
  type: 'personal' | 'work'
  color?: string
}

// ── Tiny ICS parser ────────────────────────────────────────────────────────────
function parseIcsDate(raw: string): Date | null {
  const clean = raw.replace(/^.*:/, '')
  const allDay = !clean.includes('T')
  if (allDay) {
    const y = +clean.slice(0, 4), m = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8)
    return new Date(y, m, d)
  }
  const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8)
  const h = +clean.slice(9, 11), min = +clean.slice(11, 13), s = +clean.slice(13, 15)
  if (clean.endsWith('Z')) return new Date(Date.UTC(y, mo, d, h, min, s))
  return new Date(y, mo, d, h, min, s)
}

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

interface IcsEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string | null
  calendarName?: string
  calendarType?: 'personal' | 'work'
  calendarColor?: string
}

function parseIcs(text: string, source: IcsSource): IcsEvent[] {
  const unfolded = unfold(text)
  const events: IcsEvent[] = []
  const blocks = unfolded.split(/BEGIN:VEVENT/)

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const get = (key: string) => {
      const match = block.match(new RegExp(`(?:^|\\n)${key}(?:;[^:\\n]*)?:([^\\n]*)`, 'm'))
      return match ? match[1].trim() : null
    }

    const uid = get('UID') || `ics-${source.name}-${i}`
    const summary = get('SUMMARY') || '(No title)'
    const location = get('LOCATION')
    const startRaw = get('DTSTART')
    const endRaw = get('DTEND')

    if (!startRaw) continue

    const start = parseIcsDate(startRaw)
    const end = endRaw ? parseIcsDate(endRaw) : start
    if (!start) continue

    events.push({
      id: uid,
      title: summary.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';'),
      start: start.toISOString(),
      end: (end || start).toISOString(),
      allDay: !startRaw.includes('T'),
      location: location || null,
      calendarName: source.name,
      calendarType: source.type,
      calendarColor: source.color,
    })
  }
  return events
}

function getSources(raw: string | null): IcsSource[] {
  if (!raw) return []
  try { return JSON.parse(raw) as IcsSource[] } catch { return [] }
}

// ── GET: fetch events from all configured sources ─────────────────────────────
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarIcsSources: true } })
  const sources = getSources(user?.calendarIcsSources ?? null)
  if (sources.length === 0) return NextResponse.json({ connected: false })

  try {
    const center = new Date(date)
    // Start from midnight today (not yesterday) so past-day events are never returned
    const from = new Date(center); from.setHours(0, 0, 0, 0)
    const to   = new Date(center); to.setDate(to.getDate() + 14)

    const allEvents: IcsEvent[] = []
    await Promise.all(sources.map(async (source) => {
      try {
        const res = await fetch(source.url, { next: { revalidate: 300 } })
        if (!res.ok) return
        const text = await res.text()
        const events = parseIcs(text, source).filter(e => {
          const s = new Date(e.start)
          return s >= from && s <= to
        })
        allEvents.push(...events)
      } catch { /* skip failed source */ }
    }))

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    return NextResponse.json({ connected: true, events: allEvents, sources })
  } catch (e) {
    console.error('[GET /api/calendar/ics]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── POST: add or update a source ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId, url, name, type, color } = await req.json() as {
      userId: string; url: string; name: string; type: 'personal' | 'work'; color?: string
    }
    if (!userId || !url || !name) return NextResponse.json({ error: 'userId, url and name required' }, { status: 400 })

    // Quick reachability check
    try {
      const test = await fetch(url, { method: 'HEAD' })
      if (!test.ok) {
        const test2 = await fetch(url)
        if (!test2.ok) throw new Error(`URL returned ${test2.status}`)
      }
    } catch (e) {
      return NextResponse.json({ error: `Cannot reach URL: ${e instanceof Error ? e.message : e}` }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarIcsSources: true } })
    const sources = getSources(user?.calendarIcsSources ?? null)

    // Replace if URL already exists, otherwise add
    const idx = sources.findIndex(s => s.url === url)
    const newSource: IcsSource = { url, name, type, color }
    if (idx >= 0) sources[idx] = newSource
    else sources.push(newSource)

    await prisma.user.update({ where: { id: userId }, data: { calendarIcsSources: JSON.stringify(sources) } })
    return NextResponse.json({ ok: true, sources })
  } catch (e) {
    console.error('[POST /api/calendar/ics]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── DELETE: remove a source by URL ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { userId, url } = await req.json() as { userId: string; url: string }
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarIcsSources: true } })
    const sources = getSources(user?.calendarIcsSources ?? null).filter(s => s.url !== url)

    await prisma.user.update({
      where: { id: userId },
      data: { calendarIcsSources: sources.length > 0 ? JSON.stringify(sources) : null },
    })
    return NextResponse.json({ ok: true, sources })
  } catch (e) {
    console.error('[DELETE /api/calendar/ics]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
