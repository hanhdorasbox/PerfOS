'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FoodPreference {
  id: string
  type: string
  food: string
  notes?: string | null
}

interface Props {
  preferences: FoodPreference[]
  userId: string
}

const PREF_TYPES = ['dislike', 'allergy', 'preference', 'favorite']
const PREF_COLORS: Record<string, string> = {
  dislike: '#FF6B6B',
  allergy: '#FF6B6B',
  preference: '#60A5FA',
  favorite: '#6BE3A4',
}

export default function FoodPreferencesEditor({ preferences, userId }: Props) {
  const router = useRouter()
  const [food, setFood] = useState('')
  const [type, setType] = useState('dislike')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!food.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/meals/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, food, type, notes: notes || null }),
      })
      if (!res.ok) throw new Error('Failed')
      setFood('')
      setNotes('')
      router.refresh()
    } catch {
      setError('Failed to add preference.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/meals/preferences?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>
          Food Preferences
          <span style={{ fontSize: 12, fontWeight: 400, color: '#B8B6B0', marginLeft: 8 }}>({preferences.length} items)</span>
        </h2>
        <span style={{ fontSize: 12, color: '#B8B6B0' }}>{expanded ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Current preferences */}
          {preferences.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {preferences.map(pref => (
                  <div key={pref.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px',
                    background: `${PREF_COLORS[pref.type]}15`,
                    border: `1px solid ${PREF_COLORS[pref.type]}30`,
                    borderRadius: 99,
                    fontSize: 12,
                  }}>
                    <span style={{ color: PREF_COLORS[pref.type], fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{pref.type}</span>
                    <span style={{ color: '#FAFAFA' }}>{pref.food}</span>
                    {pref.notes && <span style={{ color: '#B8B6B0', fontSize: 10 }}>· {pref.notes}</span>}
                    <button
                      onClick={() => handleDelete(pref.id)}
                      style={{ background: 'none', border: 'none', color: '#B8B6B0', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add form */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input
              placeholder="Food item"
              value={food}
              onChange={e => setFood(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#FAFAFA', fontSize: 13, flex: 1, minWidth: 120 }}
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{ background: '#0d0d0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#FAFAFA', fontSize: 13 }}
            >
              {PREF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#FAFAFA', fontSize: 13, flex: 1, minWidth: 120 }}
            />
            <button
              type="submit"
              disabled={loading || !food.trim()}
              style={{ background: 'rgba(180,167,229,0.15)', border: '1px solid rgba(180,167,229,0.3)', color: '#B4A7E5', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Add
            </button>
          </form>
          {error && <div style={{ fontSize: 12, color: '#FF6B6B', marginTop: 6 }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
