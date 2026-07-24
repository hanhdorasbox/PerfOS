'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

interface StrategyRecord {
  id: string
  mainObjective: string
  status: string
  createdAt: string
}

interface Props {
  strategies: StrategyRecord[]
}

export default function StrategyHistory({ strategies }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(strategies)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    // Optimistic remove
    setItems(prev => prev.filter(s => s.id !== id))
    setConfirmId(null)
    setDeleting(id)
    try {
      await fetch(`/api/fitness/strategy/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      // Restore on failure
      setItems(strategies)
    } finally {
      setDeleting(null)
    }
  }

  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#A1A1A6', marginBottom: 12 }}>
        Strategy History
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(s => (
          <div key={s.id} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F7', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.mainObjective}
                </div>
                <div style={{ fontSize: 11, color: '#6E6E73' }}>
                  {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  background: s.status === 'active' ? 'rgba(100, 240, 170,0.15)' : 'rgba(255,255,255,0.06)',
                  color: s.status === 'active' ? '#64f0aa' : '#A1A1A6',
                  border: `1px solid ${s.status === 'active' ? 'rgba(100, 240, 170,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  {s.status}
                </span>

                {confirmId === s.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#ffce53' }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="btn-motion"
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', background: 'rgba(255, 129, 104,0.15)',
                        border: '1px solid rgba(255, 129, 104,0.4)', color: '#ff8168',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {deleting === s.id ? <Spinner size={12} color="#ff8168" strokeWidth={2} /> : null}
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="btn-motion"
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12,
                        cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(s.id)}
                    className="btn-motion"
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12,
                      cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E73',
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
