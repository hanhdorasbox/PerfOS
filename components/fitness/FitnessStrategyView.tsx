'use client'

import { useState } from 'react'
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
      <span style={{ fontSize: 11, color: '#76746E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingTop: 1, lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: accent || '#FAFAFA', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}

function SectionCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 style={{ fontSize: 13, fontWeight: 700, color: accent || '#B8B6B0', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
          <span style={{ fontSize: 11, fontWeight: 700, color: '#76746E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {phase.weekRange}
          </span>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA', marginTop: 2 }}>
            {phase.phase}: {phase.title}
          </div>
        </div>
        <span style={{ color: '#76746E', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6, margin: 0 }}>{phase.purpose}</p>

          {phase.focus?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#76746E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Focus</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phase.focus.map((f: string, i: number) => (
                  <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'rgba(180,167,229,0.1)', color: '#B4A7E5', border: '1px solid rgba(180,167,229,0.2)' }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase.execute?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#76746E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Execute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.execute.map((e: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#6BE3A4', fontSize: 12, marginTop: 1, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.5 }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: 'rgba(96,165,250,0.06)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>PerfOS monitors</div>
              <p style={{ fontSize: 12, color: '#B8B6B0', margin: 0, lineHeight: 1.5 }}>{phase.monitor}</p>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(242,192,99,0.06)', borderRadius: 8, border: '1px solid rgba(242,192,99,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F2C063', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Decision point</div>
              <p style={{ fontSize: 12, color: '#B8B6B0', margin: 0, lineHeight: 1.5 }}>{phase.decisionPoint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BulletText({ text, color = '#B8B6B0' }: { text: string; color?: string }) {
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
              <span style={{ color: '#60A5FA', fontSize: 11, marginTop: 2, flexShrink: 0 }}>•</span>
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
            <span style={{ color: '#60A5FA', fontSize: 11, marginTop: 2, flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 12, color, lineHeight: 1.55 }}>{clean}</span>
          </div>
        )
      })}
    </div>
  )
}

function NumberedText({ text, color = '#B8B6B0' }: { text: string; color?: string }) {
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
              <span style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
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
            <span style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#76746E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {day.theme}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FAFAFA' }}>{day.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#76746E', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
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
                <span style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA' }}>{ex.name}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#6BE3A4',
                  background: 'rgba(107,227,164,0.1)', border: '1px solid rgba(107,227,164,0.2)',
                  padding: '2px 10px', borderRadius: 999, whiteSpace: 'nowrap', marginLeft: 8,
                }}>
                  {ex.sets} × {ex.reps}
                </span>
              </div>
              {ex.notes && <div style={{ fontSize: 12, color: '#76746E', lineHeight: 1.5 }}>{ex.notes}</div>}
              {ex.substitution && (
                <div style={{ fontSize: 11, color: '#B4A7E5', marginTop: 4 }}>
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

      {/* ── Draft activation panel ── */}
      {isDraft && (
        <div style={{
          padding: '20px 24px',
          background: 'rgba(242,192,99,0.06)',
          border: '2px solid rgba(242,192,99,0.25)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F2C063', marginBottom: 8 }}>
            Draft — Review before activating
          </div>
          <p style={{ fontSize: 14, color: '#B8B6B0', lineHeight: 1.6, margin: '0 0 16px' }}>
            This strategy is ready for review. Read through all sections below, then activate it to make it operational — or adjust first.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={activate}
              disabled={activating}
              className="btn-motion"
              style={{
                padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(107,227,164,0.15)', border: '1px solid rgba(107,227,164,0.4)', color: '#6BE3A4',
                opacity: activating ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {activating && <Spinner size={13} color="#6BE3A4" strokeWidth={2} />}
              {activating ? 'Activating…' : '✓ Activate This Strategy'}
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#B8B6B0' }}
            >
              Make More Realistic
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#B8B6B0' }}
            >
              Make More Ambitious
            </button>
            <button
              onClick={() => {}}
              className="btn-motion"
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#B8B6B0' }}
            >
              Adjust Frequency
            </button>

            {/* Discard draft */}
            <div style={{ marginLeft: 'auto' }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#F2C063' }}>Discard this draft?</span>
                  <button
                    onClick={deleteStrategy}
                    disabled={deleting}
                    className="btn-motion"
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', background: 'rgba(255,107,107,0.15)',
                      border: '1px solid rgba(255,107,107,0.4)', color: '#FF6B6B',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {deleting ? <Spinner size={12} color="#FF6B6B" strokeWidth={2} /> : null}
                    Yes, discard
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="btn-motion"
                    style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#76746E' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn-motion"
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#76746E' }}
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
        background: 'rgba(107,227,164,0.07)',
        border: `1px solid ${isDraft ? 'rgba(107,227,164,0.15)' : 'rgba(107,227,164,0.25)'}`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6BE3A4', marginBottom: 8 }}>
            Quarterly Objective
          </div>
          {!isDraft && (
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(107,227,164,0.15)', color: '#6BE3A4', border: '1px solid rgba(107,227,164,0.3)', fontWeight: 700 }}>
              Active
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#FAFAFA', lineHeight: 1.5, marginBottom: 8 }}>{strategy.mainObjective}</div>
        <div style={{ fontSize: 11, color: '#76746E' }}>
          Created {new Date(strategy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── 4 plan cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {sp && (
          <SectionCard title="Strength Training" accent="#6BE3A4">
            <DefRow label="Sessions" value={sp.sessionsPerWeek ? `${sp.sessionsPerWeek}× / week` : null} accent="#6BE3A4" />
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
          <SectionCard title="Nutrition Direction" accent="#F2C063">
            <DefRow label="Approach" value={nutr.approach} />
            <DefRow label="Protein" value={nutr.proteinTarget ? `${nutr.proteinTarget}g / day` : null} accent="#6BE3A4" />
            <DefRow label="Calories" value={nutr.caloricTracking ? 'Tracking' : 'Not tracking'} />
            <DefRow label="Meal plan" value={nutr.mealPlanLinked ? 'Linked to PerfOS' : null} accent="#B4A7E5" />
            <DefRow label="Key rule" value={nutr.keyRule} />
            {nutr.rationale && (
              <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                <BulletText text={nutr.rationale} />
              </div>
            )}
          </SectionCard>
        )}

        {cp && cp.included !== false && (
          <SectionCard title="Cardio & Movement" accent="#60A5FA">
            <DefRow label="Sessions" value={cp.sessionsPerWeek ? `${cp.sessionsPerWeek}× / week` : null} accent="#60A5FA" />
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
          <SectionCard title="Sauna & Recovery" accent="#FF9F6B">
            <DefRow label="Sessions" value={sauna.sessionsPerWeek ? `${sauna.sessionsPerWeek}× / week` : null} accent="#FF9F6B" />
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

      {/* ── Weekly Schedule ── */}
      {weeklySchedule.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#B8B6B0', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              Weekly Schedule
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {savingSchedule && <span style={{ fontSize: 11, color: '#76746E' }}>Saving…</span>}
              <span style={{ fontSize: 11, color: '#76746E' }}>Drag sessions to reschedule</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weeklySchedule.map((day, i) => (
              <div
                key={i}
                style={{ textAlign: 'center' }}
                onDragOver={e => { e.preventDefault(); setDragOverDay(i) }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={() => handleDrop(i)}
              >
                <div style={{
                  fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em',
                  color: dragOverDay === i ? '#B4A7E5' : '#76746E',
                  transition: 'color 0.1s',
                }}>{day.day?.slice(0, 3).toUpperCase()}</div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  minHeight: 32, borderRadius: 8, padding: 2,
                  background: dragOverDay === i ? 'rgba(180,167,229,0.08)' : 'transparent',
                  border: dragOverDay === i ? '1px dashed rgba(180,167,229,0.3)' : '1px solid transparent',
                  transition: 'all 0.1s',
                }}>
                  {(day.sessions || []).map((session, j) => {
                    const matchedWorkout = workoutByLabel.get(session.toLowerCase())
                    const isDragging = dragSource?.dayIdx === i && dragSource?.sessionIdx === j
                    return (
                      <div
                        key={j}
                        draggable
                        onDragStart={() => handleDragStart(i, j)}
                        onDragEnd={() => { setDragSource(null); setDragOverDay(null) }}
                        onClick={() => matchedWorkout && setOpenWorkoutDay(matchedWorkout)}
                        style={{
                          fontSize: 10, padding: '4px 6px', borderRadius: 6,
                          background: isDragging ? 'rgba(180,167,229,0.25)' : 'rgba(180,167,229,0.1)',
                          color: '#B4A7E5',
                          border: matchedWorkout
                            ? '1px solid rgba(180,167,229,0.4)'
                            : '1px solid rgba(180,167,229,0.2)',
                          lineHeight: 1.3,
                          cursor: matchedWorkout ? 'pointer' : 'grab',
                          userSelect: 'none',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'opacity 0.12s ease, background 0.12s ease',
                          position: 'relative',
                        }}
                      >
                        {session}
                        {matchedWorkout && <span style={{ marginLeft: 3, opacity: 0.6 }}>↗</span>}
                      </div>
                    )
                  })}
                  {(!day.sessions || day.sessions.length === 0) && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', padding: '4px 0' }}>Rest</div>
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
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#B8B6B0', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Weekly Targets
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {weeklyTargets.strength && <DefRow label="Strength" value={weeklyTargets.strength} accent="#6BE3A4" />}
            {weeklyTargets.cardio && <DefRow label="Cardio" value={weeklyTargets.cardio} accent="#60A5FA" />}
            {weeklyTargets.sauna && <DefRow label="Sauna" value={weeklyTargets.sauna} accent="#FF9F6B" />}
            {weeklyTargets.protein && <DefRow label="Protein" value={weeklyTargets.protein} accent="#F2C063" />}
            {weeklyTargets.bodyMetricCadence && <DefRow label="Check-in" value={weeklyTargets.bodyMetricCadence} />}
          </div>
        </div>
      )}

      {/* ── Workout Plan ── */}
      {workoutPlan && workoutPlan.days?.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6BE3A4', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Training Plan — Exercise Detail
          </h2>
          <p style={{ fontSize: 12, color: '#76746E', marginBottom: 16 }}>
            Click any workout below to see the full exercise list. Tap schedule chips above to open from the weekly view.
          </p>

          {/* Progression + tracking rules */}
          {(workoutPlan.progressionRule || workoutPlan.trackingNote) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {workoutPlan.progressionRule && (
                <div style={{ padding: '10px 12px', background: 'rgba(107,227,164,0.06)', borderRadius: 8, border: '1px solid rgba(107,227,164,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6BE3A4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Progression rule</div>
                  <p style={{ fontSize: 12, color: '#B8B6B0', margin: 0, lineHeight: 1.55 }}>{workoutPlan.progressionRule}</p>
                </div>
              )}
              {workoutPlan.trackingNote && (
                <div style={{ padding: '10px 12px', background: 'rgba(180,167,229,0.06)', borderRadius: 8, border: '1px solid rgba(180,167,229,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#B4A7E5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Track every session</div>
                  <p style={{ fontSize: 12, color: '#B8B6B0', margin: 0, lineHeight: 1.55 }}>{workoutPlan.trackingNote}</p>
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
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(107,227,164,0.06)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(107,227,164,0.2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#FAFAFA' }}>{wd.label}</div>
                    <div style={{ fontSize: 11, color: '#76746E', marginTop: 2 }}>{wd.theme}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#6BE3A4', opacity: 0.7 }}>↗</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {wd.exercises.slice(0, 4).map((ex, ei) => (
                    <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#B8B6B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                        {ex.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#6BE3A4', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                        {ex.sets}×{ex.reps}
                      </span>
                    </div>
                  ))}
                  {wd.exercises.length > 4 && (
                    <div style={{ fontSize: 11, color: '#76746E', marginTop: 2 }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B8B6B0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
          <SectionCard title="Tracking Metrics" accent="#B4A7E5">
            {trackingMetrics.map((metric, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < trackingMetrics.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                <span style={{ color: '#6BE3A4', fontSize: 10, flexShrink: 0 }}>◦</span>
                <span style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.5 }}>{metric}</span>
              </div>
            ))}
          </SectionCard>
        )}
        {strategy.decisionRules && (
          <SectionCard title="Decision Rules" accent="#B4A7E5">
            <NumberedText text={strategy.decisionRules} />
          </SectionCard>
        )}
      </div>

      {/* ── Risks ── */}
      {strategy.risks && (
        <div className="card" style={{ borderLeft: '3px solid rgba(242,192,99,0.4)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#F2C063', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Risks
          </h2>
          <BulletText text={strategy.risks} />
        </div>
      )}

      {/* ── Immediate Next Steps ── */}
      {nextSteps.length > 0 && (
        <div style={{
          padding: '20px 24px', borderRadius: 12,
          background: 'rgba(180,167,229,0.06)',
          border: '1px solid rgba(180,167,229,0.2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B4A7E5', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Immediate Next Steps
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextSteps.map((nextStep, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'rgba(180,167,229,0.15)',
                  border: '1px solid rgba(180,167,229,0.3)', color: '#B4A7E5',
                  fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: '#FAFAFA', lineHeight: 1.6 }}>{nextStep}</span>
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
              <span style={{ fontSize: 12, color: '#F2C063' }}>Delete this strategy permanently?</span>
              <button
                onClick={deleteStrategy}
                disabled={deleting}
                className="btn-motion"
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', background: 'rgba(255,107,107,0.15)',
                  border: '1px solid rgba(255,107,107,0.4)', color: '#FF6B6B',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {deleting ? <Spinner size={12} color="#FF6B6B" strokeWidth={2} /> : null}
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-motion"
                style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#76746E' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-motion"
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#76746E' }}
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
