'use client'
import SideCard from '@/components/ui/SideCard'

export default function TodaysMeetings({ events, workStartMin, workEndMin }: { events: Array<{ start: Date; end: Date }>; workStartMin: number; workEndMin: number }) {
  const now = new Date()
  const todayEvents = events.filter(e => {
    const eStart = e.start.getHours() * 60 + e.start.getMinutes()
    return eStart >= now.getHours() * 60 + now.getMinutes() // Future events only
  }).sort((a, b) => a.start.getTime() - b.start.getTime())

  if (todayEvents.length === 0) {
    return (
      <SideCard label="Today's Meetings">
        <div style={{ fontSize: 12, color: '#6E6E76' }}>No upcoming meetings</div>
      </SideCard>
    )
  }

  return (
    <SideCard label="Today's Meetings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {todayEvents.map((event, i) => {
          const startH = event.start.getHours(), startM = event.start.getMinutes()
          const endH = event.end.getHours(), endM = event.end.getMinutes()
          const startMin = startH * 60 + startM
          const endMin = endH * 60 + endM
          const isDuringWork = startMin >= workStartMin && endMin <= workEndMin
          const isPostWork = startMin >= workEndMin
          const eventColor = isPostWork ? '#DDB96A' : isDuringWork ? '#80BDFF' : '#6E6E76'
          const durationMin = endMin - startMin
          const durationLabel = durationMin > 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
            : `${durationMin}m`

          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ minWidth: 45, paddingTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: eventColor, fontVariantNumeric: 'tabular-nums' }}>
                  {String(startH).padStart(2, '0')}:{String(startM).padStart(2, '0')}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#EEEEF2', fontWeight: 500 }}>
                  {event.start.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} – {event.end.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 10, color: '#6E6E76', marginTop: 1 }}>{durationLabel} · {isPostWork ? 'Post-work' : isDuringWork ? 'Work hours' : 'Personal'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </SideCard>
  )
}
