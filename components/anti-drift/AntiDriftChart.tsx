'use client'

interface WorkItem {
  id: string
  category: string
  domain: string
  completedAt: string
  weekStart: string
  title: string
  impact?: string | null
}

interface Props {
  workItems: WorkItem[]
}

const CATEGORIES = [
  { key: 'advancement', label: 'Advancement', color: '#7FD5AA', description: 'Creates lasting value' },
  { key: 'maintenance', label: 'Maintenance', color: '#80BDFF', description: 'Keeps things running' },
  { key: 'reactive', label: 'Reactive', color: '#ECC666', description: 'Response to external demands' },
  { key: 'busywork', label: 'Busywork', color: '#FF9B87', description: 'Low-leverage activity' },
]

export default function AntiDriftChart({ workItems }: Props) {
  const total = workItems.length || 1
  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = workItems.filter(w => w.category === cat.key).length
    return acc
  }, {} as Record<string, number>)

  const advancementPct = Math.round((counts['advancement'] / total) * 100)

  // Recent week items for the "What changed permanently" prompt
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeekAdvancement = workItems.filter(
    w => w.category === 'advancement' && new Date(w.completedAt) >= weekAgo
  )

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', marginBottom: 4 }}>
        Effort Distribution — Last 30 Days
      </h2>
      <p style={{ fontSize: 12, color: '#A1A1A6', marginBottom: 16 }}>
        {total} work items logged
      </p>

      {advancementPct < 30 && total > 1 && (
        <div style={{
          background: 'rgba(255,155,135,0.12)',
          border: '1px solid rgba(255,155,135,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: '#FF9B87',
          fontWeight: 600,
        }}>
          Less than 30% of your effort this period created lasting advancement.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CATEGORIES.map(cat => {
          const count = counts[cat.key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={cat.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#F5F5F7', fontWeight: 600 }}>{cat.label}</span>
                  <span style={{ fontSize: 11, color: '#A1A1A6' }}>{cat.description}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#A1A1A6' }}>{count} items</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: cat.color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: cat.color,
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 20,
        padding: '14px 16px',
        background: 'rgba(127,213,170,0.06)',
        border: '1px solid rgba(127,213,170,0.15)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#7FD5AA', marginBottom: 8 }}>
          What changed permanently this week?
        </div>
        {thisWeekAdvancement.length === 0 ? (
          <p style={{ fontSize: 12, color: '#A1A1A6', fontStyle: 'italic' }}>
            No advancement items logged this week. Log work items to track durable progress.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {thisWeekAdvancement.slice(0, 5).map(item => (
              <li key={item.id} style={{ fontSize: 13, color: '#A1A1A6', marginBottom: 4 }}>
                <span style={{ color: '#F5F5F7' }}>{item.title}</span>
                {item.impact && (
                  <span style={{ color: '#7FD5AA', marginLeft: 6, fontSize: 11 }}>→ {item.impact}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
