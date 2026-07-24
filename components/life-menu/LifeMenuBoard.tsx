'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifeMenuItem {
  id: string
  title: string
  type: string
  description?: string | null
  tags?: string | null
  estimatedCost?: number
  actualCost?: number
  currency: string
  timeNeededMinutes?: number
  energyNeeded: string
  socialMode: string
  status: string
  curiosityScore?: number
  joyScore?: number
  utilityScore?: number
  goalSupportScore?: number
  regretRisk?: number
  comfortZoneLevel?: number
  repeatPotential?: number
  recoveryValue?: number
  careerValue?: number
  fitnessImpact: string
  alcoholImpact: string
  plannedDate?: string
  triedAt?: string
  ratingAfter?: number
  notesBefore?: string | null
  notesAfter?: string | null
  linkedGoalId?: string | null
  createdAt: string
  updatedAt: string
}

interface Props {
  items: LifeMenuItem[]
  userId: string
  weeklyPlanId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  try:              { label: 'Try',             color: '#61adff', bg: 'rgba(97, 173, 255,0.12)', emoji: '🎯' },
  buy:              { label: 'Buy',             color: '#ffce53', bg: 'rgba(255, 206, 83,0.12)', emoji: '🛍️' },
  go:               { label: 'Go',              color: '#64f0aa', bg: 'rgba(100, 240, 170,0.12)', emoji: '📍' },
  eat_drink:        { label: 'Eat & Drink',     color: '#ffa360', bg: 'rgba(255, 163, 96,0.12)', emoji: '🍜' },
  learn:            { label: 'Learn',           color: '#a085ff', bg: 'rgba(160, 133, 255,0.12)', emoji: '📚' },
  build:            { label: 'Build',           color: '#a085ff', bg: 'rgba(160, 133, 255,0.12)', emoji: '🔧' },
  social:           { label: 'Social',          color: '#ff567b', bg: 'rgba(255, 86, 123,0.12)', emoji: '👥' },
  recovery:         { label: 'Recovery',        color: '#64f0aa', bg: 'rgba(100, 240, 170,0.12)', emoji: '🧘' },
  beauty_identity:  { label: 'Beauty / ID',     color: '#ff567b', bg: 'rgba(255, 86, 123,0.12)', emoji: '✨' },
  fitness:          { label: 'Fitness',         color: '#64f0aa', bg: 'rgba(100, 240, 170,0.12)', emoji: '💪' },
  guilty_pleasure:  { label: 'Guilty Pleasure', color: '#ff8263', bg: 'rgba(255, 130, 99,0.12)', emoji: '🍕' },
  big_want:         { label: 'Big Want',        color: '#ffce53', bg: 'rgba(255, 206, 83,0.12)', emoji: '⭐' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  idea:         { label: 'Idea',        color: '#6E6E73' },
  want_to_try:  { label: 'Want to Try', color: '#61adff' },
  wishlist:     { label: 'Wishlist',    color: '#ffce53' },
  planned:      { label: 'Planned',     color: '#a085ff' },
  scheduled:    { label: 'Scheduled',   color: '#a085ff' },
  tried:        { label: 'Tried',       color: '#A1A1A6' },
  loved:        { label: '❤️ Loved',    color: '#64f0aa' },
  meh:          { label: 'Meh',         color: '#A1A1A6' },
  not_again:    { label: '✗ Not Again', color: '#ff8263' },
  repeat:       { label: '🔁 Repeat',   color: '#64f0aa' },
  approved:     { label: 'Approved',    color: '#64f0aa' },
  earned:       { label: 'Earned',      color: '#ffce53' },
  bought:       { label: 'Bought',      color: '#ffce53' },
  postponed:    { label: 'Postponed',   color: '#6E6E73' },
  rejected:     { label: 'Rejected',    color: '#6E6E73' },
}

const ALL_STATUSES = Object.keys(STATUS_META)
const ALL_TYPES = Object.keys(TYPE_META)

const TABS = [
  { id: 'all',            label: 'All' },
  { id: 'try',            label: '🎯 Try' },
  { id: 'buy',            label: '🛍️ Buy' },
  { id: 'go',             label: '📍 Go' },
  { id: 'eat_drink',      label: '🍜 Eat & Drink' },
  { id: 'social',         label: '👥 Social' },
  { id: 'beauty_identity',label: '✨ Beauty' },
  { id: 'recovery',       label: '🧘 Recovery' },
  { id: 'learn_build',    label: '📚 Growth' },
  { id: 'guilty_pleasure',label: '🍕 Guilty' },
  { id: 'big_want',       label: '⭐ Big Wants' },
  { id: 'loved',          label: '❤️ Loved' },
  { id: 'not_again',      label: '✗ Not Again' },
]

const BLANK_FORM = {
  title: '', type: 'try', description: '', estimatedCost: '',
  currency: 'CZK', timeNeededMinutes: '', energyNeeded: 'medium',
  socialMode: 'either', status: 'want_to_try',
  curiosityScore: '', joyScore: '', regretRisk: '',
  fitnessImpact: 'neutral', alcoholImpact: 'none', notesBefore: '',
}

// ─── Decision Engine ──────────────────────────────────────────────────────────

function computeDecision(item: LifeMenuItem): string | null {
  const joy = item.joyScore ?? 0
  const cost = item.estimatedCost ?? 0
  const regret = item.regretRisk ?? 0
  const goalSupport = item.goalSupportScore ?? 0
  const curiosity = item.curiosityScore ?? 0
  const comfort = item.comfortZoneLevel ?? 5

  if (item.type === 'buy') {
    if (cost === 0) return null
    if (cost <= 500 && joy >= 7 && regret <= 3) return '✅ Buy guilt-free'
    if (cost > 5000) return '🎯 Earn it first'
    if (regret >= 7) return '⏳ Wait 48h'
    if (goalSupport >= 7) return '📈 Investment — approve'
    if (joy >= 7) return '🛍️ Worth it'
    return '📋 Add to wishlist'
  }

  if (item.type === 'guilty_pleasure') {
    if (item.alcoholImpact === 'high') return '🍺 Check alcohol budget first'
    if (regret >= 7) return '⏳ Wait 24h'
    if (joy >= 8) return '🎟️ Use your fun coupon'
    return '🔬 Try once, then evaluate'
  }

  if (item.type === 'recovery') {
    return '🌿 High priority — schedule soon'
  }

  if (curiosity >= 8 && cost <= 1000) return '✨ Try this week'
  if (comfort >= 8) return '🚀 Good stretch goal'
  if (comfort <= 2) return '🪜 Start with something smaller'
  if (cost > 3000) return '📅 Schedule this month'
  if (item.socialMode === 'friend') return '👯 Better with a friend'
  if (item.socialMode === 'solo') return '🚶 Perfect solo exploration'
  if (joy >= 8) return '🎉 High joy — schedule it'

  return null
}

// ─── Filter items by tab ──────────────────────────────────────────────────────

function filterByTab(items: LifeMenuItem[], tab: string): LifeMenuItem[] {
  if (tab === 'all') return items.filter(i => i.status !== 'rejected')
  if (tab === 'loved') return items.filter(i => i.status === 'loved' || i.status === 'repeat')
  if (tab === 'not_again') return items.filter(i => i.status === 'not_again')
  if (tab === 'learn_build') return items.filter(i => i.type === 'learn' || i.type === 'build')
  if (tab === 'recovery') return items.filter(i => i.type === 'recovery' || i.type === 'fitness')
  return items.filter(i => i.type === tab)
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtCost(cost: number | undefined, currency: string) {
  if (!cost) return null
  return currency === 'CZK'
    ? `${cost.toLocaleString('cs-CZ')} Kč`
    : `${cost.toLocaleString()} ${currency}`
}

function fmtTime(min: number | undefined) {
  if (!min) return null
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function ScorePill({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  if (!value) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: `${color}15`, border: `1px solid ${color}30`,
      color, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700,
    }}>
      {label} {value}/10
    </span>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, onStatusChange, onDelete, onReview, onSchedule, weeklyPlanId,
}: {
  item: LifeMenuItem
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onReview: (item: LifeMenuItem) => void
  onSchedule: (item: LifeMenuItem) => void
  weeklyPlanId?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const typeMeta = TYPE_META[item.type] ?? { label: item.type, color: '#A1A1A6', bg: 'rgba(255,255,255,0.05)', emoji: '·' }
  const statusMeta = STATUS_META[item.status] ?? { label: item.status, color: '#6E6E73' }
  const decision = computeDecision(item)
  const isCompleted = ['tried', 'loved', 'meh', 'not_again', 'repeat', 'bought', 'rejected'].includes(item.status)

  return (
    <div className="card" style={{
      padding: '16px 18px',
      opacity: item.status === 'rejected' ? 0.5 : 1,
      borderLeft: `3px solid ${typeMeta.color}40`,
      transition: 'opacity 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Type emoji */}
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{typeMeta.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: '#F5F5F7', lineHeight: 1.3,
              textDecoration: isCompleted && item.status !== 'loved' && item.status !== 'repeat' ? 'line-through' : 'none',
              opacity: isCompleted && !['loved', 'repeat'].includes(item.status) ? 0.6 : 1,
            }}>
              {item.title}
            </div>
            {/* Type + Status badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
              <span style={{
                background: typeMeta.bg, border: `1px solid ${typeMeta.color}30`,
                color: typeMeta.color, borderRadius: 5, padding: '2px 7px',
                fontSize: 10, fontWeight: 700,
              }}>
                {typeMeta.label}
              </span>
              <span style={{
                background: `${statusMeta.color}15`, border: `1px solid ${statusMeta.color}30`,
                color: statusMeta.color, borderRadius: 5, padding: '2px 7px',
                fontSize: 10, fontWeight: 700,
              }}>
                {statusMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Cost */}
        {item.estimatedCost && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ffce53', flexShrink: 0 }}>
            {fmtCost(item.estimatedCost, item.currency)}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
        {item.timeNeededMinutes && (
          <span style={{ fontSize: 11, color: '#6E6E73' }}>⏱ {fmtTime(item.timeNeededMinutes)}</span>
        )}
        {item.energyNeeded !== 'medium' && (
          <span style={{ fontSize: 11, color: '#6E6E73' }}>
            {item.energyNeeded === 'low' ? '🟢' : '🔴'} {item.energyNeeded} energy
          </span>
        )}
        {item.socialMode !== 'either' && (
          <span style={{ fontSize: 11, color: '#6E6E73' }}>
            {item.socialMode === 'solo' ? '🚶 Solo' : item.socialMode === 'friend' ? '👯 Friend' : item.socialMode === 'group' ? '👥 Group' : '💑 Date'}
          </span>
        )}
        {item.fitnessImpact === 'positive' && (
          <span style={{ fontSize: 11, color: '#64f0aa' }}>💪 Fitness+</span>
        )}
        {item.alcoholImpact !== 'none' && (
          <span style={{ fontSize: 11, color: '#ff8263' }}>
            🍺 {item.alcoholImpact} alcohol
          </span>
        )}
      </div>

      {/* Score pills */}
      {(item.joyScore || item.curiosityScore || item.regretRisk) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          <ScorePill label="Joy" value={item.joyScore} color="#64f0aa" />
          <ScorePill label="Curiosity" value={item.curiosityScore} color="#61adff" />
          {(item.regretRisk ?? 0) >= 6 && <ScorePill label="Regret risk" value={item.regretRisk} color="#ff8263" />}
        </div>
      )}

      {/* Decision suggestion */}
      {decision && !isCompleted && (
        <div style={{
          marginTop: 10, padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 8,
          fontSize: 12, color: '#A1A1A6', fontStyle: 'italic',
        }}>
          {decision}
        </div>
      )}

      {/* After review */}
      {item.status === 'loved' && item.notesAfter && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#64f0aa', fontStyle: 'italic' }}>
          ❤️ "{item.notesAfter}"
        </div>
      )}
      {item.status === 'not_again' && item.notesAfter && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ff8263', fontStyle: 'italic' }}>
          ✗ "{item.notesAfter}"
        </div>
      )}
      {item.ratingAfter && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#6E6E73' }}>
          Rated: {'★'.repeat(Math.round(item.ratingAfter / 2))}{'☆'.repeat(5 - Math.round(item.ratingAfter / 2))} ({item.ratingAfter}/10)
        </div>
      )}

      {/* Expandable notes */}
      {item.notesBefore && !expanded && (
        <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', color: '#6E6E73', fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 6 }}>
          + notes
        </button>
      )}
      {expanded && item.notesBefore && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#A1A1A6', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 8 }}>
          {item.notesBefore}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status change */}
        <select
          value={item.status}
          onChange={e => onStatusChange(item.id, e.target.value)}
          style={{
            appearance: 'none' as const,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#A1A1A6', cursor: 'pointer',
          }}
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
          ))}
        </select>

        {/* Mark tried */}
        {!['tried', 'loved', 'meh', 'not_again', 'repeat', 'rejected', 'bought'].includes(item.status) && (
          <button onClick={() => { onStatusChange(item.id, 'tried'); onReview({ ...item, status: 'tried' }) }}
            style={{ background: 'rgba(100, 240, 170,0.1)', border: '1px solid rgba(100, 240, 170,0.25)', color: '#64f0aa', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            ✓ Done / Tried
          </button>
        )}

        {/* Review again */}
        {['tried', 'loved', 'meh', 'not_again'].includes(item.status) && (
          <button onClick={() => onReview(item)}
            style={{ background: 'rgba(97, 173, 255,0.08)', border: '1px solid rgba(97, 173, 255,0.2)', color: '#61adff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
            📝 Review
          </button>
        )}

        {/* Schedule as task */}
        {weeklyPlanId && !['tried', 'loved', 'meh', 'not_again', 'repeat', 'rejected', 'bought', 'scheduled'].includes(item.status) && (
          <button onClick={() => onSchedule(item)}
            style={{ background: 'rgba(160, 133, 255,0.08)', border: '1px solid rgba(160, 133, 255,0.2)', color: '#a085ff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
            📅 Schedule
          </button>
        )}

        <button onClick={() => onDelete(item.id)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#44444A', cursor: 'pointer', fontSize: 13, padding: '4px 6px' }}
          title="Delete">
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({ userId, onSaved, onCancel }: { userId: string; onSaved: (item: LifeMenuItem) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#F5F5F7', padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none',
  }
  const labelStyle = {
    fontSize: 10, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', display: 'block', marginBottom: 4,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/life-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: form.title.trim(),
          type: form.type,
          description: form.description || null,
          estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
          currency: form.currency,
          timeNeededMinutes: form.timeNeededMinutes ? parseInt(form.timeNeededMinutes) : null,
          energyNeeded: form.energyNeeded,
          socialMode: form.socialMode,
          status: form.status,
          curiosityScore: form.curiosityScore ? parseInt(form.curiosityScore) : null,
          joyScore: form.joyScore ? parseInt(form.joyScore) : null,
          regretRisk: form.regretRisk ? parseInt(form.regretRisk) : null,
          fitnessImpact: form.fitnessImpact,
          alcoholImpact: form.alcoholImpact,
          notesBefore: form.notesBefore || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const item = await res.json() as LifeMenuItem
      onSaved(item)
      setForm({ ...BLANK_FORM })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Add to Life Menu</div>

      {/* Title + Type */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>What is it? *</label>
          <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Try hot yoga, Buy perfume, Visit gallery…" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.emoji} {TYPE_META[t]?.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cost + Time + Energy + Social */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Cost (Kč)</label>
          <input type="number" min="0" value={form.estimatedCost} onChange={e => set('estimatedCost', e.target.value)} placeholder="0" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Time (min)</label>
          <input type="number" min="0" value={form.timeNeededMinutes} onChange={e => set('timeNeededMinutes', e.target.value)} placeholder="60" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Energy</label>
          <select value={form.energyNeeded} onChange={e => set('energyNeeded', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="low">🟢 Low</option>
            <option value="medium">🟡 Medium</option>
            <option value="high">🔴 High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Social</label>
          <select value={form.socialMode} onChange={e => set('socialMode', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="either">Either</option>
            <option value="solo">Solo</option>
            <option value="friend">Friend</option>
            <option value="group">Group</option>
            <option value="date">Date</option>
          </select>
        </div>
      </div>

      {/* Scores + Status */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Joy (1–10)</label>
          <input type="number" min="1" max="10" value={form.joyScore} onChange={e => set('joyScore', e.target.value)} placeholder="8" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Curiosity (1–10)</label>
          <input type="number" min="1" max="10" value={form.curiosityScore} onChange={e => set('curiosityScore', e.target.value)} placeholder="7" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Regret Risk (1–10)</label>
          <input type="number" min="1" max="10" value={form.regretRisk} onChange={e => set('regretRisk', e.target.value)} placeholder="3" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label}</option>)}
          </select>
        </div>
      </div>

      {/* Impact flags + notes */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Fitness Impact</label>
          <select value={form.fitnessImpact} onChange={e => set('fitnessImpact', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="positive">💪 Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Alcohol</label>
          <select value={form.alcoholImpact} onChange={e => set('alcoholImpact', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={form.notesBefore} onChange={e => set('notesBefore', e.target.value)} placeholder="Why this, when, with who…" style={inputStyle} />
        </div>
      </div>

      {err && <div style={{ color: '#ff8263', fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !form.title.trim()} style={{
          background: 'rgba(97, 173, 255,0.15)', border: '1px solid rgba(97, 173, 255,0.3)',
          color: '#61adff', borderRadius: 8, padding: '8px 20px', fontSize: 13,
          fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : '+ Add to Menu'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ item, onClose, onSaved }: { item: LifeMenuItem; onClose: () => void; onSaved: (updated: LifeMenuItem) => void }) {
  const [rating, setRating] = useState(item.ratingAfter ?? 7)
  const [outcome, setOutcome] = useState(item.status === 'loved' ? 'loved' : item.status === 'not_again' ? 'not_again' : item.status === 'repeat' ? 'repeat' : 'meh')
  const [notes, setNotes] = useState(item.notesAfter ?? '')
  const [saving, setSaving] = useState(false)

  const OUTCOMES = [
    { id: 'loved',     label: '❤️ Loved it',       color: '#64f0aa' },
    { id: 'repeat',    label: '🔁 Would repeat',    color: '#64f0aa' },
    { id: 'meh',       label: '😐 Meh',             color: '#A1A1A6' },
    { id: 'not_again', label: '✗ Not again',        color: '#ff8263' },
  ]

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/life-menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: outcome, ratingAfter: rating, notesAfter: notes || null, triedAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json() as LifeMenuItem
      onSaved(updated)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '24px 26px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', marginBottom: 4 }}>How was it?</div>
        <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 20 }}>{item.title}</div>

        {/* Outcome buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {OUTCOMES.map(o => (
            <button key={o.id} onClick={() => setOutcome(o.id)} style={{
              background: outcome === o.id ? `${o.color}20` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${outcome === o.id ? o.color : 'rgba(255,255,255,0.1)'}`,
              color: outcome === o.id ? o.color : '#6E6E73',
              borderRadius: 8, padding: '10px 8px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
              transition: 'all 0.15s',
            }}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Rating */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
            Rating: {rating}/10
          </label>
          <input type="range" min={1} max={10} value={rating} onChange={e => setRating(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#61adff' }} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Worth it? Better solo or with someone? Any regret?"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F5F5F7', padding: '8px 12px', fontSize: 13, width: '100%', resize: 'vertical', minHeight: 70, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: 'rgba(100, 240, 170,0.15)', border: '1px solid rgba(100, 240, 170,0.3)', color: '#64f0aa', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save Review'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export default function LifeMenuBoard({ items: initItems, userId, weeklyPlanId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<LifeMenuItem[]>(initItems)
  const [activeTab, setActiveTab] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [reviewItem, setReviewItem] = useState<LifeMenuItem | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)

  const refresh = useCallback(() => router.refresh(), [router])

  // Summary stats
  const totalBudget = items.filter(i => i.estimatedCost && !['rejected', 'bought'].includes(i.status)).reduce((s, i) => s + (i.estimatedCost ?? 0), 0)
  const plannedCount = items.filter(i => ['planned', 'scheduled'].includes(i.status)).length
  const lovedCount = items.filter(i => i.status === 'loved' || i.status === 'repeat').length
  const toTryCount = items.filter(i => ['idea', 'want_to_try', 'wishlist'].includes(i.status)).length

  const tabItems = filterByTab(items, activeTab)

  async function handleStatusChange(id: string, status: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    await fetch(`/api/life-menu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/life-menu/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function handleSchedule(item: LifeMenuItem) {
    if (!weeklyPlanId) return
    setScheduling(item.id)
    try {
      const res = await fetch(`/api/life-menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled', userId, weeklyPlanId, createTask: true }),
      })
      if (res.ok) {
        const updated = await res.json() as LifeMenuItem
        setItems(prev => prev.map(i => i.id === item.id ? updated : i))
        refresh()
      }
    } finally {
      setScheduling(null)
    }
  }

  function handleReviewSaved(updated: LifeMenuItem) {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
  }

  // Tab counts
  function tabCount(tabId: string): number {
    const filtered = filterByTab(items, tabId)
    return tabId === 'all' ? filtered.length : filtered.length
  }

  return (
    <>
      {/* Summary stats */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'On the Menu', value: toTryCount, color: '#61adff' },
          { label: 'Planned', value: plannedCount, color: '#a085ff' },
          { label: 'Loved / Repeat', value: lovedCount, color: '#64f0aa' },
          { label: 'Fun Budget', value: totalBudget > 0 ? (totalBudget >= 1000 ? `${(totalBudget / 1000).toFixed(1)}k Kč` : `${totalBudget} Kč`) : '—', color: '#ffce53' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Add button */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(97, 173, 255,0.1)', border: '1px solid rgba(97, 173, 255,0.25)',
          color: '#61adff', borderRadius: 10, padding: '10px 18px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', marginBottom: 20,
        }}>
          + Add to Life Menu
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <AddForm userId={userId} onSaved={item => { setItems(prev => [item, ...prev]); setShowForm(false) }} onCancel={() => setShowForm(false)} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => {
          const count = tabCount(tab.id)
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
              color: isActive ? '#F5F5F7' : '#6E6E73',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {tab.label} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Items grid */}
      {tabItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6E6E73' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#A1A1A6', marginBottom: 6 }}>Nothing here yet</div>
          <div style={{ fontSize: 13 }}>Add something to try, buy, or experience.</div>
        </div>
      ) : (
        <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {tabItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onReview={setReviewItem}
              onSchedule={handleSchedule}
              weeklyPlanId={weeklyPlanId}
            />
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewItem && (
        <ReviewModal item={reviewItem} onClose={() => setReviewItem(null)} onSaved={handleReviewSaved} />
      )}
    </>
  )
}
