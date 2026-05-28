'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ProofOfWork = {
  id: string
  title: string
  type: string
  impact?: string | null
  reusability: number
  monetizable: boolean
  isPublic: boolean
  completedAt: Date | string
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  project: { bg: 'rgba(59,130,246,0.15)', color: '#0A84FF' },
  automation: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  portfolio: { bg: 'rgba(16,185,129,0.15)', color: '#34D399' },
  public_work: { bg: 'rgba(20,184,166,0.15)', color: '#2DD4BF' },
  certification: { bg: 'rgba(245,158,11,0.15)', color: '#FBBF24' },
  case_study: { bg: 'rgba(249,115,22,0.15)', color: '#FF9F0A' },
}

const POW_TYPES = ['project', 'automation', 'case_study', 'portfolio', 'certification', 'public_work']

function Stars({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 12, color: i <= value ? '#FFD60A' : 'rgba(242,192,99,0.2)' }}>★</span>
      ))}
    </div>
  )
}

export default function ProofOfWorkTracker({
  proofOfWork: initProofOfWork,
  userId,
}: {
  proofOfWork: ProofOfWork[]
  userId: string
}) {
  const router = useRouter()
  const [proofOfWork, setProofOfWork] = useState<ProofOfWork[]>(initProofOfWork)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    type: 'project',
    impact: '',
    reusability: 3,
    monetizable: false,
    isPublic: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/career/proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId }),
      })
      const data = await res.json() as ProofOfWork
      setProofOfWork(prev => [data, ...prev])
      setForm({ title: '', type: 'project', impact: '', reusability: 3, monetizable: false, isPublic: false })
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function deletePow(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/career/proof/${id}`, { method: 'DELETE' })
      setProofOfWork(prev => prev.filter(p => p.id !== id))
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', margin: 0 }}>Proof of Work</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'rgba(242,192,99,0.12)',
            border: '1px solid rgba(242,192,99,0.3)',
            borderRadius: 7,
            color: '#FFD60A',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Asset
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
          <input
            required
            placeholder="Asset title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle}
          />
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            style={inputStyle}
          >
            {POW_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <textarea
            placeholder="Impact description (optional)"
            value={form.impact}
            onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div>
            <label style={{ color: '#A1A1A6', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Reusability: {form.reusability}/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.reusability}
              onChange={e => setForm(f => ({ ...f, reusability: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#FFD60A' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A1A1A6', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.monetizable}
                onChange={e => setForm(f => ({ ...f, monetizable: e.target.checked }))}
                style={{ accentColor: '#30D158' }}
              />
              Monetizable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A1A1A6', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
                style={{ accentColor: '#30D158' }}
              />
              Public
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#FFD60A',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proofOfWork.map(pow => {
          const tc = TYPE_COLORS[pow.type] ?? { bg: 'rgba(255,255,255,0.08)', color: '#A1A1A6' }
          return (
            <div
              key={pow.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '12px 14px',
                opacity: deleting === pow.id ? 0.4 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{pow.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ background: tc.bg, color: tc.color, fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {pow.type.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => deletePow(pow.id)}
                    disabled={deleting === pow.id}
                    style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                    title="Delete"
                  >✕</button>
                </div>
              </div>
              {pow.impact && (
                <div style={{ color: '#A1A1A6', fontSize: 12, marginBottom: 8 }}>{pow.impact}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Stars value={pow.reusability} />
                <span style={{ color: '#6E6E73', fontSize: 11 }}>reusability</span>
                {pow.monetizable && (
                  <span
                    style={{
                      background: 'rgba(107,227,164,0.12)',
                      color: '#30D158',
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    Monetizable
                  </span>
                )}
                {pow.isPublic && (
                  <span
                    style={{
                      background: 'rgba(96,165,250,0.12)',
                      color: '#0A84FF',
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    Public
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {proofOfWork.length === 0 && (
          <div style={{ color: '#6E6E73', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No proof-of-work assets yet. Add your first deliverable.
          </div>
        )}
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
