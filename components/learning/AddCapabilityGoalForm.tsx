'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Goal } from '@prisma/client'

interface Props {
  userId: string
  goals: Goal[]
}

const roadmapTypes = [
  { value: 'skill', label: '🧠 Skill', desc: 'Master a specific skill' },
  { value: 'career', label: '🚀 Career', desc: 'Career advancement' },
  { value: 'school', label: '🎓 School', desc: 'Academic learning' },
  { value: 'portfolio', label: '🖼️ Portfolio', desc: 'Build a portfolio piece' },
  { value: 'certification', label: '📜 Cert', desc: 'Earn a certification' },
  { value: 'project', label: '🔧 Project', desc: 'Complete a project' },
  { value: 'tool', label: '⚙️ Tool', desc: 'Master a tool or software' },
  { value: 'exam', label: '📝 Exam', desc: 'Prepare for an exam' },
]

export default function AddCapabilityGoalForm({ userId, goals }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
    roadmapType: 'skill',
    deadline: '',
    weeklyHours: '',
    detailLevel: 'standard',
  })

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', color: '#FAFAFA', fontSize: 13, width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', display: 'block', marginBottom: 6,
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
        body: JSON.stringify({
          userId,
          ...form,
          weeklyHours: form.weeklyHours ? parseFloat(form.weeklyHours) : null,
          deadline: form.deadline || null,
        }),
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
        roadmapType: 'skill', deadline: '', weeklyHours: '', detailLevel: 'standard',
      })
      setOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.3)',
          color: '#B4A7E5', padding: '9px 20px', borderRadius: 9,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        + New Learning Roadmap
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#B4A7E5', fontSize: 14, fontWeight: 600 }}>New Learning Roadmap</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 18 }}
        >✕</button>
      </div>

      {/* Roadmap Type selector */}
      <div>
        <label style={labelStyle}>Roadmap Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {roadmapTypes.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, roadmapType: t.value }))}
              title={t.desc}
              style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: form.roadmapType === t.value ? 'rgba(180,167,229,0.15)' : 'rgba(255,255,255,0.04)',
                border: form.roadmapType === t.value ? '1px solid rgba(180,167,229,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: form.roadmapType === t.value ? '#B4A7E5' : '#76746E',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Core fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Goal Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Master data storytelling"
            style={inputStyle}
            required
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Capability Statement *</label>
          <input
            value={form.capabilityStatement}
            onChange={e => setForm(f => ({ ...f, capabilityStatement: e.target.value }))}
            placeholder="I will be able to… (specific, concrete outcome)"
            style={inputStyle}
            required
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Why It Matters</label>
          <input
            value={form.whyItMatters}
            onChange={e => setForm(f => ({ ...f, whyItMatters: e.target.value }))}
            placeholder="How does this serve your bigger goals?"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Final Output</label>
          <input
            value={form.finalOutput}
            onChange={e => setForm(f => ({ ...f, finalOutput: e.target.value }))}
            placeholder="What will exist when done?"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Evidence of Mastery</label>
          <input
            value={form.evidenceOfMastery}
            onChange={e => setForm(f => ({ ...f, evidenceOfMastery: e.target.value }))}
            placeholder="What proves you've mastered this?"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Starting Level (1-5)</label>
          <input
            type="number" min={1} max={5}
            value={form.startingLevel}
            onChange={e => setForm(f => ({ ...f, startingLevel: parseInt(e.target.value) || 1 }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Target Level (1-5)</label>
          <input
            type="number" min={1} max={5}
            value={form.targetLevel}
            onChange={e => setForm(f => ({ ...f, targetLevel: parseInt(e.target.value) || 4 }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Weekly Hours Available</label>
          <input
            type="number" step="0.5" min="0.5" max="40"
            value={form.weeklyHours}
            onChange={e => setForm(f => ({ ...f, weeklyHours: e.target.value }))}
            placeholder="e.g. 5"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Deadline (optional)</label>
          <input
            type="date"
            value={form.deadline}
            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Detail level */}
      <div>
        <label style={labelStyle}>Detail Level</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, detailLevel: 'standard' }))}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: form.detailLevel === 'standard' ? 'rgba(180,167,229,0.12)' : 'rgba(255,255,255,0.03)',
              border: form.detailLevel === 'standard' ? '1px solid rgba(180,167,229,0.35)' : '1px solid rgba(255,255,255,0.08)',
              color: form.detailLevel === 'standard' ? '#B4A7E5' : '#76746E',
            }}
          >
            Standard — 20-60 min steps
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, detailLevel: 'eli5' }))}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: form.detailLevel === 'eli5' ? 'rgba(242,192,99,0.12)' : 'rgba(255,255,255,0.03)',
              border: form.detailLevel === 'eli5' ? '1px solid rgba(242,192,99,0.35)' : '1px solid rgba(255,255,255,0.08)',
              color: form.detailLevel === 'eli5' ? '#F2C063' : '#76746E',
            }}
          >
            ELI5 Mode — ultra-concrete 15-45 min steps
          </button>
        </div>
      </div>

      {/* Link to goal */}
      {goals.length > 0 && (
        <div>
          <label style={labelStyle}>Link to Quarter Goal (optional)</label>
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

      {/* AI roadmap toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={generateRoadmap}
          onChange={e => setGenerateRoadmap(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ color: '#B8B6B0', fontSize: 13 }}>
          ✨ Generate AI roadmap with phases, milestones & concrete steps
        </span>
      </label>

      {error && <p style={{ color: '#FF6B6B', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="submit"
          disabled={saving || !form.title.trim() || !form.capabilityStatement.trim()}
          style={{
            background: saving ? 'rgba(180,167,229,0.08)' : 'rgba(180,167,229,0.15)',
            border: '1px solid rgba(180,167,229,0.4)',
            color: '#B4A7E5', padding: '9px 22px', borderRadius: 9,
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving
            ? (generateRoadmap ? '⏳ Creating + generating roadmap…' : 'Creating…')
            : `+ Create ${roadmapTypes.find(t => t.value === form.roadmapType)?.label.split(' ')[1] || ''} Roadmap`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#76746E', padding: '9px 16px', borderRadius: 9,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
