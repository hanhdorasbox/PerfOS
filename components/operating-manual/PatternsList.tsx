'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import InsightCard from '@/components/ui/InsightCard'
import InsightCardList, { type InsightListItem } from '@/components/ui/InsightCardList'
import { sevColor, confidenceToLevel } from '@/lib/insight/severity'

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
  patterns: Pattern[]
}

// Split a stored evidence/implication blob into bullet strings (falls back to
// the whole paragraph if it isn't list-shaped).
function toBullets(text: string | null): string[] {
  if (!text) return []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => /^[•\-*]\s+/.test(l))
  if (bullets.length > 0) return bullets.map((b) => b.replace(/^[•\-*]\s+/, ''))
  return [text.trim()]
}

export default function PatternsList({ domainGroups }: { domainGroups: DomainGroup[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  async function deletePattern(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/operating-manual/patterns?id=${id}`, { method: 'DELETE' })
      setDeletedIds((prev) => new Set([...prev, id]))
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const items: InsightListItem[] = domainGroups.flatMap(({ displayDomain, patterns }) =>
    patterns
      .filter((p) => !deletedIds.has(p.id))
      .map((p) => ({
        id: p.id,
        tag: displayDomain,
        node: (
          <InsightCard
            severityColor={sevColor(confidenceToLevel(p.confidence))}
            severityLabel={`${p.confidence}/5`}
            dots={{ filled: p.confidence, total: 5 }}
            title={p.pattern}
            domainTag={displayDomain}
            leftLabel="Evidence"
            leftItems={toBullets(p.evidence)}
            rightLabel="Planning Impact"
            rightItems={toBullets(p.implication)}
            actions={
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => deletePattern(p.id)}
                  disabled={deletingId === p.id}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 8,
                    background: 'none', border: '1px solid var(--border-strong)',
                    color: 'var(--text-muted)', cursor: deletingId === p.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deletingId === p.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            }
          />
        ),
      })),
  )

  return <InsightCardList items={items} />
}
