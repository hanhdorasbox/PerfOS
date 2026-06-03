'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Goal {
  id: string
  title: string
  category: string
  trackingType: string
  strategicRole: string | null
  startValue: number | null
  targetValue: number | null
  currentValue: number | null
  unit: string | null
  deadline: string
  priorityWeight: number
  status: string
}

interface Quarter {
  id: string
  name: string
}

interface AvailableQuarter {
  id: string
  name: string
  quarterNumber: number
  year: number
  status: string
  startDate: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Props {
  user: User
  quarter: Quarter
  goals: Goal[]
  availableQuarters?: AvailableQuarter[]
}

const STRATEGIC_ROLES = [
  { value: '', label: 'No role' },
  { value: 'career_capital', label: 'Career Capital', color: '#B8A4FF' },
  { value: 'learning', label: 'Learning', color: '#80BDFF' },
  { value: 'fitness', label: 'Fitness', color: '#7FD5AA' },
  { value: 'finance', label: 'Finance', color: '#ECC666' },
  { value: 'high_upside_bet', label: 'High-Upside Bet', color: '#F5A56A' },
  { value: 'long_term', label: 'Long-Term', color: '#80BDFF' },
]

const CATEGORIES = ['career', 'fitness', 'health', 'finance', 'learning', 'personal', 'other']

const EMPTY_FORM = {
  title: '',
  category: 'personal',
  trackingType: 'MILESTONE',
  strategicRole: '',
  startValue: '',
  targetValue: '',
  currentValue: '',
  unit: '',
  deadline: '',
  priorityWeight: '1',
  quarterId: '', // set dynamically from selected quarter
}

const STATUS_LABEL: Record<string, string> = {
  active:  'Active',
  planned: 'Planned',
  closed:  'Closed',
}
const STATUS_COLOR: Record<string, string> = {
  active:  '#7FD5AA',
  planned: '#80BDFF',
  closed:  '#6E6E73',
}

export default function GoalManager({ user: initUser, quarter: initQuarter, goals: initGoals, availableQuarters = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [goals, setGoals] = useState<Goal[]>(initGoals)
  const [quarter, setQuarter] = useState(initQuarter)
  const [user, setUser] = useState(initUser)
  const [selectedQuarterId, setSelectedQuarterId] = useState(initQuarter.id)

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)

  // Quarter editing
  const [editingQuarter, setEditingQuarter] = useState(false)
  const [quarterName, setQuarterName] = useState(quarter.name)

  // Goal creation form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  // H5: milestone drafts for new MILESTONE goals
  const [milestoneDrafts, setMilestoneDrafts] = useState<{ title: string; weight: number }[]>([
    { title: '', weight: 25 }, { title: '', weight: 25 }, { title: '', weight: 25 }, { title: '', weight: 25 },
  ])

  // Separate saving states so concurrent operations don't conflict
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingQuarter, setSavingQuarter] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const flash = (m: string, isError = false) => {
    if (isError) { setError(m); setTimeout(() => setError(''), 4000) }
    else { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  }

  // Save profile
  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: profileName, email: profileEmail }),
      })
      const data = await res.json() as { name: string; email: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error)
      setUser(prev => ({ ...prev, name: data.name, email: data.email }))
      setEditingProfile(false)
      flash('Profile updated')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to save', true)
    } finally {
      setSavingProfile(false)
    }
  }

  // Save quarter name
  const saveQuarter = async () => {
    setSavingQuarter(true)
    try {
      const res = await fetch(`/api/quarter/${quarter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quarterName }),
      })
      const data = await res.json() as { name: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error)
      setQuarter(prev => ({ ...prev, name: data.name }))
      setEditingQuarter(false)
      flash('Quarter renamed')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to save', true)
    } finally {
      setSavingQuarter(false)
    }
  }

  // Delete goal
  const deleteGoal = async (id: string) => {
    if (!confirm('Delete this goal? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error)
      }
      setGoals(prev => prev.filter(g => g.id !== id))
      flash('Goal deleted')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to delete', true)
    } finally {
      setDeleting(null)
    }
  }

  // C4: Pause / resume goal so it stops triggering alerts without being deleted
  const togglePause = async (goal: Goal) => {
    const newStatus = goal.status === 'paused' ? 'active' : 'paused'
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: newStatus } : g))
      flash(newStatus === 'paused' ? 'Goal paused — won\'t trigger alerts' : 'Goal resumed')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed', true)
    }
  }

  // Open edit form for existing goal
  const startEditGoal = (goal: Goal) => {
    setEditingGoal(goal)
    setForm({
      title: goal.title,
      category: goal.category,
      trackingType: goal.trackingType,
      strategicRole: goal.strategicRole ?? '',
      startValue: goal.startValue != null ? String(goal.startValue) : '',
      targetValue: goal.targetValue != null ? String(goal.targetValue) : '',
      currentValue: goal.currentValue != null ? String(goal.currentValue) : '',
      unit: goal.unit ?? '',
      deadline: goal.deadline.slice(0, 10),
      priorityWeight: String(goal.priorityWeight),
      quarterId: quarter.id,
    })
    setShowForm(true)
  }

  // Submit create/edit
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = form.title.trim()
    if (!trimmedTitle) { flash('Goal title is required', true); return }
    if (!form.deadline) { flash('Deadline is required', true); return }
    setSavingGoal(true)
    try {
      const payload = {
        title: trimmedTitle,
        category: form.category,
        trackingType: form.trackingType,
        strategicRole: form.strategicRole || null,
        startValue: form.startValue !== '' ? parseFloat(form.startValue) : null,
        targetValue: form.targetValue !== '' ? parseFloat(form.targetValue) : null,
        currentValue: form.currentValue !== '' ? parseFloat(form.currentValue) : null,
        unit: form.unit || null,
        deadline: form.deadline,
        priorityWeight: parseFloat(form.priorityWeight) || 1,
      }

      if (editingGoal) {
        // Update existing
        const res = await fetch(`/api/goals/${editingGoal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json() as Goal & { error?: string }
        if (!res.ok || data.error) throw new Error(data.error)
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...data } : g))
        flash('Goal updated')
      } else {
        // Create new
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, quarterId: selectedQuarterId || quarter.id, ...payload }),
        })
        const data = await res.json() as Goal & { error?: string }
        if (!res.ok || data.error) throw new Error(data.error)

        // H5: create milestones for MILESTONE-type goals
        if (payload.trackingType === 'MILESTONE') {
          const validMilestones = milestoneDrafts.filter(m => m.title.trim())
          for (const m of validMilestones) {
            await fetch('/api/milestones', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ goalId: data.id, title: m.title.trim(), weight: m.weight }),
            }).catch(() => {}) // non-fatal
          }
        }

        setGoals(prev => [...prev, data])
        flash('Goal added ✓')
      }

      setForm(EMPTY_FORM)
      setMilestoneDrafts([{ title: '', weight: 25 }, { title: '', weight: 25 }, { title: '', weight: 25 }, { title: '', weight: 25 }])
      setEditingGoal(null)
      setShowForm(false)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to save', true)
    } finally {
      setSavingGoal(false)
    }
  }

  // ─── Trigger button (always rendered, small) ─────────────────────────────
  const triggerBtn = (
    <button
      onClick={() => setOpen(true)}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#6E6E73',
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#F5F5F7'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
      onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#6E6E73'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
    >
      ✎ Manage Goals
    </button>
  )

  if (!open) return triggerBtn

  // ─── Full overlay panel ───────────────────────────────────────────────────
  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#F5F5F7',
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#6E6E73',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 4,
    display: 'block',
  }

  const roleColor = STRATEGIC_ROLES.find(r => r.value === form.strategicRole)?.color

  return (
    <>
      {triggerBtn}
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: '40px 20px', overflowY: 'auto',
        }}
        onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
      >
        <div style={{
          background: '#1A1917', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, width: '100%', maxWidth: 720, padding: 28,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F5F5F7' }}>Setup — Your Data</h2>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          {/* Feedback */}
          {msg && (
            <div style={{ background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.2)', color: '#7FD5AA', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
              {msg}
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(255,155,135,0.1)', border: '1px solid rgba(255,155,135,0.2)', color: '#FF9B87', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* ── Profile ───────────────────────────────────────────────── */}
          <section style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 12 }}>
              Profile
            </div>
            {!editingProfile ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7' }}>{user.name}</span>
                  <span style={{ fontSize: 13, color: '#6E6E73', marginLeft: 12 }}>{user.email}</span>
                </div>
                <button onClick={() => setEditingProfile(true)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(184,164,255,0.2)' }}>
                <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input style={inputStyle} value={profileName} onChange={e => setProfileName(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveProfile} disabled={savingProfile} style={{ background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.3)', color: '#B8A4FF', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {savingProfile ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingProfile(false); setProfileName(user.name); setProfileEmail(user.email) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '6px 16px', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Quarter ───────────────────────────────────────────────── */}
          <section style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 12 }}>
              Active Quarter
            </div>
            {!editingQuarter ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7' }}>{quarter.name}</span>
                <button onClick={() => setEditingQuarter(true)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                  Rename
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(236,198,102,0.2)' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={quarterName} onChange={e => setQuarterName(e.target.value)} />
                <button onClick={saveQuarter} disabled={savingQuarter} style={{ background: 'rgba(236,198,102,0.1)', border: '1px solid rgba(236,198,102,0.3)', color: '#ECC666', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {savingQuarter ? '…' : 'Save'}
                </button>
                <button onClick={() => { setEditingQuarter(false); setQuarterName(quarter.name) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* ── Goals list ────────────────────────────────────────────── */}
          <section style={{ marginBottom: showForm ? 24 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6E6E73' }}>
                Goals ({goals.length})
              </div>
              {!showForm && (
                <button
                  onClick={() => { setForm(EMPTY_FORM); setEditingGoal(null); setShowForm(true) }}
                  style={{ background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.25)', color: '#7FD5AA', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add Goal
                </button>
              )}
            </div>

            {goals.length === 0 && (
              <div style={{ color: '#6E6E73', fontSize: 13, padding: '14px 0', textAlign: 'center' }}>
                No goals yet — add your first one below.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {goals.map(goal => {
                const roleInfo = STRATEGIC_ROLES.find(r => r.value === goal.strategicRole)
                return (
                  <div
                    key={goal.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                      borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
                      opacity: deleting === goal.id ? 0.4 : 1,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{goal.title}</span>
                        {roleInfo?.value && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: roleInfo.color, background: `${roleInfo.color}18`, border: `1px solid ${roleInfo.color}30`, borderRadius: 4, padding: '2px 6px' }}>
                            {roleInfo.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>
                        {goal.category}
                        {goal.trackingType === 'QUANTITATIVE' && goal.targetValue != null && (
                          <> · {goal.currentValue ?? goal.startValue ?? 0} → {goal.targetValue} {goal.unit}</>
                        )}
                        {' '}· due {new Date(goal.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => startEditGoal(goal)}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      {/* C4: Pause/Resume — stops false alerts without deleting */}
                      <button
                        onClick={() => togglePause(goal)}
                        style={{ background: 'none', border: `1px solid ${goal.status === 'paused' ? 'rgba(127,213,170,0.25)' : 'rgba(255,255,255,0.1)'}`, color: goal.status === 'paused' ? '#7FD5AA' : '#6E6E73', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
                        title={goal.status === 'paused' ? 'Resume this goal' : 'Pause — stops alerts for this goal'}
                      >
                        {goal.status === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        disabled={deleting === goal.id}
                        style={{ background: 'none', border: '1px solid rgba(255,155,135,0.2)', color: '#FF9B87', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        {deleting === goal.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Goal form ─────────────────────────────────────────────── */}
          {showForm && (
            <form onSubmit={submitForm} style={{ marginTop: 20, padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(184,164,255,0.15)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#B8A4FF', marginBottom: 16 }}>
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </div>

              {/* Quarter selector — only for new goals when multiple quarters available */}
              {!editingGoal && availableQuarters.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Quarter</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {availableQuarters.map(aq => {
                      const sel = (selectedQuarterId || quarter.id) === aq.id
                      const sc  = STATUS_COLOR[aq.status] ?? '#6E6E73'
                      return (
                        <button
                          key={aq.id}
                          type="button"
                          onClick={() => setSelectedQuarterId(aq.id)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', border: 'none',
                            background: sel ? `${sc}20` : 'rgba(255,255,255,0.05)',
                            color: sel ? sc : '#6E6E73',
                            outline: sel ? `1px solid ${sc}50` : 'none',
                          }}
                        >
                          Q{aq.quarterNumber} {aq.year}
                          <span style={{ marginLeft: 5, fontWeight: 500, fontSize: 10, opacity: 0.8 }}>
                            {STATUS_LABEL[aq.status] ?? aq.status}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Status hint */}
                  {(() => {
                    const sq = availableQuarters.find(q => q.id === (selectedQuarterId || quarter.id))
                    if (!sq) return null
                    if (sq.status === 'planned') {
                      const d = new Date(sq.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                      return <div style={{ marginTop: 6, fontSize: 11, color: '#80BDFF' }}>Planned quarter — activates automatically on {d}.</div>
                    }
                    if (sq.status === 'closed') return <div style={{ marginTop: 6, fontSize: 11, color: '#6E6E73' }}>Closed quarter — goals here are historical.</div>
                    return <div style={{ marginTop: 6, fontSize: 11, color: '#7FD5AA' }}>Active quarter — goal will appear in current dashboard.</div>
                  })()}
                </div>
              )}

              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Goal Title *</label>
                <input
                  required
                  style={inputStyle}
                  placeholder="e.g. Complete 10 minimum effective weeks out of 12"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              {/* Category + Role */}
              <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Strategic Role</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer', color: roleColor ?? '#F5F5F7' }}
                    value={form.strategicRole}
                    onChange={e => setForm(p => ({ ...p, strategicRole: e.target.value }))}
                  >
                    {STRATEGIC_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tracking type */}
              {/* Fitness goal guidance — execution-based, not weight-based */}
              {(form.category === 'fitness' || form.category === 'health') && (
                <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(127,213,170,0.06)', borderRadius: 8, border: '1px solid rgba(127,213,170,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7FD5AA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Fitness goal ideas</div>
                  <div style={{ fontSize: 11, color: '#6E6E73', lineHeight: 1.6 }}>
                    Complete 10 minimum effective weeks · Hit protein 5×/week · Keep alcohol under weekly limit · 3 strength sessions/week at 80%+ adherence
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>How to track progress</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'MILESTONE', label: 'Milestones', desc: 'Checkbox steps' },
                    { value: 'QUANTITATIVE', label: 'Quantitative', desc: 'Numeric target' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, trackingType: opt.value }))}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: form.trackingType === opt.value ? '1px solid rgba(184,164,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        background: form.trackingType === opt.value ? 'rgba(184,164,255,0.1)' : 'rgba(255,255,255,0.03)',
                        color: form.trackingType === opt.value ? '#B8A4FF' : '#6E6E73',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                      <div style={{ fontSize: 10, marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantitative fields */}
              {form.trackingType === 'QUANTITATIVE' && (
                <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Start Value</label>
                    <input style={inputStyle} type="number" step="any" placeholder="0" value={form.startValue} onChange={e => setForm(p => ({ ...p, startValue: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Current Value</label>
                    <input style={inputStyle} type="number" step="any" placeholder="same as start" value={form.currentValue} onChange={e => setForm(p => ({ ...p, currentValue: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Target Value</label>
                    <input style={inputStyle} type="number" step="any" placeholder="100" value={form.targetValue} onChange={e => setForm(p => ({ ...p, targetValue: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Unit</label>
                    <input style={inputStyle} placeholder="kg / % / hrs" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* H5: Milestone editor — only for new MILESTONE goals */}
              {form.trackingType === 'MILESTONE' && !editingGoal && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Milestones (add up to 4)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {milestoneDrafts.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          placeholder={`Milestone ${i + 1} title`}
                          value={m.title}
                          onChange={e => setMilestoneDrafts(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                        />
                        <input
                          style={{ ...inputStyle, width: 60, textAlign: 'center' }}
                          type="number" min="5" max="100" step="5"
                          value={m.weight}
                          onChange={e => setMilestoneDrafts(prev => prev.map((x, j) => j === i ? { ...x, weight: parseInt(e.target.value) || 25 } : x))}
                          title="Weight %"
                        />
                        <span style={{ fontSize: 10, color: '#6E6E73', minWidth: 14 }}>%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 4 }}>
                    You can also add milestones after creation on the goal detail page.
                  </div>
                </div>
              )}

              {/* Deadline + Weight */}
              <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Deadline *</label>
                  <input required style={inputStyle} type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Priority Weight (1–3)</label>
                  <input style={inputStyle} type="number" min="0.5" max="3" step="0.5" value={form.priorityWeight} onChange={e => setForm(p => ({ ...p, priorityWeight: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={savingGoal}
                  style={{ background: 'rgba(127,213,170,0.12)', border: '1px solid rgba(127,213,170,0.3)', color: '#7FD5AA', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {savingGoal ? 'Saving…' : editingGoal ? 'Update Goal' : 'Add Goal'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingGoal(null); setForm(EMPTY_FORM) }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setOpen(false); router.refresh() }}
              style={{ background: 'rgba(184,164,255,0.1)', border: '1px solid rgba(184,164,255,0.2)', color: '#B8A4FF', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
