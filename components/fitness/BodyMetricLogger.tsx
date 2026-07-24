'use client'

import { useState } from 'react'

interface FitnessLog {
  id: string
  date: string
  waist: number | null
  hip: number | null
  notes: string | null
}

interface Props {
  userId: string
  logs: FitnessLog[]
}

/** Returns today's date as YYYY-MM-DD in local timezone */
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BodyMetricLogger({ userId, logs: initLogs }: Props) {
  const [logs, setLogs] = useState<FitnessLog[]>(initLogs)
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayLocal)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgIsError, setMsgIsError] = useState(false)
  const [showForm, setShowForm] = useState(initLogs.length === 0)
  const [showAll, setShowAll] = useState(false)

  const flash = (text: string, isError = false) => {
    setMsg(text)
    setMsgIsError(isError)
    setTimeout(() => setMsg(''), 3000)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waist && !hip) return
    setSaving(true)
    try {
      const res = await fetch('/api/fitness/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date,
          weight: null, // not tracked
          waist: waist ? parseFloat(waist) : null,
          hip: hip ? parseFloat(hip) : null,
          notes: notes || null,
        }),
      })
      const data = await res.json() as FitnessLog & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`)

      setLogs(prev => {
        const idx = prev.findIndex(l => l.id === data.id)
        if (idx >= 0) {
          const updated = [...prev]; updated[idx] = data; return updated
        }
        return [data, ...prev]
      })

      flash('Saved ✓')
      setWaist(''); setHip(''); setNotes('')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save', true)
    } finally {
      setSaving(false)
    }
  }

  const deleteLog = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/fitness/log/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error || 'Delete failed')
      }
      setLogs(prev => prev.filter(l => l.id !== id))
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Delete failed', true)
    } finally {
      setDeleting(null)
    }
  }

  const latest = logs[0]

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#F5F5F7',
    padding: '7px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
            Body Metrics
          </div>
          {latest && !showForm && (
            <div style={{ fontSize: 12, color: '#A1A1A6', marginTop: 4 }}>
              Latest ({new Date(latest.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}):
              {latest.waist != null && <> <strong style={{ color: '#F5F5F7' }}>{latest.waist} cm</strong> waist</>}
              {latest.hip != null && <> · <strong style={{ color: '#F5F5F7' }}>{latest.hip} cm</strong> hip</>}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          {showForm ? 'Hide Form' : 'Log Measurement'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} style={{ marginTop: 16 }}>
          <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Waist (cm)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 72" style={inputStyle} value={waist} onChange={e => setWaist(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Hip (cm)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 95" style={inputStyle} value={hip} onChange={e => setHip(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              placeholder="Notes (optional)"
              style={{ ...inputStyle, flex: 1 }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving || (!waist && !hip)}
              style={{
                background: 'rgba(100, 240, 170,0.12)',
                border: '1px solid rgba(100, 240, 170,0.3)',
                color: '#64f0aa',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: (!waist && !hip) ? 0.4 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: 8, fontSize: 12, color: msgIsError ? '#ff8168' : '#64f0aa' }}>
              {msg}
            </div>
          )}
        </form>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Recent Measurements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(showAll ? logs : logs.slice(0, 5)).map(log => (
              <div
                key={log.id}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '5px 8px', background: 'rgba(255,255,255,0.02)',
                  borderRadius: 8, fontSize: 12,
                  opacity: deleting === log.id ? 0.4 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <span style={{ color: '#6E6E73', minWidth: 60 }}>
                  {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                {log.waist != null && <span style={{ color: '#A1A1A6' }}>{log.waist} cm waist</span>}
                {log.hip != null && <span style={{ color: '#A1A1A6' }}>{log.hip} cm hip</span>}
                {log.notes && <span style={{ color: '#6E6E73', flex: 1 }}>{log.notes}</span>}
                <button
                  onClick={() => deleteLog(log.id)}
                  disabled={deleting === log.id}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {logs.length > 5 && (
            <button
              onClick={() => setShowAll(p => !p)}
              style={{ marginTop: 6, background: 'none', border: 'none', color: '#6E6E73', fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              {showAll ? 'Show less ▲' : `Show ${logs.length - 5} more ▼`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
