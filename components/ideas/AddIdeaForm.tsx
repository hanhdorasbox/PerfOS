'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'

const DOMAINS = [
  'work_improvement', 'automation', 'product', 'content', 'research', 'project', 'other'
]

const EFFORTS = ['low', 'medium', 'high']

export default function AddIdeaForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    domain: '',
    effortEstimate: '',
    isTimeSensitive: false,
    isHighUpsideBet: false,
    possibleUpside: '',
  })

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', color: '#F5F5F7', fontSize: 13, width: '100%',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      })
      if (!res.ok) throw new Error('Failed')
      setForm({ title: '', description: '', domain: '', effortEstimate: '', isTimeSensitive: false, isHighUpsideBet: false, possibleUpside: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="What's the idea?"
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Domain</label>
          <select value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={inputStyle}>
            <option value="">None</option>
            {DOMAINS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Effort</label>
          <select value={form.effortEstimate} onChange={e => setForm(f => ({ ...f, effortEstimate: e.target.value }))} style={inputStyle}>
            <option value="">Unknown</option>
            {EFFORTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Description / Possible Upside</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe the idea and what upside it could create..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isTimeSensitive}
            onChange={e => setForm(f => ({ ...f, isTimeSensitive: e.target.checked }))}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ color: '#A1A1A6', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> Time sensitive</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isHighUpsideBet}
            onChange={e => setForm(f => ({ ...f, isHighUpsideBet: e.target.checked }))}
            style={{ width: 14, height: 14 }}
          />
          <span style={{ color: '#A1A1A6', fontSize: 13 }}>⭐ High-upside bet</span>
        </label>
      </div>

      {error && <p style={{ color: '#FF9B87', fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving || !form.title.trim()}
        style={{
          background: 'rgba(236,198,102,0.12)', border: '1px solid rgba(236,198,102,0.3)',
          color: '#ECC666', padding: '8px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Adding...' : '+ Add to Inbox'}
      </button>
    </form>
  )
}
