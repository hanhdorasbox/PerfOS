'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Pattern {
  id: string
  domain: string
  pattern: string
  evidence: string | null
  confidence: number
  implication: string | null
  active: boolean
}

interface DomainGroup {
  displayDomain: string
  color: string
  icon: string
  patterns: Pattern[]
}

function ConfidenceDots({ confidence }: { confidence: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: i <= confidence ? '#B8A4FF' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  )
}

function BulletText({ text, color = '#A1A1A6', bulletColor = '#6E6E73' }: { text: string; color?: string; bulletColor?: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const bullets = lines.filter(l => l.startsWith('• ') || l.startsWith('- ') || l.startsWith('* '))
  if (bullets.length === 0) {
    return <span style={{ color, fontSize: 13, lineHeight: 1.55 }}>{text}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: bulletColor, flexShrink: 0, fontSize: 12, marginTop: 1, fontWeight: 700, lineHeight: 1 }}>•</span>
          <span style={{ color, fontSize: 13, lineHeight: 1.55 }}>{b.replace(/^[•\-*]\s+/, '')}</span>
        </div>
      ))}
    </div>
  )
}

export default function PatternsList({ domainGroups }: { domainGroups: DomainGroup[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Track deleted IDs for optimistic UI
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  async function deletePattern(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/operating-manual/patterns?id=${id}`, { method: 'DELETE' })
      setDeletedIds(prev => new Set([...prev, id]))
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {domainGroups.map(({ displayDomain, color, icon, patterns }) => {
        const visiblePatterns = patterns.filter(p => !deletedIds.has(p.id))
        if (visiblePatterns.length === 0) return null
        return (
          <div key={displayDomain} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{
                background: `${color}18`,
                color,
                border: `1px solid ${color}35`,
                padding: '4px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: 700,
              }}>
                {icon} {displayDomain}
              </span>
              <span style={{ color: '#6E6E73', fontSize: 12 }}>
                {visiblePatterns.length} pattern{visiblePatterns.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visiblePatterns.map(p => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    opacity: deletingId === p.id ? 0.4 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 16, lineHeight: 1.5 }}>
                      {p.pattern}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <ConfidenceDots confidence={p.confidence} />
                      <button
                        onClick={() => deletePattern(p.id)}
                        disabled={deletingId === p.id}
                        style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                        title="Delete pattern"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {p.evidence && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 5 }}>Evidence</div>
                      <BulletText text={p.evidence} color="#A1A1A6" bulletColor="#6E6E73" />
                    </div>
                  )}
                  {p.implication && (
                    <div style={{
                      background: `${color}08`,
                      border: `1px solid ${color}22`,
                      borderRadius: 10, padding: '8px 12px',
                    }}>
                      <div style={{ color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                        Planning Impact
                      </div>
                      <BulletText text={p.implication} color="#F5F5F7" bulletColor={color} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
