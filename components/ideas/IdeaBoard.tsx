'use client'
import type { Idea } from '@prisma/client'
import IdeaCard from './IdeaCard'

const COLUMNS: { status: string; label: string; color: string }[] = [
  { status: 'inbox', label: 'Inbox', color: '#F3D58A' },
  { status: 'worth_exploring', label: 'Worth Exploring', color: '#9FE7C0' },
  { status: 'hold', label: 'Hold', color: '#6E6E73' },
  { status: 'convert_to_goal', label: 'Convert / Archive', color: '#C9B8FF' },
]

interface Props {
  ideas: Idea[]
  userId: string
}

export default function IdeaBoard({ ideas }: Props) {
  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = ideas.filter(i => i.status === col.status)
    return acc
  }, {} as Record<string, Idea[]>)

  // Also add archived to convert column
  const archivedIdeas = ideas.filter(i => i.status === 'archived')
  if (byStatus['convert_to_goal']) {
    byStatus['convert_to_goal'] = [...byStatus['convert_to_goal'], ...archivedIdeas]
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {COLUMNS.map(col => {
        const colIdeas = byStatus[col.status] || []
        return (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
              <span style={{ color: col.color, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {col.label}
              </span>
              <span style={{ color: '#6E6E73', fontSize: 12 }}>{colIdeas.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120 }}>
              {colIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
              {colIdeas.length === 0 && (
                <div style={{
                  border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12,
                  padding: '20px 12px', textAlign: 'center',
                }}>
                  <p style={{ color: '#444', fontSize: 12 }}>Empty</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
