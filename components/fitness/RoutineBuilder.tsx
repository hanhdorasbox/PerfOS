'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import MuscleMap from './MuscleMap'
import { EXERCISES, EXERCISE_BY_ID, CATEGORY_LABELS, type ExerciseCategory } from '@/lib/fitness/exercises'
import type { ActivationMap } from '@/lib/fitness/bodyMap'

interface RoutineItem {
  exerciseId: string
  sets: number
  reps: number
}

export interface SavedRoutine {
  id: string
  name: string
  exercises: RoutineItem[]
  createdAt: string
}

const CATEGORIES: (ExerciseCategory | 'all')[] = ['all', 'push', 'pull', 'legs', 'core', 'cardio']

export default function RoutineBuilder({ initialRoutines }: { initialRoutines: SavedRoutine[] }) {
  const router = useRouter()
  const [routines, setRoutines] = useState<SavedRoutine[]>(initialRoutines)
  const [items, setItems] = useState<RoutineItem[]>([])
  const [name, setName] = useState('')
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Aggregate the muscles worked by the current routine.
  const activation = useMemo<ActivationMap>(() => {
    const map: ActivationMap = {}
    for (const it of items) {
      const ex = EXERCISE_BY_ID.get(it.exerciseId)
      if (!ex) continue
      for (const m of ex.primary) map[m] = 'primary'
      for (const m of ex.secondary) if (map[m] !== 'primary') map[m] = 'secondary'
    }
    return map
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return EXERCISES.filter(
      (e) => (cat === 'all' || e.category === cat) && (q === '' || e.name.toLowerCase().includes(q)),
    )
  }, [cat, search])

  const inRoutine = new Set(items.map((i) => i.exerciseId))

  function add(id: string) {
    if (inRoutine.has(id)) return
    setItems((prev) => [...prev, { exerciseId: id, sets: 3, reps: 10 }])
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.exerciseId !== id))
  }
  function patch(id: string, key: 'sets' | 'reps', value: number) {
    setItems((prev) => prev.map((i) => (i.exerciseId === id ? { ...i, [key]: value } : i)))
  }

  async function save() {
    if (!name.trim() || items.length === 0) {
      setError('Name the routine and add at least one exercise.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/fitness/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), exercises: items }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? `Save failed (${res.status})`)
      return
    }
    const d = await res.json()
    setRoutines((prev) => [d.routine, ...prev])
    setItems([])
    setName('')
    router.refresh()
  }

  function load(r: SavedRoutine) {
    setItems(r.exercises)
    setName(`${r.name} (copy)`)
  }

  async function del(id: string) {
    if (!window.confirm('Delete this routine?')) return
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/fitness/routines/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="r-grid-2" style={{ gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)' }}>
      {/* Left: muscle map + current routine + save */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <MuscleMap activation={activation} />
        </div>

        <div className="card" style={{ padding: 18 }}>
          <input
            className="input-apple"
            placeholder="Routine name (e.g. Push A)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {items.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6E6E76', margin: 0 }}>Add exercises from the right to build a routine.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => {
                const ex = EXERCISE_BY_ID.get(it.exerciseId)
                if (!ex) return null
                return (
                  <div key={it.exerciseId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, color: '#EEEEF2', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                    <input type="number" min={1} value={it.sets} onChange={(e) => patch(it.exerciseId, 'sets', Number(e.target.value))} style={numStyle} aria-label="sets" />
                    <span style={{ color: '#52525A', fontSize: 12 }}>×</span>
                    <input type="number" min={1} value={it.reps} onChange={(e) => patch(it.exerciseId, 'reps', Number(e.target.value))} style={numStyle} aria-label="reps" />
                    <button onClick={() => remove(it.exerciseId)} style={xStyle} aria-label="remove">✕</button>
                  </div>
                )
              })}
            </div>
          )}
          {error && <p style={{ color: '#ff8168', fontSize: 12, margin: '10px 0 0' }}>{error}</p>}
          <button className="btn-primary" onClick={() => void save()} disabled={saving} style={{ width: '100%', marginTop: 14 }}>
            {saving ? 'Saving…' : 'Save routine'}
          </button>
        </div>

        {routines.length > 0 && (
          <div className="card" style={{ padding: 18 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Saved routines</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routines.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => load(r)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: '#EEEEF2', fontSize: 13, cursor: 'pointer', padding: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name} <span style={{ color: '#52525A', fontSize: 11 }}>· {r.exercises.length} ex</span>
                  </button>
                  <button onClick={() => void del(r.id)} style={xStyle} aria-label="delete routine">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: exercise picker */}
      <div className="card" style={{ padding: 18, alignSelf: 'start' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="btn-motion"
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                border: '1px solid ' + (cat === c ? 'rgba(255,129,104,0.4)' : 'rgba(255,255,255,0.1)'),
                background: cat === c ? 'rgba(255,129,104,0.14)' : 'transparent',
                color: cat === c ? '#ff8168' : '#9E9EA6',
              }}
            >
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <input className="input-apple" placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 520, overflowY: 'auto' }}>
          {filtered.map((ex) => {
            const added = inRoutine.has(ex.id)
            return (
              <button
                key={ex.id}
                onClick={() => add(ex.id)}
                disabled={added}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '9px 12px', borderRadius: 10, cursor: added ? 'default' : 'pointer',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: added ? 'rgba(255,129,104,0.08)' : 'rgba(255,255,255,0.02)',
                  opacity: added ? 0.6 : 1,
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#EEEEF2', minWidth: 0 }}>{ex.name}</span>
                <span style={{ fontSize: 10, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ex.primary[0]}</span>
                <span style={{ color: added ? '#ff8168' : '#64f0aa', fontSize: 15, fontWeight: 700 }}>{added ? '✓' : '+'}</span>
              </button>
            )
          })}
          {filtered.length === 0 && <p style={{ fontSize: 13, color: '#6E6E76', padding: '12px 0' }}>No exercises match.</p>}
        </div>
      </div>
    </div>
  )
}

const numStyle: React.CSSProperties = {
  width: 42, padding: '4px 6px', borderRadius: 7, textAlign: 'center',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EEEEF2', fontSize: 12, outline: 'none',
}
const xStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6E6E76', cursor: 'pointer', fontSize: 12, padding: '2px 4px', flexShrink: 0,
}
