'use client'
import { useState, useEffect, useCallback } from 'react'
import Spinner from '@/components/ui/Spinner'
import { Leaf, Briefcase, CalendarDays, Target } from 'lucide-react'

interface CalEvent {
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

interface IcsSource {
  url: string
  name: string
  type: 'personal' | 'work'
  color?: string
}

interface AvailableCalendar { id: string; name: string; description: string | null; color: string; primary: boolean }
interface ConnectedCalendar { id: string; name: string; type: 'personal' | 'work'; color: string }

interface Props {
  userId: string
  date?: string
  calendarConnected: boolean
  calendarIcsConnected?: boolean
}

const SOURCE_COLORS = {
  personal: '#7FD5AA',
  work: '#80BDFF',
}

export default function CalendarWidget({ userId, date, calendarConnected: initialConnected, calendarIcsConnected: initialIcsConnected }: Props) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [icsSources, setIcsSources] = useState<IcsSource[]>([])
  const [connected, setConnected] = useState(initialConnected)
  const [icsConnected, setIcsConnected] = useState(initialIcsConnected ?? false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(false)

  // OAuth picker
  const [showPicker, setShowPicker] = useState(false)
  const [availableCalendars, setAvailableCalendars] = useState<AvailableCalendar[]>([])
  const [connectedCalendars, setConnectedCalendars] = useState<ConnectedCalendar[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [oauthSaving, setOauthSaving] = useState(false)
  const [selections, setSelections] = useState<Record<string, { checked: boolean; type: 'personal' | 'work' }>>({})

  // ICS form
  const [showIcsForm, setShowIcsForm] = useState(false)
  const [icsUrl, setIcsUrl] = useState('')
  const [icsName, setIcsName] = useState('')
  const [icsType, setIcsType] = useState<'personal' | 'work'>('personal')
  const [icsSaving, setIcsSaving] = useState(false)
  const [icsError, setIcsError] = useState('')
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [showManageSources, setShowManageSources] = useState(false)

  const isConnected = connected || icsConnected

  // ── Load events ──────────────────────────────────────────────────────────────
  const loadEvents = useCallback(() => {
    if (!isConnected) return
    setLoading(true)
    const endpoint = icsConnected && !connected
      ? `/api/calendar/ics?userId=${userId}&date=${date || ''}`
      : `/api/calendar/events?userId=${userId}&date=${date || ''}`

    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        if (d.connected === false) { if (icsConnected) setIcsConnected(false); else setConnected(false); return }
        if (d.needsSetup) { setNeedsSetup(true); return }
        setEvents(d.events || [])
        if (d.sources) setIcsSources(d.sources)
        setNeedsSetup(false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [connected, icsConnected, userId, date, isConnected])

  useEffect(() => {
    loadEvents()
    // Auto-refresh every 5 minutes so past events roll off and upcoming events stay current
    const id = setInterval(loadEvents, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadEvents])

  // ── Add ICS source ───────────────────────────────────────────────────────────
  const addIcsSource = async () => {
    if (!icsUrl.trim() || !icsName.trim()) return
    setIcsSaving(true)
    setIcsError('')
    try {
      const res = await fetch('/api/calendar/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, url: icsUrl.trim(), name: icsName.trim(), type: icsType, color: SOURCE_COLORS[icsType] }),
      })
      const data = await res.json() as { ok?: boolean; sources?: IcsSource[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      setIcsSources(data.sources || [])
      setIcsConnected(true)
      setShowIcsForm(false)
      setIcsUrl('')
      setIcsName('')
      setIcsType('personal')
      // Reload events
      setLoading(true)
      const evRes = await fetch(`/api/calendar/ics?userId=${userId}&date=${date || ''}`)
      const evData = await evRes.json()
      setEvents(evData.events || [])
      setLoading(false)
    } catch (e) {
      setIcsError(e instanceof Error ? e.message : 'Could not connect')
    } finally {
      setIcsSaving(false)
    }
  }

  // ── Remove ICS source ────────────────────────────────────────────────────────
  const removeIcsSource = async (url: string) => {
    setRemovingUrl(url)
    try {
      const res = await fetch('/api/calendar/ics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, url }),
      })
      const data = await res.json() as { sources?: IcsSource[] }
      const remaining = data.sources || []
      setIcsSources(remaining)
      if (remaining.length === 0) { setIcsConnected(false); setEvents([]) }
    } finally {
      setRemovingUrl(null)
    }
  }

  // ── OAuth helpers ─────────────────────────────────────────────────────────────
  const openPicker = async () => {
    setShowPicker(true); setPickerLoading(true)
    try {
      const res = await fetch(`/api/calendar/calendars?userId=${userId}`)
      const data = await res.json() as { calendars: AvailableCalendar[]; connectedCalendars: ConnectedCalendar[] | null }
      setAvailableCalendars(data.calendars || [])
      const existing = data.connectedCalendars || []
      setConnectedCalendars(existing)
      const sel: Record<string, { checked: boolean; type: 'personal' | 'work' }> = {}
      for (const c of data.calendars) {
        const found = existing.find(e => e.id === c.id)
        sel[c.id] = { checked: !!found, type: found?.type || 'personal' }
      }
      setSelections(sel)
    } finally { setPickerLoading(false) }
  }

  const saveCalendars = async () => {
    setOauthSaving(true)
    try {
      const chosen = availableCalendars.filter(c => selections[c.id]?.checked)
        .map(c => ({ id: c.id, name: c.name, type: selections[c.id]?.type || 'personal', color: c.color }))
      await fetch('/api/calendar/calendars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, calendars: chosen }) })
      setConnectedCalendars(chosen); setShowPicker(false); setNeedsSetup(false)
      setLoading(true)
      const res = await fetch(`/api/calendar/events?userId=${userId}&date=${date || ''}`)
      const d = await res.json(); setEvents(d.events || []); setLoading(false)
    } finally { setOauthSaving(false) }
  }

  const handleDisconnect = async () => {
    await fetch('/api/calendar/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    setConnected(false); setEvents([]); setNeedsSetup(false)
  }

  // ── Add source form (JSX variable, NOT an inner component — prevents focus loss on re-render) ──
  const icsAddForm = showIcsForm ? (
    <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9E9EA6' }}>Add calendar source</span>
        <button onClick={() => { setShowIcsForm(false); setIcsError('') }} style={{ background: 'none', border: 'none', color: '#6E6E76', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['personal', 'work'] as const).map(t => (
          <button key={t} onClick={() => setIcsType(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: icsType === t ? (t === 'work' ? 'rgba(128,189,255,0.2)' : 'rgba(127,213,170,0.15)') : 'rgba(255,255,255,0.05)', color: icsType === t ? (t === 'work' ? '#80BDFF' : '#7FD5AA') : '#6E6E76' }}>
            {t === 'personal' ? <><Leaf size={11} /> Personal</> : <><Briefcase size={11} /> Work</>}
          </button>
        ))}
      </div>

      <input
        value={icsName}
        onChange={e => setIcsName(e.target.value)}
        placeholder={icsType === 'work' ? 'e.g. Outlook – Work' : 'e.g. Google Calendar'}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EEEEF2', fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
      />

      <input
        value={icsUrl}
        onChange={e => setIcsUrl(e.target.value)}
        placeholder="https://calendar.google.com/calendar/ical/… or Outlook ICS URL"
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: `1px solid ${icsError ? 'rgba(232,144,122,0.4)' : 'rgba(255,255,255,0.1)'}`, color: '#EEEEF2', fontSize: 11, outline: 'none', marginBottom: icsError ? 6 : 10, boxSizing: 'border-box', fontFamily: 'monospace' }}
      />

      {icsError && <p style={{ fontSize: 11, color: '#E8907A', marginBottom: 10 }}>{icsError}</p>}

      <button onClick={addIcsSource} disabled={icsSaving || !icsUrl.trim() || !icsName.trim()} className="btn-motion" style={{ width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.3)', color: '#B8A4FF', opacity: icsSaving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        {icsSaving && <Spinner size={12} color="#B8A4FF" strokeWidth={2} />}
        {icsSaving ? 'Connecting…' : 'Add Calendar'}
      </button>

      {icsType === 'work' && (
        <p style={{ fontSize: 10, color: '#6E6E76', marginTop: 10, lineHeight: 1.6 }}>
          Outlook ICS: Outlook Web → Settings → Calendar → Shared calendars → &quot;Publish a calendar&quot; → copy ICS link
        </p>
      )}
      {icsType === 'personal' && (
        <p style={{ fontSize: 10, color: '#6E6E76', marginTop: 10, lineHeight: 1.6 }}>
          Google Calendar: Settings (⚙) → your calendar → Integrate calendar → &quot;Secret address in iCal format&quot;
        </p>
      )}
    </div>
  ) : null

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 12 }}>Calendar</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ marginBottom: 4, color: '#6E6E76' }}><CalendarDays size={22} /></div>
          <div style={{ fontSize: 12, color: '#6E6E76', textAlign: 'center', lineHeight: 1.5 }}>Connect your calendars so Project Hanh can read your schedule</div>
          <button onClick={() => setShowIcsForm(true)} className="btn-motion" style={{ padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.3)', color: '#B8A4FF', width: '100%' }}>
            <CalendarDays size={13} style={{ marginRight: 5 }} /> Connect via ICS URL (recommended)
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 10, color: '#6E6E76' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <a href={`/api/calendar/auth?userId=${userId}`} style={{ display: 'block', padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E76', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
            Connect via Google OAuth
          </a>
        </div>
        {icsAddForm}
      </div>
    )
  }

  // ── OAuth picker ─────────────────────────────────────────────────────────────
  if (showPicker) {
    const checkedCount = Object.values(selections).filter(s => s.checked).length
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76' }}>Choose Calendars</div>
          <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', color: '#6E6E76', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {pickerLoading ? <div style={{ fontSize: 12, color: '#6E6E76' }}>Loading…</div> : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {availableCalendars.map(cal => {
                const sel = selections[cal.id] || { checked: false, type: 'personal' as const }
                return (
                  <div key={cal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: sel.checked ? 'rgba(255,255,255,0.04)' : 'transparent', border: sel.checked ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent' }}>
                    <div onClick={() => setSelections(prev => ({ ...prev, [cal.id]: { ...prev[cal.id], checked: !sel.checked } }))} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer', background: sel.checked ? cal.color : 'transparent', border: `2px solid ${cal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sel.checked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: '#EEEEF2', fontWeight: 500 }}>{cal.name} {cal.primary && <span style={{ color: '#6E6E76', fontSize: 10 }}>(primary)</span>}</div></div>
                    {sel.checked && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['personal', 'work'] as const).map(t => (
                          <button key={t} onClick={() => setSelections(prev => ({ ...prev, [cal.id]: { ...prev[cal.id], type: t } }))} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: sel.type === t ? (t === 'work' ? 'rgba(128,189,255,0.25)' : 'rgba(127,213,170,0.2)') : 'rgba(255,255,255,0.05)', color: sel.type === t ? (t === 'work' ? '#80BDFF' : '#7FD5AA') : '#6E6E76' }}>{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={saveCalendars} disabled={oauthSaving || checkedCount === 0} style={{ width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: checkedCount === 0 ? 'not-allowed' : 'pointer', background: checkedCount === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(184,164,255,0.15)', border: `1px solid ${checkedCount === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(184,164,255,0.3)'}`, color: checkedCount === 0 ? '#6E6E76' : '#B8A4FF', opacity: oauthSaving ? 0.6 : 1 }}>
              {oauthSaving ? 'Saving…' : `Connect ${checkedCount} calendar${checkedCount !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Needs OAuth setup ────────────────────────────────────────────────────────
  if (needsSetup) {
    return (
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 12 }}>Calendar</div>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 13, color: '#9E9EA6', marginBottom: 12 }}>Google Calendar connected — choose which calendars to use</div>
          <button onClick={openPicker} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.3)', color: '#B8A4FF' }}>Choose Calendars</button>
        </div>
      </div>
    )
  }

  // ── Events view ──────────────────────────────────────────────────────────────
  const now = new Date()
  const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0)
  const tomorrowMidnight = new Date(todayMidnight); tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1)

  // Filter: only events that haven't ended yet (for timed events), or are all-day today/future
  const upcoming = [...events]
    .filter(e => {
      if (e.allDay) {
        const d = new Date(e.start); d.setHours(0, 0, 0, 0)
        return d >= todayMidnight
      }
      return new Date(e.end) > now
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // Group by day
  interface DayGroup { label: string; dateKey: number; events: CalEvent[] }
  const groupMap = new Map<number, DayGroup>()
  for (const e of upcoming) {
    const d = new Date(e.start); d.setHours(0, 0, 0, 0)
    const key = d.getTime()
    if (!groupMap.has(key)) {
      let label: string
      if (key === todayMidnight.getTime()) label = 'Today'
      else if (key === tomorrowMidnight.getTime()) label = 'Tomorrow'
      else label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      groupMap.set(key, { label, dateKey: key, events: [] })
    }
    groupMap.get(key)!.events.push(e)
  }
  const dayGroups = Array.from(groupMap.values())

  // Focus window (next 45-min+ gap in today's events)
  const todayEvents = dayGroups.find(g => g.dateKey === todayMidnight.getTime())?.events ?? []
  let focusWindowStart: Date | null = null
  for (let i = 0; i < todayEvents.length - 1; i++) {
    const gapStart = new Date(todayEvents[i].end), gapEnd = new Date(todayEvents[i + 1].start)
    if ((gapEnd.getTime() - gapStart.getTime()) / 60000 >= 45 && gapStart > now) { focusWindowStart = gapStart; break }
  }
  if (!focusWindowStart && todayEvents.length > 0) {
    const after = new Date(todayEvents[todayEvents.length - 1].end)
    if (after > now) focusWindowStart = after
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76' }}>Calendar</div>
          <div style={{ fontSize: '11px', color: '#9E9EA6', fontWeight: 500 }}>
            {(date ? new Date(date) : new Date()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {icsConnected && (
            <button onClick={() => setShowManageSources(s => !s)} style={{ fontSize: 10, color: '#6E6E76', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sources ▾
            </button>
          )}
          {connected && <button onClick={openPicker} style={{ fontSize: 10, color: '#6E6E76', background: 'none', border: 'none', cursor: 'pointer' }}>Calendars ▾</button>}
          {connected && <button onClick={handleDisconnect} style={{ fontSize: 10, color: '#6E6E76', background: 'none', border: 'none', cursor: 'pointer' }}>Disconnect</button>}
        </div>
      </div>

      {/* ICS source management panel */}
      {showManageSources && icsConnected && (
        <div className="expand-enter" style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Connected sources</div>
          {icsSources.map(src => (
            <div key={src.url} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {src.type === 'work' ? <Briefcase size={12} color="#80BDFF" /> : <Leaf size={12} color="#7FD5AA" />}
                <div>
                  <div style={{ fontSize: 12, color: '#EEEEF2', fontWeight: 500 }}>{src.name}</div>
                  <div style={{ fontSize: 10, color: '#6E6E76' }}>{src.type}</div>
                </div>
              </div>
              <button onClick={() => removeIcsSource(src.url)} disabled={removingUrl === src.url} style={{ background: 'none', border: 'none', color: '#6E6E76', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                {removingUrl === src.url ? <Spinner size={11} color="#6E6E76" strokeWidth={2} /> : '✕'}
              </button>
            </div>
          ))}
          {!showIcsForm && (
            <button onClick={() => setShowIcsForm(true)} className="btn-motion" style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(184,164,255,0.1)', border: '1px solid rgba(184,164,255,0.2)', color: '#B8A4FF' }}>
              + Add another calendar
            </button>
          )}
          {icsAddForm}
        </div>
      )}

      {/* Source pills */}
      {!showManageSources && icsSources.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {icsSources.map(src => (
            <span key={src.url} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: src.type === 'work' ? 'rgba(128,189,255,0.1)' : 'rgba(127,213,170,0.1)', color: src.type === 'work' ? '#80BDFF' : '#7FD5AA', border: `1px solid ${src.type === 'work' ? 'rgba(128,189,255,0.2)' : 'rgba(127,213,170,0.2)'}` }}>
              {src.type === 'work' ? <Briefcase size={10} /> : <Leaf size={10} />}{src.name}
            </span>
          ))}
        </div>
      )}
      {!showManageSources && connected && connectedCalendars.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {connectedCalendars.map(cc => (
            <span key={cc.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: cc.type === 'work' ? 'rgba(128,189,255,0.1)' : 'rgba(127,213,170,0.1)', color: cc.type === 'work' ? '#80BDFF' : '#7FD5AA', border: `1px solid ${cc.type === 'work' ? 'rgba(128,189,255,0.2)' : 'rgba(127,213,170,0.2)'}` }}>
              {cc.type === 'work' ? <Briefcase size={10} /> : <Leaf size={10} />}{cc.name}
            </span>
          ))}
        </div>
      )}

      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner size={12} color="#6E6E76" strokeWidth={2} /><span style={{ fontSize: 12, color: '#6E6E76' }}>Loading…</span></div>}
      {!loading && upcoming.length === 0 && (
        <div style={{ fontSize: 12, color: '#6E6E76', fontStyle: 'italic' }}>No upcoming events</div>
      )}

      {/* Day-grouped events */}
      {dayGroups.map((group, gi) => (
        <div key={group.dateKey} style={{ marginBottom: gi < dayGroups.length - 1 ? 10 : 0 }}>
          {/* Day heading */}
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: group.label === 'Today' ? '#7FD5AA' : '#6E6E76',
            marginBottom: 5, marginTop: gi > 0 ? 6 : 0,
            paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            {group.label}
          </div>

          {/* Events in this day */}
          {group.events.map((e, idx) => {
            const startTime = e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
            const color = e.calendarType === 'work' ? '#80BDFF' : '#7FD5AA'
            const isPast = !e.allDay && new Date(e.start) < now && new Date(e.end) > now
            return (
              <div key={e.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: idx < group.events.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 2, minHeight: 24, borderRadius: 2, flexShrink: 0, marginTop: 3, background: isPast ? 'rgba(255,255,255,0.15)' : color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: isPast ? '#6E6E76' : '#EEEEF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: '#6E6E76', marginTop: 1, display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ color: isPast ? '#4A4845' : color === '#80BDFF' ? '#4A7FA5' : '#4A8A6E', fontWeight: 600 }}>{startTime}</span>
                    {isPast && <span style={{ fontSize: 9, color: '#4A4845' }}>in progress</span>}
                    {e.calendarName && <span style={{ color: '#3A3835' }}>· {e.calendarName}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {!loading && focusWindowStart && (
        <div style={{ marginTop: 8, padding: '5px 9px', borderRadius: 7, background: 'rgba(127,213,170,0.06)', border: '1px solid rgba(127,213,170,0.15)' }}>
          <div style={{ fontSize: 10, color: '#7FD5AA', display: 'flex', alignItems: 'center', gap: 4 }}><Target size={10} /> Focus window from {focusWindowStart.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 10, color: '#80BDFF' }}>{upcoming.filter(e => e.calendarType === 'work').length} work</span>
          <span style={{ fontSize: 10, color: '#7FD5AA' }}>{upcoming.filter(e => e.calendarType !== 'work').length} personal</span>
        </div>
      )}
    </div>
  )
}
