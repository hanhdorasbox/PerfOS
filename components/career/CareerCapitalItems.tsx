'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CareerCapitalItem = {
  id: string
  category: string
  type: string
  title: string
  impact?: string | null
  date: Date | string
}

const INTERNAL_TYPES = ['visibility', 'initiative', 'collaboration', 'recognition']
const EXTERNAL_TYPES = ['portfolio', 'networking', 'thought_leadership']

const TYPE_ICONS: Record<string, string> = {
  visibility: '👁️',
  initiative: '🚀',
  collaboration: '🤝',
  recognition: '⭐',
  portfolio: '📂',
  networking: '🌐',
  thought_leadership: '✍️',
}

function ItemCard({ item, onDelete, isDeleting }: { item: CareerCapitalItem; onDelete: (id: string) => void; isDeleting: boolean }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        opacity: isDeleting ? 0.4 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[item.type] ?? '•'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
          {item.impact && (
            <div style={{ color: '#A1A1A6', fontSize: 11, marginTop: 3 }}>{item.impact}</div>
          )}
        </div>
        <button
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
          style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
          title="Delete"
        >✕</button>
      </div>
    </div>
  )
}

export default function CareerCapitalItems({
  items: initItems,
  userId,
}: {
  items: CareerCapitalItem[]
  userId: string
}) {
  const router = useRouter()
  const [items, setItems] = useState<CareerCapitalItem[]>(initItems)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: 'internal',
    type: 'visibility',
    title: '',
    impact: '',
  })

  const internal = items.filter(i => i.category === 'internal')
  const external = items.filter(i => i.category === 'external')

  const typeOptions = form.category === 'internal' ? INTERNAL_TYPES : EXTERNAL_TYPES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/career/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId }),
      })
      const data = await res.json() as CareerCapitalItem
      setItems(prev => [data, ...prev])
      setForm({ category: 'internal', type: 'visibility', title: '', impact: '' })
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteItem(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/career/items/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', margin: 0 }}>Career Capital Items</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'rgba(159,231,192,0.12)',
            border: '1px solid rgba(159,231,192,0.3)',
            borderRadius: 7,
            color: '#9FE7C0',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Item
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <select
            value={form.category}
            onChange={e => {
              const cat = e.target.value
              setForm(f => ({
                ...f,
                category: cat,
                type: cat === 'internal' ? 'visibility' : 'portfolio',
              }))
            }}
            style={inputStyle}
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            style={inputStyle}
          >
            {typeOptions.map(t => (
              <option key={t} value={t}>
                {TYPE_ICONS[t]} {t.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle}
          />
          <textarea
            placeholder="Impact description (optional)"
            value={form.impact}
            onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#9FE7C0',
                border: 'none',
                borderRadius: 7,
                color: '#1A1916',
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 7,
                color: '#6E6E73',
                padding: '7px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ color: '#6E6E73', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Internal Capital
          </div>
          {internal.length === 0 ? (
            <div style={{ color: '#6E6E73', fontSize: 12 }}>No internal items yet.</div>
          ) : (
            internal.map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} isDeleting={deleting === item.id} />)
          )}
        </div>
        <div>
          <div style={{ color: '#6E6E73', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            External Capital
          </div>
          {external.length === 0 ? (
            <div style={{ color: '#6E6E73', fontSize: 12 }}>No external items yet.</div>
          ) : (
            external.map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} isDeleting={deleting === item.id} />)
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  color: '#F5F5F7',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}
