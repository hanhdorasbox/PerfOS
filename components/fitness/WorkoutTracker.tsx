'use client'
import { useState } from 'react'

interface WorkoutLog { id: string; date: string; type: string; duration: number | null; notes: string | null }
interface ProteinLog { id: string; amount: number; date: string }

export default function WorkoutTracker({
  workoutLogs: initWorkoutLogs,
  proteinToday,
  proteinLogs: initProteinLogs,
  proteinTarget = 150,
  userId,
}: {
  workoutLogs: WorkoutLog[]
  proteinToday: number
  proteinLogs: ProteinLog[]
  proteinTarget?: number
  userId: string
}) {
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(initWorkoutLogs)
  const [proteinLogs, setProteinLogs] = useState<ProteinLog[]>(initProteinLogs)
  const [selectedType, setSelectedType] = useState('')
  const [note, setNote] = useState('')
  const [protein, setProtein] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState<string | null>(null)
  const [deletingProtein, setDeletingProtein] = useState<string | null>(null)
  const [workoutMsg, setWorkoutMsg] = useState('')
  const [proteinMsg, setProteinMsg] = useState('')

  const proteinTotal = proteinLogs.reduce((s, p) => s + p.amount, 0)

  const logWorkout = async () => {
    if (!selectedType) return
    setSaving(true)
    try {
      const res = await fetch('/api/fitness/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: selectedType, notes: note, duration: 60 }),
      })
      const data = await res.json() as WorkoutLog
      setWorkoutLogs(prev => [data, ...prev])
      setSelectedType('')
      setNote('')
      setWorkoutMsg('Workout logged!')
      setTimeout(() => setWorkoutMsg(''), 2000)
    } finally {
      setSaving(false)
    }
  }

  const deleteWorkout = async (id: string) => {
    setDeletingWorkout(id)
    try {
      await fetch(`/api/fitness/workout/${id}`, { method: 'DELETE' })
      setWorkoutLogs(prev => prev.filter(w => w.id !== id))
    } finally {
      setDeletingWorkout(null)
    }
  }

  const addProtein = async (amount: number) => {
    const res = await fetch('/api/fitness/protein', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, target: proteinTarget }),
    })
    if (res.ok) {
      const data = await res.json() as ProteinLog
      setProteinLogs(prev => [...prev, data])
      setProteinMsg(`+${amount}g added`)
      setTimeout(() => setProteinMsg(''), 2000)
    }
  }

  const deleteProtein = async (id: string) => {
    setDeletingProtein(id)
    try {
      await fetch(`/api/fitness/protein/${id}`, { method: 'DELETE' })
      setProteinLogs(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingProtein(null)
    }
  }

  const types = ['💪 Síla', '🏃 Cardio', '🧘 Sauna', '🚶 Chůze']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* ── Workout card ── */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>Log Workout</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {types.map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              style={{
                padding: '6px 12px', borderRadius: '999px',
                border: `1px solid ${selectedType === t ? 'rgba(107,227,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
                background: selectedType === t ? 'rgba(107,227,164,0.1)' : 'none',
                color: selectedType === t ? '#6BE3A4' : '#B8B6B0',
                fontSize: '12px', cursor: 'pointer',
              }}
            >{t}</button>
          ))}
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)…"
          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '12px', marginBottom: '10px', outline: 'none' }}
        />
        <button
          onClick={logWorkout}
          disabled={!selectedType || saving}
          style={{ width: '100%', padding: '9px', borderRadius: '8px', background: 'rgba(107,227,164,0.12)', border: '1px solid rgba(107,227,164,0.25)', color: '#6BE3A4', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
        >
          {saving ? 'Saving…' : '✓ Log Workout'}
        </button>
        {workoutMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: '#6BE3A4' }}>{workoutMsg}</div>}

        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: '8px' }}>Recent</div>
          {workoutLogs.length === 0 && (
            <div style={{ fontSize: 12, color: '#76746E' }}>No workouts logged yet.</div>
          )}
          {workoutLogs.slice(0, 7).map(w => (
            <div
              key={w.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px',
                opacity: deletingWorkout === w.id ? 0.4 : 1, transition: 'opacity 0.15s ease',
              }}
            >
              <span style={{ color: '#B8B6B0' }}>{w.type}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#76746E' }}>{new Date(w.date).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })}</span>
                <button
                  onClick={() => deleteWorkout(w.id)}
                  disabled={deletingWorkout === w.id}
                  style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}
                  title="Delete"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protein card ── */}
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>Protein Today</div>
        <div style={{ fontSize: '42px', fontWeight: 800, color: '#FAFAFA', lineHeight: 1, marginBottom: '4px' }}>
          {proteinTotal}<span style={{ fontSize: '20px', color: '#76746E' }}>/ {proteinTarget}g</span>
        </div>
        <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${Math.min(100, proteinTotal / proteinTarget * 100)}%`, background: '#6BE3A4', borderRadius: '3px' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[25, 30, 40, 50].map(g => (
            <button
              key={g}
              onClick={() => addProtein(g)}
              style={{ padding: '7px 14px', borderRadius: '999px', background: 'rgba(107,227,164,0.08)', border: '1px solid rgba(107,227,164,0.2)', color: '#6BE3A4', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >+{g}g</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={protein}
            onChange={e => setProtein(e.target.value)}
            placeholder="Custom g…"
            type="number"
            style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '12px', outline: 'none' }}
          />
          <button
            onClick={() => { if (+protein > 0) { addProtein(+protein); setProtein('') } }}
            style={{ padding: '7px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#B8B6B0', cursor: 'pointer', fontSize: '12px' }}
          >+Add</button>
        </div>
        {proteinMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: '#6BE3A4' }}>{proteinMsg}</div>}

        {/* Today's entries */}
        {proteinLogs.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#76746E', marginBottom: '6px' }}>Today&apos;s entries</div>
            {proteinLogs.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 0', fontSize: 12,
                  opacity: deletingProtein === p.id ? 0.4 : 1, transition: 'opacity 0.15s ease',
                }}
              >
                <span style={{ color: '#6BE3A4', fontWeight: 600 }}>+{p.amount}g</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#76746E', fontSize: 11 }}>
                    {new Date(p.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => deleteProtein(p.id)}
                    disabled={deletingProtein === p.id}
                    style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}
                    title="Delete"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
