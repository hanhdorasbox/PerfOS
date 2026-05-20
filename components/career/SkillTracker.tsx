'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Skill = {
  id: string
  title: string
  category: string
  proficiency: number
  evidenceNotes?: string | null
  inUse: boolean
}

const categoryConfig: Record<string, { icon: string; label: string }> = {
  technical: { icon: '💻', label: 'Technical' },
  analytical: { icon: '📊', label: 'Analytical' },
  strategic: { icon: '🎯', label: 'Strategic' },
  communication: { icon: '🗣️', label: 'Communication' },
}

const CATEGORIES = ['technical', 'analytical', 'strategic', 'communication']

function ProficiencyDots({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i <= value ? '#B4A7E5' : 'rgba(180,167,229,0.2)',
          }}
        />
      ))}
    </div>
  )
}

export default function SkillTracker({
  skills: initSkills,
  userId,
}: {
  skills: Skill[]
  userId: string
}) {
  const router = useRouter()
  const [skills, setSkills] = useState<Skill[]>(initSkills)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    category: 'technical',
    proficiency: 3,
    evidenceNotes: '',
    inUse: false,
  })

  const grouped: Record<string, Skill[]> = {}
  for (const cat of CATEGORIES) {
    grouped[cat] = skills.filter(s => s.category === cat)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/career/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId }),
      })
      const data = await res.json() as Skill
      setSkills(prev => [...prev, data])
      setForm({ title: '', category: 'technical', proficiency: 3, evidenceNotes: '', inUse: false })
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteSkill(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/career/skills/${id}`, { method: 'DELETE' })
      setSkills(prev => prev.filter(s => s.id !== id))
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', margin: 0 }}>Skills</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'rgba(180,167,229,0.15)',
            border: '1px solid rgba(180,167,229,0.3)',
            borderRadius: 7,
            color: '#B4A7E5',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Skill
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
            placeholder="Skill title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle}
          />
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={inputStyle}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryConfig[c].icon} {categoryConfig[c].label}</option>
            ))}
          </select>
          <div>
            <label style={{ color: '#B8B6B0', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Proficiency: {form.proficiency}/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.proficiency}
              onChange={e => setForm(f => ({ ...f, proficiency: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#B4A7E5' }}
            />
          </div>
          <textarea
            placeholder="Evidence notes (optional)"
            value={form.evidenceNotes}
            onChange={e => setForm(f => ({ ...f, evidenceNotes: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#B8B6B0', fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.inUse}
              onChange={e => setForm(f => ({ ...f, inUse: e.target.checked }))}
              style={{ accentColor: '#6BE3A4' }}
            />
            Currently in use
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#B4A7E5',
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
                color: '#76746E',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CATEGORIES.filter(cat => grouped[cat].length > 0).map(cat => (
          <div key={cat}>
            <div style={{ color: '#76746E', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {categoryConfig[cat].icon} {categoryConfig[cat].label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[cat].map(skill => (
                <div
                  key={skill.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    opacity: deleting === skill.id ? 0.4 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{skill.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {skill.inUse && (
                        <span style={{ background: 'rgba(107,227,164,0.15)', border: '1px solid rgba(107,227,164,0.3)', color: '#6BE3A4', fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                          In use ✓
                        </span>
                      )}
                      <button
                        onClick={() => deleteSkill(skill.id)}
                        disabled={deleting === skill.id}
                        style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                        title="Delete"
                      >✕</button>
                    </div>
                  </div>
                  <ProficiencyDots value={skill.proficiency} />
                  {skill.evidenceNotes && (
                    <div style={{ color: '#76746E', fontSize: 11, marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {skill.evidenceNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {skills.length === 0 && (
          <div style={{ color: '#76746E', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No skills added yet. Add your first skill.
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
  color: '#FAFAFA',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}
