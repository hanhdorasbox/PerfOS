'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Goal } from '@prisma/client'

interface Props {
  userId: string
  goals: Goal[]
}

export default function AddCapabilityGoalForm({ userId, goals }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generateRoadmap, setGenerateRoadmap] = useState(true)

  const [form, setForm] = useState({
    title: '',
    capabilityStatement: '',
    whyItMatters: '',
    linkedGoalId: '',
    startingLevel: 1,
    targetLevel: 4,
    evidenceOfMastery: '',
    finalOutput: '',
  })

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', color: '#FAFAFA', fontSize: 13, width: '100%',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.capabilityStatement.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/learning/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      if (generateRoadmap && data.goal?.id) {
        await fetch(`/api/learning/goals/${data.goal.id}/roadmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId: data.goal.id }),
        })
      }

      setForm({
        title: '', capabilityStatement: '', whyItMatters: '', linkedGoalId: '',
        startingLevel: 1, targetLevel: 4, evidenceOfMastery: '', finalOutput: '',
      })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Goal Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Master data storytelling"
            style={inputStyle}
            required
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Capability Statement *</label>
          <input
            value={form.capabilityStatement}
            onChange={e => setForm(f => ({ ...f, capabilityStatement: e.target.value }))}
            placeholder="I will be able to... (specific capability you'll have)"
            style={inputStyle}
            required
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Why It Matters</label>
          <input
            value={form.whyItMatters}
            onChange={e => setForm(f => ({ ...f, whyItMatters: e.target.value }))}
            placeholder="How does this capability serve your goals?"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Starting Level (1-5)</label>
          <input
            type="number" min={1} max={5}
            value={form.startingLevel}
            onChange={e => setForm(f => ({ ...f, startingLevel: parseInt(e.target.value) || 1 }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Target Level (1-5)</label>
          <input
            type="number" min={1} max={5}
            value={form.targetLevel}
            onChange={e => setForm(f => ({ ...f, targetLevel: parseInt(e.target.value) || 4 }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Evidence of Mastery</label>
          <input
            value={form.evidenceOfMastery}
            onChange={e => setForm(f => ({ ...f, evidenceOfMastery: e.target.value }))}
            placeholder="What would prove you've mastered this?"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Final Output</label>
          <input
            value={form.finalOutput}
            onChange={e => setForm(f => ({ ...f, finalOutput: e.target.value }))}
            placeholder="What will exist when this is done?"
            style={inputStyle}
          />
        </div>
        {goals.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Link to Goal (optional)</label>
            <select
              value={form.linkedGoalId}
              onChange={e => setForm(f => ({ ...f, linkedGoalId: e.target.value }))}
              style={inputStyle}
            >
              <option value="">None</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={generateRoadmap}
          onChange={e => setGenerateRoadmap(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ color: '#B8B6B0', fontSize: 13 }}>Generate learning roadmap with AI (creates milestones automatically)</span>
      </label>

      {error && <p style={{ color: '#FF6B6B', fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving || !form.title.trim() || !form.capabilityStatement.trim()}
        style={{
          background: saving ? 'rgba(180,167,229,0.1)' : 'rgba(180,167,229,0.15)',
          border: '1px solid rgba(180,167,229,0.4)',
          color: '#B4A7E5', padding: '8px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {saving ? (generateRoadmap ? '⏳ Creating + generating roadmap...' : 'Creating...') : '+ Add Capability Goal'}
      </button>
    </form>
  )
}
