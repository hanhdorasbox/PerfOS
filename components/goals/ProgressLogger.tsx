'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function ProgressLogger({ goalId, unit, trackingType }: { goalId: string; unit?: string | null; trackingType: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  async function save() {
    if (!value.trim()) return
    setSaving(true)
    await fetch(`/api/goals/${goalId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: parseFloat(value), note: note.trim() || null }),
    })
    setValue('')
    setNote('')
    setOpen(false)
    setSaving(false)
    startTransition(() => router.refresh())
  }

  const placeholder = trackingType === 'QUANTITATIVE'
    ? `New value${unit ? ` (${unit})` : ''}`
    : 'Progress % (0–100)'

  return (
    <div style={{ marginTop: 16 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'rgba(201,184,255,0.08)', border: '1px dashed rgba(201,184,255,0.3)',
            color: '#C9B8FF', cursor: 'pointer',
          }}
        >
          + Log Progress
        </button>
      ) : (
        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(201,184,255,0.2)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
            Log Progress Update
          </div>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#F5F5F7', fontSize: 14, fontWeight: 600, outline: 'none',
            }}
          />
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What did you work on? (optional)"
            rows={2}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#A1A1A6', fontSize: 12, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              style={{
                flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#C9B8FF', color: '#050506', border: 'none', cursor: 'pointer',
                opacity: saving || !value.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#A1A1A6', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
