'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import InfoHint from '@/components/invest/InfoHint'
import {
  CHECKLIST_ITEMS,
  CHECKLIST_GROUPS,
  normalizeChecklist,
  type ChecklistState,
  type ChecklistStatus,
} from '@/lib/invest/valuation/checklist'

const STATUS_META: Record<
  Exclude<ChecklistStatus, 'pending'>,
  { label: string; symbol: string; color: string; bg: string; border: string }
> = {
  pass: { label: 'Pass', symbol: '✓', color: 'var(--fin-gain, #2dc979)', bg: 'var(--fin-gain-bg, rgba(45, 201, 121,0.12))', border: 'var(--fin-gain-border, rgba(45, 201, 121,0.4))' },
  concern: { label: 'Concern', symbol: '~', color: 'var(--fin-warn, #ebb63f)', bg: 'rgba(235, 182, 63,0.12)', border: 'var(--fin-warn-border, rgba(235, 182, 63,0.4))' },
  fail: { label: 'Fail', symbol: '✕', color: 'var(--fin-loss, #e84b4b)', bg: 'var(--fin-loss-bg, rgba(232, 75, 75,0.12))', border: 'var(--fin-loss-border, rgba(232, 75, 75,0.4))' },
}

export default function DueDiligenceChecklist({
  analysisId,
  initial,
}: {
  analysisId: string
  initial: ChecklistState
}) {
  const [entries, setEntries] = useState<ChecklistState>(() => normalizeChecklist(initial))
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { pass: 0, concern: 0, fail: 0, pending: 0 }
    for (const item of CHECKLIST_ITEMS) c[entries[item.key]?.status ?? 'pending']++
    return c
  }, [entries])

  async function persist(next: ChecklistState) {
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysisId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Save failed (${res.status})`)
    }
  }

  function setStatus(key: string, status: ChecklistStatus) {
    setEntries((prev) => {
      const current = prev[key]?.status
      const next = {
        ...prev,
        [key]: { status: current === status ? 'pending' : status, notes: prev[key]?.notes ?? '' },
      }
      void persist(next)
      return next
    })
  }

  function setNotesLocal(key: string, notes: string) {
    setEntries((prev) => ({ ...prev, [key]: { status: prev[key]?.status ?? 'pending', notes } }))
  }

  function saveNotes() {
    void persist(entries)
  }

  async function runAi() {
    setAiLoading(true)
    setError(null)
    setAiNote(null)
    try {
      const res = await fetch(`/api/invest/analyses/${analysisId}/checklist/ai`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? `AI request failed (${res.status})`)
        return
      }
      const suggestion = normalizeChecklist(data.checklist)
      // Fill only items the user hasn't written notes for yet; keep her edits.
      setEntries((prev) => {
        const next: ChecklistState = { ...prev }
        let filled = 0
        for (const item of CHECKLIST_ITEMS) {
          const mine = prev[item.key]
          const hasMyInput = (mine?.notes ?? '').trim() !== '' || (mine?.status ?? 'pending') !== 'pending'
          if (!hasMyInput && suggestion[item.key]) {
            next[item.key] = suggestion[item.key]
            filled++
          }
        }
        void persist(next)
        setAiNote(
          filled > 0
            ? `AI drafted ${filled} item${filled === 1 ? '' : 's'} — review and edit; these are a starting point, not advice.`
            : 'Every item already has your input — nothing was overwritten.',
        )
        return next
      })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fin-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <div className="fin-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Due-diligence checklist
          <InfoHint text="The qualitative and cross-check factors to weigh before buying — fair value alone isn't enough. Mark each Pass / Concern / Fail and jot why. 'Analyze with AI' drafts a first pass you then verify and edit." />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="fin-subtle" style={{ fontSize: 12, display: 'flex', gap: 10 }}>
            <span style={{ color: STATUS_META.pass.color }}>✓ {counts.pass}</span>
            <span style={{ color: STATUS_META.concern.color }}>~ {counts.concern}</span>
            <span style={{ color: STATUS_META.fail.color }}>✕ {counts.fail}</span>
            <span className="fin-muted">• {counts.pending} left</span>
          </span>
          <button
            type="button"
            className="fin-btn"
            onClick={() => void runAi()}
            disabled={aiLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={13} />
            {aiLoading ? 'Analyzing…' : 'Analyze with AI'}
          </button>
        </div>
      </div>

      {aiNote && <p className="fin-subtle" style={{ margin: '0 0 10px', fontSize: 12 }}>{aiNote}</p>}
      {error && <p className="fin-loss" style={{ margin: '0 0 10px', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {CHECKLIST_GROUPS.map((group) => (
          <div key={group}>
            <div
              className="fin-subtle"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}
            >
              {group}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CHECKLIST_ITEMS.filter((i) => i.group === group).map((item) => {
                const entry = entries[item.key] ?? { status: 'pending' as ChecklistStatus, notes: '' }
                return (
                  <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {item.label}
                        <InfoHint text={item.hint} />
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                        {(['pass', 'concern', 'fail'] as const).map((s) => {
                          const meta = STATUS_META[s]
                          const active = entry.status === s
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStatus(item.key, s)}
                              aria-pressed={active}
                              title={meta.label}
                              style={{
                                minWidth: 34,
                                padding: '3px 9px',
                                borderRadius: 7,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: active ? meta.color : 'var(--fin-text-2, #9A9AA3)',
                                background: active ? meta.bg : 'transparent',
                                border: `1px solid ${active ? meta.border : 'var(--fin-border-strong, rgba(255,255,255,0.14))'}`,
                              }}
                            >
                              {meta.symbol} {meta.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <textarea
                      className="fin-input"
                      style={{ minHeight: 48, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                      placeholder="Your take — evidence, numbers, what to verify…"
                      value={entry.notes}
                      onChange={(e) => setNotesLocal(item.key, e.target.value)}
                      onBlur={saveNotes}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
