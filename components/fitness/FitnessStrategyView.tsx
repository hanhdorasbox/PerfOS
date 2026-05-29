'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

interface WorkoutExercise {
  name: string
  sets: number
  reps: string
  notes?: string | null
  substitution?: string | null
}

interface WorkoutDay {
  label: string
  theme: string
  exercises: WorkoutExercise[]
}

interface WorkoutPlan {
  progressionRule: string
  trackingNote: string
  days: WorkoutDay[]
}

// ── Session action types ────────────────────────────────────────────────────

interface RemoveTarget { labelKey: string; session: string; day: string; sessionType: string }
interface UndoState { id: string; labelKey: string; label: string }
interface FeedbackState { text: string; type: 'ok' | 'warn' | 'protect' }

const REMOVE_REASONS = [
  { value: 'cannot_this_week', label: 'Cannot do it this week', emoji: '📅', affectsAdherence: true },
  { value: 'replace_lighter',  label: 'Replacing with something lighter', emoji: '🔄', affectsAdherence: false },
  { value: 'plan_too_much',    label: 'Plan is too much right now', emoji: '😤', affectsAdherence: false },
  { value: 'already_done_equivalent', label: 'Already did something equivalent', emoji: '✅', affectsAdherence: false },
  { value: 'remove_from_plan', label: 'Remove from plan permanently', emoji: '🗑', affectsAdherence: true },
  { value: 'moving_to_other_day', label: 'Moving it to another day', emoji: '📆', affectsAdherence: false },
  { value: 'other',            label: 'Other reason', emoji: '💬', affectsAdherence: true },
]

function classifySession(session: string): 'strength' | 'cardio' | 'sauna' | 'walk' {
  const s = session.toLowerCase()
  if (/sauna/.test(s)) return 'sauna'
  if (/cardio|run|cycle|swim|rowing|zone/.test(s)) return 'cardio'
  if (/walk|steps|stroll/.test(s)) return 'walk'
  return 'strength'
}

function getWeekId() {
  const now = new Date(); const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day; const mon = new Date(now)
  mon.setDate(now.getDate() + diff); return mon.toISOString().split('T')[0]
}

interface FitnessStrategy {
  id: string
  userId?: string
  mainObjective: string
  strengthPlan?: string | null
  cardioPlan?: string | null
  saunaPlan?: string | null
  nutritionDir?: string | null
  weeklySchedule?: string | null
  trackingMetrics?: string | null
  risks?: string | null
  decisionRules?: string | null
  roadmap?: string | null
  weeklyTargets?: string | null
  immediateNextSteps?: string | null
  workoutPlan?: string | null
  status: string
  createdAt: string
}

interface Props {
  strategy: FitnessStrategy
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

// Use grid layout so long values wrap cleanly without overlapping labels
function DefRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 14px', alignItems: 'start', paddingBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#6E6E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingTop: 1, lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: accent || '#F5F5F7', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}

function SectionCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 style={{ fontSize: 13, fontWeight: 700, color: accent || '#A1A1A6', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

interface RoadmapPhaseData {
  phase: string
  weekRange: string
  title: string
  purpose: string
  focus: string[]
  execute: string[]
  monitor: string
  decisionPoint: string
}

function RoadmapPhase({ phase }: { phase: RoadmapPhaseData }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: 'none', padding: '14px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {phase.weekRange}
          </span>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', marginTop: 2 }}>
            {phase.phase}: {phase.title}
          </div>
        </div>
        <span style={{ color: '#6E6E73', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6, margin: 0 }}>{phase.purpose}</p>

          {phase.focus?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Focus</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phase.focus.map((f: string, i: number) => (
                  <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'rgba(184,164,255,0.1)', color: '#B8A4FF', border: '1px solid rgba(184,164,255,0.2)' }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase.execute?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Execute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.execute.map((e: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#7FD5AA', fontSize: 12, marginTop: 1, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5 }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: 'rgba(128,189,255,0.06)', borderRadius: 8, border: '1px solid rgba(128,189,255,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#80BDFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Project Hanh monitors</div>
              <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.5 }}>{phase.monitor}</p>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(236,198,102,0.06)', borderRadius: 8, border: '1px solid rgba(236,198,102,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ECC666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Decision point</div>
              <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.5 }}>{phase.decisionPoint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BulletText({ text, color = '#A1A1A6' }: { text: string; color?: string }) {
  if (!text) return null
  // Split on newlines or on ". " followed by capital letter (sentence split)
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    // Try splitting on sentences
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean)
    if (sentences.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sentences.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#80BDFF', fontSize: 11, marginTop: 2, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{s.trim()}</span>
            </div>
          ))}
        </div>
      )
    }
    return <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{text}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => {
        const clean = line.replace(/^[•\-\*\d+\.]\s*/, '')
        return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: '#80BDFF', fontSize: 11, marginTop: 2, flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{clean}</span>
          </div>
        )
      })}
    </div>
  )
}

function NumberedText({ text, color = '#A1A1A6' }: { text: string; color?: string }) {
  if (!text) return null
  // Split on numbered list patterns or newlines
  const lines = text
    .split(/\n|(?=\d+\.\s)/)
    .map(l => l.trim())
    .filter(Boolean)
  if (lines.length <= 1) {
    // Try splitting on ". " where followed by capital
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean)
    if (sentences.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sentences.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#B8A4FF', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
              <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{s.trim()}</span>
            </div>
          ))}
        </div>
      )
    }
    return <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{text}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, i) => {
        // Strip leading number prefix if present
        const clean = line.replace(/^\d+\.\s*/, '')
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#B8A4FF', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
            <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{clean}</span>
          </div>
        )
      })}
    </div>
  )
}

function WorkoutDayPanel({ day, onClose }: { day: WorkoutDay; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(5,5,6,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0E0E10', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 28, maxWidth: 560, width: '100%',
          maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {day.theme}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F5F7' }}>{day.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6E6E73', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Exercise table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {day.exercises.map((ex, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: ex.notes || ex.substitution ? 5 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7' }}>{ex.name}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#7FD5AA',
                  background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.2)',
                  padding: '2px 10px', borderRadius: 999, whiteSpace: 'nowrap', marginLeft: 8,
                }}>
                  {ex.sets} × {ex.reps}
                </span>
              </div>
              {ex.notes && <div style={{ fontSize: 12, color: '#6E6E73', lineHeight: 1.5 }}>{ex.notes}</div>}
              {ex.substitution && (
                <div style={{ fontSize: 11, color: '#B8A4FF', marginTop: 4 }}>
                  ↔ {ex.substitution}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Action menu item ────────────────────────────────────────────────────────

function ActionMenuItem({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: color ?? '#A1A1A6' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ── Weekly Status Bar ────────────────────────────────────────────────────────

function WeeklyStatusBar({
  schedule, completedKeys, removedKeys, weeklyTargets,
}: {
  schedule: { day: string; sessions: string[] }[]
  completedKeys: Set<string>
  removedKeys: Set<string>
  weeklyTargets: Record<string, string> | null
}) {
  const counts = { strength: 0, cardio: 0, sauna: 0, walk: 0 }
  const completed = { strength: 0, cardio: 0, sauna: 0, walk: 0 }
  const removed = { strength: 0, cardio: 0, sauna: 0, walk: 0 }

  for (const day of schedule) {
    for (const s of (day.sessions ?? [])) {
      const type = classifySession(s)
      counts[type]++
      const lk = `${day.day}:${s}`
      if (completedKeys.has(lk)) completed[type]++
      if (removedKeys.has(lk)) removed[type]++
    }
  }

  // Parse target numbers from weeklyTargets strings
  function parseTarget(val: string | null | undefined): number | null {
    if (!val) return null
    const m = val.match(/(\d+)/)
    return m ? parseInt(m[1]) : null
  }

  const tStrength = parseTarget(weeklyTargets?.strength)
  const tCardio   = parseTarget(weeklyTargets?.cardio)
  const tSauna    = parseTarget(weeklyTargets?.sauna)

  // Classify load
  const totalPlanned = counts.strength + counts.cardio + counts.sauna + counts.walk
  const totalRemoved = removed.strength + removed.cardio + removed.sauna + removed.walk
  const effectiveSessions = totalPlanned - totalRemoved
  const load: 'optimal' | 'underloaded' =
    effectiveSessions >= totalPlanned * 0.8 ? 'optimal' : 'underloaded'

  const loadColor = load === 'optimal' ? '#7FD5AA' : '#FF9B87'
  const loadLabel = load === 'optimal' ? 'Optimal plan' : 'Underloaded'

  const items = [
    { label: 'Strength', type: 'strength', planned: tStrength ?? counts.strength, done: completed.strength, removed: removed.strength, color: '#7FD5AA' },
    counts.cardio > 0 && { label: 'Cardio', type: 'cardio', planned: tCardio ?? counts.cardio, done: completed.cardio, removed: removed.cardio, color: '#80BDFF' },
    counts.sauna > 0 && { label: 'Sauna', type: 'sauna', planned: tSauna ?? counts.sauna, done: completed.sauna, removed: removed.sauna, color: '#F5A56A' },
    counts.walk > 0 && { label: 'Walks', type: 'walk', planned: counts.walk, done: completed.walk, removed: removed.walk, color: '#B8A4FF' },
  ].filter(Boolean) as { label: string; type: string; planned: number; done: number; removed: number; color: string }[]

  return (
    <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em' }}>This Week</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: loadColor, background: `${loadColor}12`, border: `1px solid ${loadColor}30`, borderRadius: 99, padding: '2px 9px' }}>{loadLabel}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {items.map(item => {
          const pct = item.planned > 0 ? Math.min(1, item.done / item.planned) : 0
          return (
            <div key={item.type} style={{ flex: '1 1 100px', minWidth: 90 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#6E6E73' }}>{item.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>
                  {item.done}<span style={{ color: '#6E6E73', fontWeight: 400 }}>/{item.planned}</span>
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: item.color, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              {item.removed > 0 && (
                <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 3 }}>{item.removed} removed</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FitnessStrategyView({ strategy }: Props) {
  const router = useRouter()
  const [activating, setActivating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [schedule, setSchedule] = useState<{ day: string; sessions: string[] }[]>(
    () => tryParse(strategy.weeklySchedule) ?? []
  )
  const [dragSource, setDragSource] = useState<{ dayIdx: number; sessionIdx: number } | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [openWorkoutDay, setOpenWorkoutDay] = useState<WorkoutDay | null>(null)

  // ── Per-session action state ─────────────────────────────────────────────
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set())
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set())
  const [actionMenuKey, setActionMenuKey] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [savingRemoval, setSavingRemoval] = useState(false)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const weekId = getWeekId()

  // Close action menu when clicking outside
  const menuRef = useRef<string | null>(null)
  menuRef.current = actionMenuKey

  // Load this week's changes from DB on mount
  useEffect(() => {
    if (!strategy.userId) return
    fetch(`/api/fitness/schedule-change?userId=${strategy.userId}&weekId=${weekId}`)
      .then(r => r.json())
      .then((changes: Array<{ id: string; sessionLabel: string; sessionDay: string; action: string; undone: boolean }>) => {
        if (!Array.isArray(changes)) return
        const removed = new Set<string>()
        const completed = new Set<string>()
        for (const c of changes) {
          if (c.undone) continue
          const lk = `${c.sessionDay}:${c.sessionLabel}`
          if (c.action === 'completed') completed.add(lk)
          else removed.add(lk)
        }
        setRemovedKeys(removed)
        setCompletedKeys(completed)
      })
      .catch(() => {})
  }, [strategy.userId, weekId])

  const sp = tryParse(strategy.strengthPlan)
  const cp = tryParse(strategy.cardioPlan)
  const sauna = tryParse(strategy.saunaPlan)
  const nutr = tryParse(strategy.nutritionDir)
  const weeklySchedule = schedule
  const trackingMetrics: string[] = tryParse(strategy.trackingMetrics) ?? []
  const roadmap: RoadmapPhaseData[] = tryParse(strategy.roadmap) ?? []
  const weeklyTargets = tryParse(strategy.weeklyTargets)
  const nextSteps: string[] = tryParse(strategy.immediateNextSteps) ?? []
  const workoutPlan: WorkoutPlan | null = tryParse(strategy.workoutPlan)

  // Build a lookup from workout label → WorkoutDay for quick access from schedule chips
  const workoutByLabel = new Map<string, WorkoutDay>()
  if (workoutPlan?.days) {
    for (const d of workoutPlan.days) {
      workoutByLabel.set(d.label.toLowerCase(), d)
    }
  }

  async function activate() {
    setActivating(true)
    try {
      await fetch('/api/fitness/strategy/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: strategy.userId, strategyId: strategy.id }),
      })
      router.refresh()
    } finally {
      setActivating(false)
    }
  }

  async function deleteStrategy() {
    setDeleting(true)
    try {
      await fetch(`/api/fitness/strategy/${strategy.id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  async function persistSchedule(newSchedule: { day: string; sessions: string[] }[]) {
    setSavingSchedule(true)
    try {
      await fetch('/api/fitness/strategy/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, weeklySchedule: newSchedule }),
      })
    } finally {
      setSavingSchedule(false)
    }
  }

  // ── Session action handlers ──────────────────────────────────────────────

  const handleMarkDone = useCallback(async (labelKey: string, session: string, day: string) => {
    setActionMenuKey(null)
    const isAlreadyDone = completedKeys.has(labelKey)
    try {
      if (isAlreadyDone) {
        setCompletedKeys(prev => { const n = new Set(prev); n.delete(labelKey); return n })
      } else {
        setCompletedKeys(prev => new Set([...prev, labelKey]))
        await fetch('/api/fitness/schedule-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: strategy.userId, weekId, sessionLabel: session, sessionDay: day, sessionType: classifySession(session), action: 'completed', reason: null }),
        })
        const type = classifySession(session)
        setFeedback({ text: `✓ ${session} marked as done. Great work!`, type: 'ok' })
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch { /* silent */ }
  }, [completedKeys, strategy.userId, weekId])

  const handleRemoveClick = useCallback((labelKey: string, session: string, day: string) => {
    setActionMenuKey(null)
    setRemoveTarget({ labelKey, session, day, sessionType: classifySession(session) })
    setSelectedReason('')
  }, [])

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget || !selectedReason) return
    setSavingRemoval(true)
    try {
      const res = await fetch('/api/fitness/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: strategy.userId, weekId,
          sessionLabel: removeTarget.session, sessionDay: removeTarget.day,
          sessionType: removeTarget.sessionType,
          action: selectedReason === 'moving_to_other_day' ? 'rescheduled' : 'removed',
          reason: selectedReason,
        }),
      })
      const data = await res.json() as { id: string }
      setRemovedKeys(prev => new Set([...prev, removeTarget.labelKey]))

      // Impact message
      const allOfType = schedule.flatMap(d => (d.sessions ?? []).map(s => ({ type: classifySession(s), lk: `${d.day}:${s}` }))).filter(x => x.type === removeTarget.sessionType)
      const remaining = allOfType.filter(x => !removedKeys.has(x.lk) && x.lk !== removeTarget.labelKey).length
      const type = removeTarget.sessionType
      let impactText = ''
      if (type === 'strength') impactText = remaining <= 1 ? `⚠️ Strength drops to ${remaining} session this week. Consider rescheduling.` : `Strength: ${remaining} session${remaining !== 1 ? 's' : ''} remaining this week.`
      else if (type === 'cardio') impactText = `Cardio: ${remaining} session${remaining !== 1 ? 's' : ''} remaining this week.`
      else if (type === 'sauna') impactText = 'Sauna removed. Recovery target may still be met via other protocols.'
      else impactText = `Session removed from this week.`

      setFeedback({ text: impactText, type: impactText.startsWith('⚠') ? 'warn' : selectedReason === 'plan_too_much' ? 'protect' : 'ok' })
      setUndoState({ id: data.id, labelKey: removeTarget.labelKey, label: removeTarget.session })
      setTimeout(() => { setUndoState(null) }, 8000)
      setRemoveTarget(null); setSelectedReason('')
    } catch { /* silent */ }
    finally { setSavingRemoval(false) }
  }, [removeTarget, selectedReason, strategy.userId, weekId, schedule, removedKeys])

  const handleUndo = useCallback(async () => {
    if (!undoState) return
    try {
      await fetch('/api/fitness/schedule-change', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: undoState.id }) })
      setRemovedKeys(prev => { const n = new Set(prev); n.delete(undoState.labelKey); return n })
      setFeedback(null)
    } catch { /* silent */ }
    setUndoState(null)
  }, [undoState])

  function handleDragStart(dayIdx: number, sessionIdx: number) {
    setDragSource({ dayIdx, sessionIdx })
  }

  function handleDrop(targetDayIdx: number) {
    if (!dragSource) return
    const { dayIdx: srcDay, sessionIdx: srcSession } = dragSource
    if (srcDay === targetDayIdx) { setDragSource(null); setDragOverDay(null); return }

    const newSchedule = schedule.map(d => ({ ...d, sessions: [...d.sessions] }))
    const [session] = newSchedule[srcDay].sessions.splice(srcSession, 1)
    newSchedule[targetDayIdx].sessions.push(session)

    setSchedule(newSchedule)
    setDragSource(null)
    setDragOverDay(null)
    persistSchedule(newSchedule)
  }

  const isDraft = strategy.status === 'draft'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Workout day detail modal ── */}
      {openWorkoutDay && (
        <WorkoutDayPanel day={openWorkoutDay} onClose={() => setOpenWorkoutDay(null)} />
      )}

      {/* ── Remove reason modal ── */}
      {removeTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(5,5,6,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => { setRemoveTarget(null); setSelectedReason('') }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0E0E10', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 28, maxWidth: 420, width: '100%',
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                Remove session
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F7', lineHeight: 1.35 }}>
                Why are you removing <span style={{ color: '#FF9B87' }}>{removeTarget.session}</span>?
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
              {REMOVE_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: selectedReason === r.value ? 'rgba(127,213,170,0.1)' : 'rgba(255,255,255,0.03)',
                    border: selectedReason === r.value ? '1px solid rgba(127,213,170,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    textAlign: 'left', width: '100%', transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selectedReason === r.value ? '#7FD5AA' : '#F5F5F7' }}>{r.label}</div>
                    {!r.affectsAdherence && (
                      <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 1 }}>Won&apos;t count against adherence</div>
                    )}
                  </div>
                  {selectedReason === r.value && (
                    <span style={{ color: '#7FD5AA', fontSize: 14 }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleConfirmRemove}
                disabled={!selectedReason || savingRemoval}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  cursor: selectedReason ? 'pointer' : 'not-allowed',
                  background: selectedReason ? 'rgba(255,138,138,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedReason ? 'rgba(255,138,138,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  color: selectedReason ? '#FF9B87' : '#4A4845',
                  opacity: savingRemoval ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {savingRemoval ? <Spinner size={13} color="#FF9B87" strokeWidth={2} /> : null}
                {savingRemoval ? 'Saving…' : 'Confirm Removal'}
              </button>
              <button
                onClick={() => { setRemoveTarget(null); setSelectedReason('') }}
                style={{ padding: '11px 18px', borderRadius: 9, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Draft activation panel ── */}
      {isDraft && (
        <div style={{
          padding: '20px 24px',
          background: 'rgba(236,198,102,0.06)',
          border: '2px solid rgba(236,198,102,0.25)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ECC666', marginBottom: 8 }}>
            Draft — Review before activating
          </div>
          <p style={{ fontSize: 14, color: '#A1A1A6', lineHeight: 1.6, margin: '0 0 16px' }}>
            This strategy is ready for review. Read through all sections below, then activate it to make it operational — or adjust first.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={activate}
              disabled={activating}
              className="btn-motion"
              style={{
                padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.4)', color: '#7FD5AA',
                opacity: activating ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {activating && <Spinner size={13} color="#7FD5AA" strokeWidth={2} />}
              {activating ? 'Activating…' : '✓ Activate This Strategy'}
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6' }}
            >
              Make More Realistic
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6' }}
            >
              Make More Ambitious
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6' }}
            >
              Adjust Frequency
            </button>

            {/* Discard draft */}
            <div style={{ marginLeft: 'auto' }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#ECC666' }}>Discard this draft?</span>
                  <button
                    onClick={deleteStrategy}
                    disabled={deleting}
                    className="btn-motion"
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', background: 'rgba(255,155,135,0.15)',
                      border: '1px solid rgba(255,155,135,0.4)', color: '#FF9B87',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {deleting ? <Spinner size={12} color="#FF9B87" strokeWidth={2} /> : null}
                    Yes, discard
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="btn-motion"
                    style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn-motion"
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E73' }}
                >
                  Discard Draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Objective ── */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(127,213,170,0.07)',
        border: `1px solid ${isDraft ? 'rgba(127,213,170,0.15)' : 'rgba(127,213,170,0.25)'}`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7FD5AA', marginBottom: 8 }}>
            Quarterly Objective
          </div>
          {!isDraft && (
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(127,213,170,0.15)', color: '#7FD5AA', border: '1px solid rgba(127,213,170,0.3)', fontWeight: 700 }}>
              Active
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F7', lineHeight: 1.5, marginBottom: 8 }}>{strategy.mainObjective}</div>
        <div style={{ fontSize: 11, color: '#6E6E73' }}>
          Created {new Date(strategy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── 4 plan cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {sp && (
          <SectionCard title="Strength Training" accent="#7FD5AA">
            <DefRow label="Sessions" value={sp.sessionsPerWeek ? `${sp.sessionsPerWeek}× / week` : null} accent="#7FD5AA" />
            <DefRow label="Split" value={sp.split} />
            <DefRow label="Emphasis" value={sp.emphasis} />
            <DefRow label="Duration" value={sp.sessionDuration} />
            <DefRow label="Priority" value={sp.focusPriority} />
            {sp.notes && (
              <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <BulletText text={sp.notes} />
              </div>
            )}
          </SectionCard>
        )}

        {nutr && (
          <SectionCard title="Nutrition Direction" accent="#ECC666">
            <DefRow label="Approach" value={nutr.approach} />
            <DefRow label="Protein" value={nutr.proteinTarget ? `${nutr.proteinTarget}g / day` : null} accent="#7FD5AA" />
            <DefRow label="Calories" value={nutr.caloricTracking ? 'Tracking' : 'Not tracking'} />
            <DefRow label="Meal plan" value={nutr.mealPlanLinked ? 'Linked to Project Hanh' : null} accent="#B8A4FF" />
            <DefRow label="Key rule" value={nutr.keyRule} />
            {nutr.rationale && (
              <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <BulletText text={nutr.rationale} />
              </div>
            )}
          </SectionCard>
        )}

        {cp && cp.included !== false && (
          <SectionCard title="Cardio & Movement" accent="#80BDFF">
            <DefRow label="Sessions" value={cp.sessionsPerWeek ? `${cp.sessionsPerWeek}× / week` : null} accent="#80BDFF" />
            <DefRow label="Type" value={cp.type} />
            <DefRow label="Duration" value={cp.duration} />
            <DefRow label="Walking" value={cp.walkingTarget} />
            {cp.notes && (
              <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <BulletText text={cp.notes} />
              </div>
            )}
          </SectionCard>
        )}

        {sauna && sauna.included !== false && (
          <SectionCard title="Sauna & Recovery" accent="#F5A56A">
            <DefRow label="Sessions" value={sauna.sessionsPerWeek ? `${sauna.sessionsPerWeek}× / week` : null} accent="#F5A56A" />
            <DefRow label="Days" value={Array.isArray(sauna.days) ? sauna.days.join(', ') : sauna.days} />
            <DefRow label="Duration" value={sauna.duration} />
            {sauna.integration && (
              <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <BulletText text={sauna.integration} />
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── Weekly Progress Status ── */}
      {weeklySchedule.length > 0 && (
        <WeeklyStatusBar
          schedule={weeklySchedule}
          completedKeys={completedKeys}
          removedKeys={removedKeys}
          weeklyTargets={weeklyTargets}
        />
      )}

      {/* ── Feedback banner ── */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 10,
          background: feedback.type === 'warn' ? 'rgba(236,198,102,0.08)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${feedback.type === 'warn' ? 'rgba(236,198,102,0.2)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.2)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          <span style={{ fontSize: 13, color: feedback.type === 'warn' ? '#ECC666' : feedback.type === 'protect' ? '#7FD5AA' : '#A1A1A6' }}>{feedback.text}</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
            {undoState && (
              <button onClick={handleUndo} style={{ fontSize: 12, color: '#7FD5AA', background: 'none', border: '1px solid rgba(127,213,170,0.3)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>Undo</button>
            )}
            <button onClick={() => setFeedback(null)} style={{ fontSize: 12, color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* ── Weekly Schedule ── */}
      {weeklySchedule.length > 0 && (
        <div className="card" onClick={() => actionMenuKey && setActionMenuKey(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#A1A1A6', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              Weekly Schedule
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {savingSchedule && <span style={{ fontSize: 11, color: '#6E6E73' }}>Saving…</span>}
              <span style={{ fontSize: 11, color: '#6E6E73' }}>Drag to reschedule · ⋯ for actions</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weeklySchedule.map((day, di) => (
              <div
                key={di}
                onDragOver={e => { e.preventDefault(); setDragOverDay(di) }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={() => handleDrop(di)}
              >
                {/* Day label */}
                <div style={{
                  fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textAlign: 'center',
                  color: dragOverDay === di ? '#B8A4FF' : '#6E6E73', transition: 'color 0.1s',
                }}>
                  {day.day?.slice(0, 3).toUpperCase()}
                </div>

                {/* Session cards */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 5, minHeight: 40,
                  borderRadius: 8, padding: dragOverDay === di ? 3 : 0,
                  background: dragOverDay === di ? 'rgba(184,164,255,0.06)' : 'transparent',
                  border: dragOverDay === di ? '1px dashed rgba(184,164,255,0.3)' : '1px solid transparent',
                  transition: 'all 0.1s',
                }}>
                  {(day.sessions ?? []).map((session, si) => {
                    const labelKey = `${day.day}:${session}`
                    const isCompleted = completedKeys.has(labelKey)
                    const isRemoved   = removedKeys.has(labelKey)
                    const isDragging  = dragSource?.dayIdx === di && dragSource?.sessionIdx === si
                    const matchedWorkout = workoutByLabel.get(session.toLowerCase())
                    const sessionType = classifySession(session)
                    const typeColor = sessionType === 'strength' ? '#7FD5AA' : sessionType === 'cardio' ? '#80BDFF' : sessionType === 'sauna' ? '#F5A56A' : '#B8A4FF'
                    const isMenuOpen = actionMenuKey === labelKey

                    return (
                      <div
                        key={si}
                        draggable={!isRemoved && !isCompleted}
                        onDragStart={() => handleDragStart(di, si)}
                        onDragEnd={() => { setDragSource(null); setDragOverDay(null) }}
                        style={{
                          position: 'relative',
                          padding: '7px 8px',
                          borderRadius: 8,
                          background: isCompleted
                            ? 'rgba(127,213,170,0.1)'
                            : isRemoved
                              ? 'rgba(255,255,255,0.02)'
                              : isDragging
                                ? 'rgba(184,164,255,0.2)'
                                : 'rgba(255,255,255,0.04)',
                          border: isCompleted
                            ? '1px solid rgba(127,213,170,0.3)'
                            : isRemoved
                              ? '1px solid rgba(255,255,255,0.05)'
                              : `1px solid ${typeColor}28`,
                          opacity: isDragging ? 0.5 : isRemoved ? 0.4 : 1,
                          cursor: isRemoved ? 'default' : matchedWorkout ? 'pointer' : 'grab',
                          userSelect: 'none',
                          transition: 'opacity 0.12s, background 0.12s',
                        }}
                      >
                        {/* Session name */}
                        <div
                          onClick={() => !isRemoved && matchedWorkout && setOpenWorkoutDay(matchedWorkout)}
                          style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, color: isCompleted ? '#7FD5AA' : isRemoved ? '#4A4845' : '#F5F5F7', textDecoration: isRemoved ? 'line-through' : 'none' }}
                        >
                          {isCompleted && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}
                          {session}
                        </div>

                        {/* Type indicator dot */}
                        {!isRemoved && (
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: typeColor, position: 'absolute', top: 6, right: matchedWorkout ? 18 : 6 }} />
                        )}

                        {/* View workout arrow for matched workouts */}
                        {!isRemoved && matchedWorkout && (
                          <div onClick={() => setOpenWorkoutDay(matchedWorkout)} style={{ position: 'absolute', top: 5, right: 6, fontSize: 9, color: typeColor, opacity: 0.7 }}>↗</div>
                        )}

                        {/* ⋯ action menu button */}
                        {!isRemoved && (
                          <button
                            onClick={e => { e.stopPropagation(); setActionMenuKey(isMenuOpen ? null : labelKey) }}
                            style={{
                              position: 'absolute', bottom: 4, right: 4,
                              width: 18, height: 14, background: 'none', border: 'none',
                              cursor: 'pointer', color: '#6E6E73', fontSize: 11, lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                            }}
                          >⋯</button>
                        )}

                        {/* Action menu popup */}
                        {isMenuOpen && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              position: 'absolute', top: '100%', left: 0, zIndex: 200,
                              background: '#1A1916', border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                              minWidth: 180, padding: '6px 0', marginTop: 3,
                            }}
                          >
                            {matchedWorkout && (
                              <ActionMenuItem icon="📋" label="View workout" onClick={() => { setOpenWorkoutDay(matchedWorkout); setActionMenuKey(null) }} />
                            )}
                            <ActionMenuItem
                              icon={isCompleted ? '↩' : '✓'}
                              label={isCompleted ? 'Unmark done' : 'Mark as done'}
                              onClick={() => handleMarkDone(labelKey, session, day.day)}
                              color="#7FD5AA"
                            />
                            <ActionMenuItem icon="🔄" label="Replace with lighter" onClick={() => { handleRemoveClick(labelKey, session, day.day); }} />
                            <ActionMenuItem icon="✕" label="Remove this week" onClick={() => handleRemoveClick(labelKey, session, day.day)} color="#FF9B87" />
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
                            <ActionMenuItem icon="🗑" label="Remove from plan" onClick={() => { setSelectedReason('remove_from_plan'); handleRemoveClick(labelKey, session, day.day) }} color="#FF9B87" />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {(!day.sessions || day.sessions.length === 0) && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', textAlign: 'center', padding: '6px 0' }}>Rest</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Weekly Targets ── */}
      {weeklyTargets && (
        <div className="card">
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#A1A1A6', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Weekly Targets
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {weeklyTargets.strength && <DefRow label="Strength" value={weeklyTargets.strength} accent="#7FD5AA" />}
            {weeklyTargets.cardio && <DefRow label="Cardio" value={weeklyTargets.cardio} accent="#80BDFF" />}
            {weeklyTargets.sauna && <DefRow label="Sauna" value={weeklyTargets.sauna} accent="#F5A56A" />}
            {weeklyTargets.protein && <DefRow label="Protein" value={weeklyTargets.protein} accent="#ECC666" />}
            {weeklyTargets.bodyMetricCadence && <DefRow label="Check-in" value={weeklyTargets.bodyMetricCadence} />}
          </div>
        </div>
      )}

      {/* ── Workout Plan ── */}
      {workoutPlan && workoutPlan.days?.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#7FD5AA', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Training Plan — Exercise Detail
          </h2>
          <p style={{ fontSize: 12, color: '#6E6E73', marginBottom: 16 }}>
            Click any workout below to see the full exercise list. Tap schedule chips above to open from the weekly view.
          </p>

          {/* Progression + tracking rules */}
          {(workoutPlan.progressionRule || workoutPlan.trackingNote) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {workoutPlan.progressionRule && (
                <div style={{ padding: '10px 12px', background: 'rgba(127,213,170,0.06)', borderRadius: 8, border: '1px solid rgba(127,213,170,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7FD5AA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Progression rule</div>
                  <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.55 }}>{workoutPlan.progressionRule}</p>
                </div>
              )}
              {workoutPlan.trackingNote && (
                <div style={{ padding: '10px 12px', background: 'rgba(184,164,255,0.06)', borderRadius: 8, border: '1px solid rgba(184,164,255,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#B8A4FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Track every session</div>
                  <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.55 }}>{workoutPlan.trackingNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Workout day cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {workoutPlan.days.map((wd, i) => (
              <div
                key={i}
                onClick={() => setOpenWorkoutDay(wd)}
                style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(127,213,170,0.06)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(127,213,170,0.2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#F5F5F7' }}>{wd.label}</div>
                    <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>{wd.theme}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#7FD5AA', opacity: 0.7 }}>↗</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {wd.exercises.slice(0, 4).map((ex, ei) => (
                    <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#A1A1A6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                        {ex.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#7FD5AA', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                        {ex.sets}×{ex.reps}
                      </span>
                    </div>
                  ))}
                  {wd.exercises.length > 4 && (
                    <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>
                      +{wd.exercises.length - 4} more exercises
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 12-Week Roadmap ── */}
      {roadmap.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#A1A1A6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            12-Week Execution Roadmap
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roadmap.map((phase, i) => (
              <RoadmapPhase key={i} phase={phase} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tracking + Decision ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {trackingMetrics.length > 0 && (
          <SectionCard title="Tracking Metrics" accent="#B8A4FF">
            {trackingMetrics.map((metric, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < trackingMetrics.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                <span style={{ color: '#7FD5AA', fontSize: 10, flexShrink: 0 }}>◦</span>
                <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.5 }}>{metric}</span>
              </div>
            ))}
          </SectionCard>
        )}
        {strategy.decisionRules && (
          <SectionCard title="Decision Rules" accent="#B8A4FF">
            <NumberedText text={strategy.decisionRules} />
          </SectionCard>
        )}
      </div>

      {/* ── Risks ── */}
      {strategy.risks && (
        <div className="card" style={{ borderLeft: '3px solid rgba(236,198,102,0.4)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#ECC666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Risks
          </h2>
          <BulletText text={strategy.risks} />
        </div>
      )}

      {/* ── Immediate Next Steps ── */}
      {nextSteps.length > 0 && (
        <div style={{
          padding: '20px 24px', borderRadius: 12,
          background: 'rgba(184,164,255,0.06)',
          border: '1px solid rgba(184,164,255,0.2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B8A4FF', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Immediate Next Steps
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextSteps.map((nextStep, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'rgba(184,164,255,0.15)',
                  border: '1px solid rgba(184,164,255,0.3)', color: '#B8A4FF',
                  fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: '#F5F5F7', lineHeight: 1.6 }}>{nextStep}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Delete strategy (active) ── */}
      {!isDraft && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#ECC666' }}>Delete this strategy permanently?</span>
              <button
                onClick={deleteStrategy}
                disabled={deleting}
                className="btn-motion"
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', background: 'rgba(255,155,135,0.15)',
                  border: '1px solid rgba(255,155,135,0.4)', color: '#FF9B87',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {deleting ? <Spinner size={12} color="#FF9B87" strokeWidth={2} /> : null}
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-motion"
                style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-motion"
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#6E6E73' }}
            >
              Delete Strategy
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function tryParse(s: string | null | undefined) {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}
