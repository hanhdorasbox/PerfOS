'use client'
import { useState } from 'react'

interface ProteinLog { id: string; amount: number; date: string }

export default function WorkoutTracker({
  proteinToday,
  proteinLogs: initProteinLogs,
  proteinTarget = 150,
  userId,
}: {
  proteinToday: number
  proteinLogs: ProteinLog[]
  proteinTarget?: number
  userId: string
}) {
  const [proteinLogs, setProteinLogs] = useState<ProteinLog[]>(initProteinLogs)
  const [protein, setProtein] = useState('')
  const [deletingProtein, setDeletingProtein] = useState<string | null>(null)
  const [proteinMsg, setProteinMsg] = useState('')

  const proteinTotal = proteinLogs.reduce((s, p) => s + p.amount, 0)

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

  return (
    <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>Protein Today</div>
        <div style={{ fontSize: '42px', fontWeight: 800, color: '#F5F5F7', lineHeight: 1, marginBottom: '4px' }}>
          {proteinTotal}<span style={{ fontSize: '20px', color: '#6E6E73' }}>/ {proteinTarget}g</span>
        </div>
        <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${Math.min(100, proteinTotal / proteinTarget * 100)}%`, background: '#7FD5AA', borderRadius: '3px' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[25, 30, 40, 50].map(g => (
            <button
              key={g}
              onClick={() => addProtein(g)}
              style={{ padding: '7px 14px', borderRadius: '999px', background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)', color: '#7FD5AA', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >+{g}g</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={protein}
            onChange={e => setProtein(e.target.value)}
            placeholder="Custom g…"
            type="number"
            style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F5F7', fontSize: '12px', outline: 'none' }}
          />
          <button
            onClick={() => { if (+protein > 0) { addProtein(+protein); setProtein('') } }}
            style={{ padding: '7px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6', cursor: 'pointer', fontSize: '12px' }}
          >+Add</button>
        </div>
        {proteinMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: '#7FD5AA' }}>{proteinMsg}</div>}

        {/* Today's entries */}
        {proteinLogs.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '6px' }}>Today&apos;s entries</div>
            {proteinLogs.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 0', fontSize: 12,
                  opacity: deletingProtein === p.id ? 0.4 : 1, transition: 'opacity 0.15s ease',
                }}
              >
                <span style={{ color: '#7FD5AA', fontWeight: 600 }}>+{p.amount}g</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#6E6E73', fontSize: 11 }}>
                    {new Date(p.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => deleteProtein(p.id)}
                    disabled={deletingProtein === p.id}
                    style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}
                    title="Delete"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
