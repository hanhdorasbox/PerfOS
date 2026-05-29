'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Milestone {
  id: string
  title: string
  weight: number
  completed: boolean
  dueDate?: Date | null
}

export default function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toggling, setToggling] = useState<string | null>(null)

  async function toggle(id: string) {
    setToggling(id)
    await fetch(`/api/milestones/${id}`, { method: 'PATCH' })
    startTransition(() => router.refresh())
    setToggling(null)
  }

  return (
    <div>
      {milestones.map(m => (
        <div key={m.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <button
            onClick={() => toggle(m.id)}
            disabled={toggling === m.id}
            style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: m.completed ? '2px solid #7FD5AA' : '2px solid rgba(255,255,255,0.2)',
              background: m.completed ? 'rgba(127,213,170,0.15)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#7FD5AA',
              transition: 'all 0.15s',
              opacity: toggling === m.id ? 0.5 : 1,
            }}
          >
            {m.completed ? '✓' : ''}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '13px', fontWeight: 600,
              color: m.completed ? '#6E6E73' : '#F5F5F7',
              textDecoration: m.completed ? 'line-through' : 'none',
            }}>
              {m.title}
            </div>
            {m.dueDate && (
              <div style={{ fontSize: '11px', color: '#6E6E73', marginTop: '2px' }}>
                Due: {new Date(m.dueDate).toLocaleDateString('cs-CZ')}
              </div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#6E6E73', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '999px' }}>
            {m.weight}%
          </span>
        </div>
      ))}
    </div>
  )
}
