'use client'
import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlcoholLogRow {
  id: string
  userId: string
  date: string
  drinks: number
  occasion: string | null
  afterWorkout: boolean
  beforeWorkoutDay: boolean
  sleepHours: number | null
  sleepQuality: number | null
  nextDayEnergy: number | null
  missedWorkout: boolean
  missedSteps: boolean
  proteinHit: boolean | null
  calorieOverage: number | null
  hadCravings: boolean
  moodScore: number | null
  recoveryRating: number | null
  notes: string | null
  createdAt: string
}

interface SettingsRow {
  id: string
  userId: string
  budgetType: string
  weeklyBudget: number
  goal: string
  damageControlEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface Props {
  userId: string
  initialLogs: AlcoholLogRow[]
  initialSettings: SettingsRow | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASIONS = [
  { value: 'social',       label: '👥 Social' },
  { value: 'work',         label: '💼 Work event' },
  { value: 'stress',       label: '😤 Stress relief' },
  { value: 'habit',        label: '🔄 Just habit' },
  { value: 'celebration',  label: '🎉 Celebration' },
  { value: 'other',        label: '• Other' },
]

const DAMAGE_CONTROL_STEPS = [
  { icon: '💧', text: 'Drink 500ml water right now, before bed.' },
  { icon: '🥗', text: 'Plan a high-protein breakfast for tomorrow morning.' },
  { icon: '🚶', text: 'Non-negotiable: hit at least 8k steps tomorrow even if the workout is off.' },
  { icon: '😴', text: 'Prioritise 7+ hours of sleep — don\'t scroll, go to bed.' },
  { icon: '🏋️', text: 'If you miss the workout, replace it with a 20-min walk. Momentum over perfection.' },
]

const BUDGET_OPTIONS = [
  { value: 'strict',   label: 'Strict (0–1/week)',   budget: 1, description: 'Maximum fat-loss or performance phase' },
  { value: 'flexible', label: 'Flexible (2–4/week)', budget: 2, description: 'Default for fat loss — social life maintained' },
  { value: 'custom',   label: 'Custom',               budget: 2, description: 'Set your own weekly limit' },
]

const GOAL_OPTIONS = [
  { value: 'fat_loss',    label: '🔥 Fat Loss' },
  { value: 'performance', label: '⚡ Performance' },
  { value: 'general',     label: '🎯 General health' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function isSameWeek(dateStr: string): boolean {
  const mon = getMonday(new Date())
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 7)
  const d = new Date(dateStr)
  return d >= mon && d < sun
}

function calcWeeklyImpact(logs: AlcoholLogRow[], budget: number): {
  label: string; color: string; score: number; details: string[]
} {
  const thisWeek = logs.filter(l => isSameWeek(l.date))
  const totalDrinks = thisWeek.reduce((s, l) => s + l.drinks, 0)
  const missedWorkouts = thisWeek.filter(l => l.missedWorkout).length
  const poorSleep = thisWeek.filter(l => (l.sleepQuality ?? 5) <= 2).length
  const lowEnergy = thisWeek.filter(l => (l.nextDayEnergy ?? 5) <= 2).length
  const cravings = thisWeek.filter(l => l.hadCravings).length

  let score = 0
  score += Math.min(totalDrinks / (budget || 2), 3) * 30
  score += missedWorkouts * 20
  score += poorSleep * 10
  score += lowEnergy * 5
  score += cravings * 5
  score = Math.min(100, score)

  const details: string[] = []
  if (totalDrinks > 0) details.push(`${totalDrinks} drink${totalDrinks !== 1 ? 's' : ''} this week`)
  if (missedWorkouts > 0) details.push(`${missedWorkouts} missed workout${missedWorkouts !== 1 ? 's' : ''}`)
  if (poorSleep > 0) details.push(`${poorSleep} night${poorSleep !== 1 ? 's' : ''} poor sleep`)
  if (cravings > 0) details.push(`${cravings} craving episode${cravings !== 1 ? 's' : ''}`)

  if (score === 0) return { label: 'Clean week',       color: '#9FE7C0', score, details: ['No drinks logged this week'] }
  if (score < 25) return { label: 'Low impact',        color: '#9FE7C0', score, details }
  if (score < 55) return { label: 'Moderate impact',   color: '#F3D58A', score, details }
  if (score < 80) return { label: 'High impact',       color: '#F7B98E', score, details }
  return             { label: 'Progress blocker',    color: '#FFB4A8', score, details }
}

function groupByWeek(logs: AlcoholLogRow[]): { weekLabel: string; logs: AlcoholLogRow[]; totalDrinks: number }[] {
  const map = new Map<string, AlcoholLogRow[]>()
  for (const log of logs) {
    const mon = getMonday(new Date(log.date))
    const key = mon.toISOString().split('T')[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(log)
  }
  const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  return entries.map(([key, wlogs]) => {
    const mon = new Date(key)
    const sun = new Date(mon)
    sun.setDate(sun.getDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return {
      weekLabel: `${fmt(mon)} – ${fmt(sun)}`,
      logs: wlogs.sort((a, b) => b.date.localeCompare(a.date)),
      totalDrinks: wlogs.reduce((s, l) => s + l.drinks, 0),
    }
  })
}

function detectPatterns(logs: AlcoholLogRow[]): string[] {
  const patterns: string[] = []
  const byDay: Record<string, number> = {}
  const dayMissed: Record<string, number> = {}

  for (const log of logs) {
    const dow = new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' })
    byDay[dow] = (byDay[dow] ?? 0) + 1
    if (log.missedWorkout) dayMissed[dow] = (dayMissed[dow] ?? 0) + 1
  }

  for (const [day, count] of Object.entries(byDay)) {
    if (count >= 3) patterns.push(`You tend to drink on ${day}s (${count}× in the last 8 weeks)`)
  }
  for (const [day, missed] of Object.entries(dayMissed)) {
    if (missed >= 2) patterns.push(`Drinking on ${day}s has led to missed workouts ${missed}× in the last 8 weeks`)
  }

  const avgSleepAfter = logs.filter(l => l.sleepHours != null)
    .reduce((s, l, _, a) => s + (l.sleepHours ?? 0) / a.length, 0)
  if (avgSleepAfter > 0 && avgSleepAfter < 6.5) {
    patterns.push(`Average sleep after drinking: ${avgSleepAfter.toFixed(1)}h — below 7h recovery threshold`)
  }

  const cravingRate = logs.length > 0
    ? logs.filter(l => l.hadCravings).length / logs.length
    : 0
  if (cravingRate >= 0.4) patterns.push(`Food cravings triggered ${Math.round(cravingRate * 100)}% of the time after drinking`)

  return patterns
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: (value ?? 0) >= n ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.04)',
              color: (value ?? 0) >= n ? '#F3D58A' : '#48484A',
              transition: 'background 0.1s, color 0.1s',
            }}
          >★</button>
        ))}
      </div>
    </div>
  )
}

function ImpactBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 6 }}>
      <div style={{
        height: '100%', width: `${score}%`, borderRadius: 3,
        background: color, transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative',
          background: checked ? '#9FCBFF' : 'rgba(255,255,255,0.1)',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: 8, background: '#fff',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 13, color: '#A1A1A6' }}>{label}</span>
    </label>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AlcoholTracker({ userId, initialLogs, initialSettings }: Props) {
  const defaultBudget = initialSettings?.weeklyBudget ?? 2

  const [logs, setLogs] = useState<AlcoholLogRow[]>(initialLogs)
  const [settings, setSettings] = useState<SettingsRow>({
    id: initialSettings?.id ?? '',
    userId,
    budgetType: initialSettings?.budgetType ?? 'flexible',
    weeklyBudget: defaultBudget,
    goal: initialSettings?.goal ?? 'fat_loss',
    damageControlEnabled: initialSettings?.damageControlEnabled ?? true,
    createdAt: initialSettings?.createdAt ?? '',
    updatedAt: initialSettings?.updatedAt ?? '',
  })

  const [tab, setTab] = useState<'log' | 'history' | 'patterns' | 'settings'>('log')
  const [showDamageControl, setShowDamageControl] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Form state
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today,
    drinks: 1,
    occasion: '',
    afterWorkout: false,
    beforeWorkoutDay: false,
    sleepHours: '' as string | number,
    sleepQuality: null as number | null,
    nextDayEnergy: null as number | null,
    missedWorkout: false,
    missedSteps: false,
    proteinHit: null as boolean | null,
    calorieOverage: '' as string | number,
    hadCravings: false,
    moodScore: null as number | null,
    recoveryRating: null as number | null,
    notes: '',
    showNextDay: false,
  })

  const impact = calcWeeklyImpact(logs, settings.weeklyBudget)
  const thisWeekDrinks = logs.filter(l => isSameWeek(l.date)).reduce((s, l) => s + l.drinks, 0)
  const budgetLeft = Math.max(0, settings.weeklyBudget - thisWeekDrinks)
  const budgetPct = Math.min(100, (thisWeekDrinks / settings.weeklyBudget) * 100)

  const patterns = detectPatterns(logs)
  const weekGroups = groupByWeek(logs)

  const handleSubmit = useCallback(async () => {
    if (!form.date) return
    setSaving(true)
    try {
      const payload = {
        userId,
        date: form.date,
        drinks: form.drinks,
        occasion: form.occasion || null,
        afterWorkout: form.afterWorkout,
        beforeWorkoutDay: form.beforeWorkoutDay,
        sleepHours: form.showNextDay && form.sleepHours !== '' ? Number(form.sleepHours) : null,
        sleepQuality: form.showNextDay ? form.sleepQuality : null,
        nextDayEnergy: form.showNextDay ? form.nextDayEnergy : null,
        missedWorkout: form.showNextDay ? form.missedWorkout : false,
        missedSteps: form.showNextDay ? form.missedSteps : false,
        proteinHit: form.showNextDay ? form.proteinHit : null,
        calorieOverage: form.showNextDay && form.calorieOverage !== '' ? Number(form.calorieOverage) : null,
        hadCravings: form.showNextDay ? form.hadCravings : false,
        moodScore: form.showNextDay ? form.moodScore : null,
        recoveryRating: form.showNextDay ? form.recoveryRating : null,
        notes: form.notes || null,
      }
      const res = await fetch('/api/habits/alcohol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.log) {
        setLogs(prev => [data.log as AlcoholLogRow, ...prev])
        setForm(f => ({
          ...f,
          drinks: 1, occasion: '', afterWorkout: false, beforeWorkoutDay: false,
          sleepHours: '', sleepQuality: null, nextDayEnergy: null,
          missedWorkout: false, missedSteps: false, proteinHit: null,
          calorieOverage: '', hadCravings: false, moodScore: null, recoveryRating: null,
          notes: '', showNextDay: false,
        }))
        if (settings.damageControlEnabled && Number(payload.drinks) >= 2) {
          setShowDamageControl(true)
        }
      }
    } finally {
      setSaving(false)
    }
  }, [form, userId, settings.damageControlEnabled])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/habits/alcohol/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }, [])

  const handleSaveSettings = useCallback(async (patch: Partial<SettingsRow>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSavingSettings(true)
    try {
      await fetch('/api/habits/alcohol/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...patch }),
      })
    } finally {
      setSavingSettings(false)
    }
  }, [settings, userId])

  const TABS = [
    { key: 'log',      label: '📝 Log', },
    { key: 'history',  label: '📅 History', },
    { key: 'patterns', label: '🔍 Patterns', },
    { key: 'settings', label: '⚙️ Settings', },
  ] as const

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 20px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Weekly Budget Bar */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>This week</div>
            <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>
              {settings.budgetType === 'strict' ? 'Strict mode' : 'Flexible budget'} · {GOAL_OPTIONS.find(g => g.value === settings.goal)?.label ?? settings.goal}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: impact.color,
              padding: '3px 10px', borderRadius: 20,
              background: `${impact.color}18`,
              border: `1px solid ${impact.color}30`,
            }}>{impact.label}</span>
          </div>
        </div>

        {/* Budget progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6E6E73', marginBottom: 4 }}>
          <span>{thisWeekDrinks} / {settings.weeklyBudget} drinks used</span>
          <span>{budgetLeft > 0 ? `${budgetLeft} remaining` : 'Budget reached'}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.6s ease',
            width: `${budgetPct}%`,
            background: budgetPct >= 100 ? '#FFB4A8' : budgetPct >= 75 ? '#F7B98E' : budgetPct >= 50 ? '#F3D58A' : '#22C55E',
          }} />
        </div>

        {/* Impact details */}
        {impact.details.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {impact.details.map((d, i) => (
              <span key={i} style={{
                fontSize: 11, color: '#A1A1A6', padding: '2px 8px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              }}>{d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Damage control overlay */}
      {showDamageControl && (
        <div style={{
          ...cardStyle,
          borderColor: 'rgba(159,203,255,0.3)',
          background: 'rgba(159,203,255,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9FCBFF' }}>
              🛡️ Damage control protocol
            </div>
            <button
              onClick={() => setShowDamageControl(false)}
              style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          <p style={{ fontSize: 12, color: '#6E6E73', marginBottom: 12 }}>
            You logged 2+ drinks. Here's how to minimise the impact tonight and tomorrow:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DAMAGE_CONTROL_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{step.icon}</span>
                <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5 }}>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
              color: tab === t.key ? '#F5F5F7' : '#6E6E73',
              transition: 'background 0.15s, color 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── LOG TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Log a drinking occasion</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Date */}
            <div>
              <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 4 }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F5F5F7', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Drinks */}
            <div>
              <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 4 }}>
                Standard drinks
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0.5, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setForm(f => ({ ...f, drinks: n }))}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                      background: form.drinks === n ? 'rgba(159,203,255,0.3)' : 'rgba(255,255,255,0.05)',
                      color: form.drinks === n ? '#9FCBFF' : '#6E6E73',
                      fontWeight: form.drinks === n ? 700 : 400,
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Occasion */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 6 }}>Occasion</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {OCCASIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setForm(f => ({ ...f, occasion: f.occasion === o.value ? '' : o.value }))}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: form.occasion === o.value ? 'rgba(201,184,255,0.3)' : 'rgba(255,255,255,0.05)',
                    color: form.occasion === o.value ? '#C9B8FF' : '#6E6E73',
                    fontWeight: form.occasion === o.value ? 600 : 400,
                  }}
                >{o.label}</button>
              ))}
            </div>
          </div>

          {/* Context toggles */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <Toggle checked={form.afterWorkout} onChange={v => setForm(f => ({ ...f, afterWorkout: v }))} label="After a workout" />
            <Toggle checked={form.beforeWorkoutDay} onChange={v => setForm(f => ({ ...f, beforeWorkoutDay: v }))} label="Workout tomorrow" />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any context..."
              rows={2}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#F5F5F7', fontSize: 13, resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Next-day impact toggle */}
          <div style={{ marginBottom: form.showNextDay ? 16 : 0 }}>
            <button
              onClick={() => setForm(f => ({ ...f, showNextDay: !f.showNextDay }))}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: form.showNextDay ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: '#A1A1A6', fontSize: 12, cursor: 'pointer',
              }}
            >
              {form.showNextDay ? '▼' : '▶'} Add next-day impact data
            </button>
          </div>

          {form.showNextDay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 4 }}>Sleep hours</label>
                  <input
                    type="number"
                    min={0} max={12} step={0.5}
                    value={form.sleepHours}
                    onChange={e => setForm(f => ({ ...f, sleepHours: e.target.value }))}
                    placeholder="e.g. 6.5"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#F5F5F7', fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 4 }}>Extra calories (estimate)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.calorieOverage}
                    onChange={e => setForm(f => ({ ...f, calorieOverage: e.target.value }))}
                    placeholder="e.g. 400"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#F5F5F7', fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <StarRating value={form.sleepQuality} onChange={v => setForm(f => ({ ...f, sleepQuality: v }))} label="Sleep quality" />
                <StarRating value={form.nextDayEnergy} onChange={v => setForm(f => ({ ...f, nextDayEnergy: v }))} label="Next-day energy" />
                <StarRating value={form.moodScore} onChange={v => setForm(f => ({ ...f, moodScore: v }))} label="Mood next day" />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Toggle checked={form.missedWorkout} onChange={v => setForm(f => ({ ...f, missedWorkout: v }))} label="Missed workout" />
                <Toggle checked={form.missedSteps} onChange={v => setForm(f => ({ ...f, missedSteps: v }))} label="Missed step goal" />
                <Toggle checked={form.hadCravings} onChange={v => setForm(f => ({ ...f, hadCravings: v }))} label="Food cravings" />
                <Toggle
                  checked={form.proteinHit === true}
                  onChange={v => setForm(f => ({ ...f, proteinHit: v ? true : false }))}
                  label="Hit protein target"
                />
              </div>

              <StarRating value={form.recoveryRating} onChange={v => setForm(f => ({ ...f, recoveryRating: v }))} label="Overall recovery rating" />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: saving ? 'rgba(159,203,255,0.2)' : 'rgba(159,203,255,0.8)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              transition: 'background 0.15s',
            }}
          >{saving ? 'Saving…' : 'Log occasion'}</button>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {weekGroups.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 20px', color: '#48484A' }}>
              No logs yet — start tracking above.
            </div>
          )}
          {weekGroups.map(group => (
            <div key={group.weekLabel} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#A1A1A6' }}>{group.weekLabel}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#6E6E73',
                  padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)',
                }}>{group.totalDrinks} drink{group.totalDrinks !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.logs.map(log => (
                  <LogRow key={log.id} log={log} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PATTERNS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'patterns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 12 }}>8-week patterns</div>
            {patterns.length === 0 ? (
              <p style={{ fontSize: 13, color: '#48484A' }}>Log at least 4–5 occasions to see patterns.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ color: '#F3D58A', flexShrink: 0 }}>⚡</span>
                    <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8-week summary */}
          {logs.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 12 }}>8-week summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatCard label="Total drinks" value={logs.reduce((s, l) => s + l.drinks, 0).toFixed(1)} />
                <StatCard label="Missed workouts" value={String(logs.filter(l => l.missedWorkout).length)} />
                <StatCard label="Craving episodes" value={String(logs.filter(l => l.hadCravings).length)} />
                <StatCard
                  label="Avg sleep after"
                  value={(() => {
                    const sl = logs.filter(l => l.sleepHours != null)
                    if (!sl.length) return '–'
                    return (sl.reduce((s, l) => s + (l.sleepHours ?? 0), 0) / sl.length).toFixed(1) + 'h'
                  })()}
                />
                <StatCard
                  label="Avg next-day energy"
                  value={(() => {
                    const en = logs.filter(l => l.nextDayEnergy != null)
                    if (!en.length) return '–'
                    return (en.reduce((s, l) => s + (l.nextDayEnergy ?? 0), 0) / en.length).toFixed(1) + '/5'
                  })()}
                />
                <StatCard
                  label="Protein hit rate"
                  value={(() => {
                    const tracked = logs.filter(l => l.proteinHit != null)
                    if (!tracked.length) return '–'
                    const hits = tracked.filter(l => l.proteinHit).length
                    return `${Math.round((hits / tracked.length) * 100)}%`
                  })()}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Drink budget</div>

          {/* Budget type */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 8 }}>Budget mode</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BUDGET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSaveSettings({
                    budgetType: opt.value,
                    weeklyBudget: opt.value !== 'custom' ? opt.budget : settings.weeklyBudget,
                  })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10,
                    background: settings.budgetType === opt.value ? 'rgba(159,203,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${settings.budgetType === opt.value ? 'rgba(159,203,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: settings.budgetType === opt.value ? '#9FCBFF' : '#A1A1A6' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>{opt.description}</div>
                  </div>
                  {settings.budgetType === opt.value && (
                    <span style={{ color: '#9FCBFF', fontSize: 16 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom budget */}
          {settings.budgetType === 'custom' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#6E6E73', display: 'block', marginBottom: 6 }}>Weekly limit (drinks)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => handleSaveSettings({ weeklyBudget: n })}
                    style={{
                      width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                      background: settings.weeklyBudget === n ? 'rgba(159,203,255,0.3)' : 'rgba(255,255,255,0.05)',
                      color: settings.weeklyBudget === n ? '#9FCBFF' : '#6E6E73',
                      fontWeight: settings.weeklyBudget === n ? 700 : 400,
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          )}

          {/* Goal */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6E6E73', marginBottom: 8 }}>Current goal</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g.value}
                  onClick={() => handleSaveSettings({ goal: g.value })}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: settings.goal === g.value ? 'rgba(201,184,255,0.25)' : 'rgba(255,255,255,0.05)',
                    color: settings.goal === g.value ? '#C9B8FF' : '#6E6E73',
                    fontWeight: settings.goal === g.value ? 600 : 400,
                  }}
                >{g.label}</button>
              ))}
            </div>
          </div>

          {/* Damage control toggle */}
          <Toggle
            checked={settings.damageControlEnabled}
            onChange={v => handleSaveSettings({ damageControlEnabled: v })}
            label="Show damage control protocol after 2+ drinks"
          />

          {savingSettings && (
            <p style={{ fontSize: 11, color: '#6E6E73', marginTop: 12 }}>Saving…</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log, onDelete }: { log: AlcoholLogRow; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const date = new Date(log.date)
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const occ = OCCASIONS.find(o => o.value === log.occasion)

  const hasNextDay = log.sleepHours != null || log.sleepQuality != null ||
    log.nextDayEnergy != null || log.missedWorkout || log.missedSteps ||
    log.moodScore != null || log.recoveryRating != null

  const impactFlags: string[] = []
  if (log.missedWorkout) impactFlags.push('❌ Missed workout')
  if (log.missedSteps) impactFlags.push('🚶 Missed steps')
  if ((log.sleepQuality ?? 5) <= 2) impactFlags.push('😴 Poor sleep')
  if ((log.nextDayEnergy ?? 5) <= 2) impactFlags.push('🔋 Low energy')
  if (log.hadCravings) impactFlags.push('🍕 Cravings')

  return (
    <div style={{
      borderRadius: 8, background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13, color: '#6E6E73', minWidth: 90 }}>{dateStr}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#F5F5F7',
          padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.08)',
        }}>{log.drinks} drink{log.drinks !== 1 ? 's' : ''}</span>
        {occ && <span style={{ fontSize: 11, color: '#6E6E73' }}>{occ.label}</span>}
        {impactFlags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {impactFlags.slice(0, 2).map((f, i) => (
              <span key={i} style={{ fontSize: 10, color: '#F7B98E', padding: '1px 6px', borderRadius: 10, background: 'rgba(247,185,142,0.1)' }}>{f}</span>
            ))}
          </div>
        )}
        <span style={{ marginLeft: impactFlags.length > 0 ? 4 : 'auto', color: '#48484A', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {impactFlags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, marginBottom: 8 }}>
              {impactFlags.map((f, i) => (
                <span key={i} style={{ fontSize: 11, color: '#F7B98E', padding: '2px 8px', borderRadius: 12, background: 'rgba(247,185,142,0.1)' }}>{f}</span>
              ))}
            </div>
          )}

          {hasNextDay && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
              {log.sleepHours != null && <MiniStat label="Sleep" value={`${log.sleepHours}h`} />}
              {log.sleepQuality != null && <MiniStat label="Sleep quality" value={`${log.sleepQuality}/5`} />}
              {log.nextDayEnergy != null && <MiniStat label="Energy" value={`${log.nextDayEnergy}/5`} />}
              {log.moodScore != null && <MiniStat label="Mood" value={`${log.moodScore}/5`} />}
              {log.recoveryRating != null && <MiniStat label="Recovery" value={`${log.recoveryRating}/5`} />}
              {log.calorieOverage != null && <MiniStat label="Extra kcal" value={`~${log.calorieOverage}`} />}
            </div>
          )}

          {log.notes && (
            <p style={{ fontSize: 12, color: '#6E6E73', marginTop: 8, fontStyle: 'italic' }}>&ldquo;{log.notes}&rdquo;</p>
          )}

          <div style={{ marginTop: 10 }}>
            {confirming ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6E6E73' }}>Remove this entry?</span>
                <button
                  onClick={() => onDelete(log.id)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.3)', color: '#FFB4A8', fontSize: 12 }}
                >Remove</button>
                <button
                  onClick={() => setConfirming(false)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#6E6E73', fontSize: 12 }}
                >Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#48484A', fontSize: 11 }}
              >Remove</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '12px', borderRadius: 10, textAlign: 'center',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F5F7' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 11, color: '#F5F5F7', fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#48484A', marginTop: 1 }}>{label}</div>
    </div>
  )
}
