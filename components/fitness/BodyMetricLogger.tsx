'use client'

import { useState } from 'react'

interface FitnessLog {
  id: string
  date: string
  weight: number | null
  waist: number | null
  hip: number | null
  notes: string | null
}

interface Props {
  userId: string
  logs: FitnessLog[]
  userHeight: number | null
}

/** Returns today's date as YYYY-MM-DD in local timezone (avoids UTC off-by-one) */
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BodyMetricLogger({ userId, logs: initLogs, userHeight: initHeight }: Props) {
  const [logs, setLogs] = useState<FitnessLog[]>(initLogs)
  const [weight, setWeight] = useState('')
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
  // Height (one-time profile field)
  const [height, setHeight] = useState<number | null>(initHeight)
  const [heightInput, setHeightInput] = useState(initHeight ? String(initHeight) : '')
  const [editingHeight, setEditingHeight] = useState(initHeight === null)
  const [savingHeight, setSavingHeight] = useState(false)

  const flash = (text: string, isError = false) => {
    setMsg(text)
    setMsgIsError(isError)
    setTimeout(() => setMsg(''), 3000)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!weight && !waist && !hip) return
    setSaving(true)
    try {
      const res = await fetch('/api/fitness/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date,
          weight: weight ? parseFloat(weight) : null,
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
          const updated = [...prev]
          updated[idx] = data
          return updated
        }
        return [data, ...prev]
      })

      flash('Saved ✓')
      setWeight('')
      setWaist('')
      setHip('')
      setNotes('')
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

  const saveHeight = async () => {
    const val = parseFloat(heightInput)
    if (isNaN(val) || val <= 0 || val > 300) return
    setSavingHeight(true)
    try {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, height: val }),
      })
      setHeight(val)
      setEditingHeight(false)
    } finally {
      setSavingHeight(false)
    }
  }

  const latest = logs[0]

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#FAFAFA',
    padding: '7px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E' }}>
            Body Metrics
          </div>
          {latest && !showForm && (
            <div style={{ fontSize: 12, color: '#B8B6B0', marginTop: 4 }}>
              Latest ({new Date(latest.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}):
              {latest.weight != null && <> <strong style={{ color: '#FAFAFA' }}>{latest.weight} kg</strong></>}
              {latest.waist != null && <> · <strong style={{ color: '#FAFAFA' }}>{latest.waist} cm</strong> waist</>}
              {latest.hip != null && <> · <strong style={{ color: '#FAFAFA' }}>{latest.hip} cm</strong> hip</>}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#76746E', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          {showForm ? 'Hide Form' : 'Log Measurement'}
        </button>
      </div>

      {/* Height — one-time profile field */}
      {height === null || editingHeight ? (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: height === null ? 'rgba(180,167,229,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${height === null ? 'rgba(180,167,229,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {height === null && (
            <span style={{ fontSize: 12, color: '#B4A7E5', flex: 1 }}>
              Set your height to enable BMI tracking
            </span>
          )}
          {height !== null && (
            <span style={{ fontSize: 12, color: '#76746E', flex: 1 }}>Edit height (cm)</span>
          )}
          <input
            type="number"
            step="0.1"
            min="50"
            max="300"
            placeholder="e.g. 168"
            value={heightInput}
            onChange={e => setHeightInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveHeight()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: '#FAFAFA', fontSize: 13, width: 90, outline: 'none' }}
            autoFocus={height === null}
          />
          <span style={{ fontSize: 12, color: '#76746E' }}>cm</span>
          <button
            onClick={saveHeight}
            disabled={savingHeight || !heightInput}
            style={{ background: 'rgba(107,227,164,0.12)', border: '1px solid rgba(107,227,164,0.3)', color: '#6BE3A4', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {savingHeight ? '…' : 'Save'}
          </button>
          {height !== null && (
            <button
              onClick={() => setEditingHeight(false)}
              style={{ background: 'none', border: 'none', color: '#76746E', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#76746E' }}>Height:</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#B8B6B0' }}>{height} cm</span>
          <button
            onClick={() => { setHeightInput(String(height)); setEditingHeight(true) }}
            style={{ background: 'none', border: 'none', color: '#76746E', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            edit
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Weight (kg)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 65.5" style={inputStyle} value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Waist (cm)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 72" style={inputStyle} value={waist} onChange={e => setWaist(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Hip (cm)</label>
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
              disabled={saving || (!weight && !waist && !hip)}
              style={{
                background: 'rgba(107,227,164,0.12)',
                border: '1px solid rgba(107,227,164,0.3)',
                color: '#6BE3A4',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: (!weight && !waist && !hip) ? 0.4 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: 8, fontSize: 12, color: msgIsError ? '#FF6B6B' : '#6BE3A4' }}>
              {msg}
            </div>
          )}
        </form>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Recent Measurements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(showAll ? logs : logs.slice(0, 3)).map(log => (
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
                <span style={{ color: '#76746E', minWidth: 60 }}>
                  {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                {log.weight != null && <span style={{ color: '#FAFAFA', fontWeight: 600 }}>{log.weight} kg</span>}
                {log.waist != null && <span style={{ color: '#B8B6B0' }}>{log.waist} cm waist</span>}
                {log.hip != null && <span style={{ color: '#B8B6B0' }}>{log.hip} cm hip</span>}
                {log.notes && <span style={{ color: '#76746E', flex: 1 }}>{log.notes}</span>}
                <button
                  onClick={() => deleteLog(log.id)}
                  disabled={deleting === log.id}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {logs.length > 3 && (
            <button
              onClick={() => setShowAll(p => !p)}
              style={{ marginTop: 6, background: 'none', border: 'none', color: '#76746E', fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              {showAll ? 'Show less ▲' : `Show ${logs.length - 3} more ▼`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
