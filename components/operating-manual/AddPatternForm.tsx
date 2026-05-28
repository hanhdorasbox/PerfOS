'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const domains = [
  { value: 'planning_execution', label: 'Planning & Execution' },
  { value: 'fitness',            label: 'Fitness'              },
  { value: 'meals',              label: 'Meals'                },
  { value: 'learning',           label: 'Learning'             },
]

export default function AddPatternForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    domain: 'planning_execution',
    pattern: '',
    evidence: '',
    confidence: 3,
    implication: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pattern.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/operating-manual/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setForm({ domain: 'planning_execution', pattern: '', evidence: '', confidence: 3, implication: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', color: '#F5F5F7', fontSize: 13, width: '100%',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Domain</label>
          <select
            value={form.domain}
            onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
            style={inputStyle}
          >
            {domains.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Confidence (1-5)</label>
          <input
            type="number" min={1} max={5}
            value={form.confidence}
            onChange={e => setForm(f => ({ ...f, confidence: parseInt(e.target.value) || 3 }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Pattern *</label>
        <textarea
          value={form.pattern}
          onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
          placeholder="Describe the behavioral pattern you've observed..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
          required
        />
      </div>

      <div>
        <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Evidence</label>
        <input
          type="text"
          value={form.evidence}
          onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
          placeholder="What data or experience supports this?"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Implication</label>
        <input
          type="text"
          value={form.implication}
          onChange={e => setForm(f => ({ ...f, implication: e.target.value }))}
          placeholder="How should this change future planning?"
          style={inputStyle}
        />
      </div>

      {error && <p style={{ color: '#FF453A', fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving || !form.pattern.trim()}
        style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#F5F5F7', padding: '8px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Saving...' : 'Add Observation'}
      </button>
    </form>
  )
}
