'use client'
import { useState } from 'react'
import {
  type WorkSchedule, saveWorkSchedule, minToTimeStr, timeStrToMin,
} from '@/lib/work-schedule'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon-first

export default function WorkScheduleEditor({
  schedule,
  onChange,
  onClose,
}: {
  schedule: WorkSchedule
  onChange: (s: WorkSchedule) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<WorkSchedule>(schedule)

  function setDay(day: number, value: { start: number; end: number } | null) {
    setDraft(prev => ({ ...prev, [day]: value }))
  }

  function save() {
    saveWorkSchedule(draft)
    onChange(draft)
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6, padding: '3px 6px', fontSize: 11, color: '#EEEEF2',
    colorScheme: 'dark', outline: 'none',
  }

  return (
    <div className="expand-enter" style={{
      marginBottom: 10, padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#52525A', marginBottom: 10 }}>
        Work hours
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DAY_ORDER.map(day => {
          const val = draft[day]
          return (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#9E9EA6', width: 30, flexShrink: 0 }}>{DAY_LABELS[day]}</span>
              <button
                onClick={() => setDay(day, val ? null : { start: 9 * 60, end: 17 * 60 })}
                style={{
                  fontSize: 10, padding: '2px 9px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${val ? 'rgba(128,189,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  background: val ? 'rgba(128,189,255,0.10)' : 'rgba(255,255,255,0.03)',
                  color: val ? '#80BDFF' : '#6E6E76',
                }}
              >
                {val ? 'Work' : 'Off'}
              </button>
              {val && (
                <>
                  <input
                    type="time" value={minToTimeStr(val.start)} style={inputStyle}
                    onChange={e => setDay(day, { ...val, start: timeStrToMin(e.target.value) })}
                  />
                  <span style={{ fontSize: 10, color: '#52525A' }}>–</span>
                  <input
                    type="time" value={minToTimeStr(val.end)} style={inputStyle}
                    onChange={e => setDay(day, { ...val, end: timeStrToMin(e.target.value) })}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" style={{ padding: '5px 16px', fontSize: 11 }} onClick={save}>Save</button>
        <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
