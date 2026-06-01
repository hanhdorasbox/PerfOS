'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'

// ─── Types ─────────────────────────────────────────────────────────────────────

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

interface RemoveTarget { labelKey: string; session: string; day: string; sessionType: string }
interface UndoState { id: string; labelKey: string; label: string }
interface FeedbackState { text: string; type: 'ok' | 'warn' | 'protect' }

const REMOVE_REASONS = [
  { value: 'cannot_this_week',         label: 'Cannot do it this week',           affectsAdherence: true },
  { value: 'replace_lighter',          label: 'Replacing with something lighter',  affectsAdherence: false },
  { value: 'plan_too_much',            label: 'Plan is too much right now',        affectsAdherence: false },
  { value: 'already_done_equivalent',  label: 'Already did something equivalent',  affectsAdherence: false },
  { value: 'remove_from_plan',         label: 'Remove from plan permanently',      affectsAdherence: true },
  { value: 'moving_to_other_day',      label: 'Moving it to another day',          affectsAdherence: false },
  { value: 'other',                    label: 'Other reason',                       affectsAdherence: true },
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

function tryParse(s: string | null | undefined) {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

const BODY_METRIC_PATTERN = /\b(waist|circumference|body composition|body measurement|baseline|current weight|reduce weight|kg target|cm target)\b/i

// Returns the short display title for the objective card.
// Priority: objectiveShort → derived short title → safe fallback.
// Never shows a full paragraph or body-metric language.
function getDisplayObjective(strategy: FitnessStrategy): string {
  // 1. Use explicit short field if clean
  if (strategy.objectiveShort && !BODY_METRIC_PATTERN.test(strategy.objectiveShort)) {
    return strategy.objectiveShort
  }
  // 2. If objectiveShort has body-metric language, derive from plans
  const sp = tryParse(strategy.strengthPlan)
  const cp = tryParse(strategy.cardioPlan)
  const parts: string[] = []
  if (sp?.sessionsPerWeek) parts.push(`${sp.sessionsPerWeek}× strength`)
  if (cp?.sessionsPerWeek) parts.push(`${cp.sessionsPerWeek}× cardio`)
  if (parts.length > 0) return `12-week plan · ${parts.join(', ')}.`
  // 3. Last resort clean fallback
  return '12-week fitness execution plan.'
}

interface ChecklistItem {
  id: string
  title: string
  orderIndex: number
  completed: boolean
  completedAt: string | null
}

interface FitnessStrategy {
  id: string
  userId?: string
  mainObjective: string
  objectiveShort?: string | null
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
  checklistItems?: ChecklistItem[]
}

interface Props { strategy: FitnessStrategy }

// ─── Sub-components ─────────────────────────────────────────────────────────────

function DefRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '3px 14px', alignItems: 'start', paddingBottom: 10 }}>
      <span style={{ fontSize: 10, color: '#52525A', fontWeight: 500, letterSpacing: '0.04em', paddingTop: 2, lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: accent || '#9E9EA6', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}

function BulletText({ text, color = '#9E9EA6' }: { text: string; color?: string }) {
  if (!text) return null
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean)
    if (sentences.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sentences.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: '#80BDFF', fontSize: 10, marginTop: 3, flexShrink: 0, opacity: 0.7 }}>•</span>
              <span style={{ fontSize: 12, color, lineHeight: 1.6 }}>{s.trim()}</span>
            </div>
          ))}
        </div>
      )
    }
    return <span style={{ fontSize: 12, color, lineHeight: 1.6 }}>{text}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {lines.map((line, i) => {
        const clean = line.replace(/^[•\-\*\d+\.]\s*/, '')
        return (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ color: '#80BDFF', fontSize: 10, marginTop: 3, flexShrink: 0, opacity: 0.7 }}>•</span>
            <span style={{ fontSize: 12, color, lineHeight: 1.6 }}>{clean}</span>
          </div>
        )
      })}
    </div>
  )
}

function NumberedText({ text, color = '#9E9EA6' }: { text: string; color?: string }) {
  if (!text) return null
  const lines = text.split(/\n|(?=\d+\.\s)/).map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean)
    if (sentences.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sentences.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: '#B8A4FF', fontSize: 10, fontWeight: 600, flexShrink: 0, minWidth: 18, opacity: 0.8, marginTop: 2 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color, lineHeight: 1.6 }}>{s.trim()}</span>
            </div>
          ))}
        </div>
      )
    }
    return <span style={{ fontSize: 12, color, lineHeight: 1.6 }}>{text}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map((line, i) => {
        const clean = line.replace(/^\d+\.\s*/, '')
        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: '#B8A4FF', fontSize: 10, fontWeight: 600, flexShrink: 0, minWidth: 18, opacity: 0.8, marginTop: 2 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, color, lineHeight: 1.6 }}>{clean}</span>
          </div>
        )
      })}
    </div>
  )
}

interface RoadmapPhaseData {
  phase: string; weekRange: string; title: string; purpose: string
  focus: string[]; execute: string[]; monitor: string; decisionPoint: string
}

function RoadmapPhase({ phase, index }: { phase: RoadmapPhaseData; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${open ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.06)'}`, transition: 'border-color 0.2s ease' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: open ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.018)', border: 'none', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.18s ease' }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,164,255,0.08)', border: '1px solid rgba(184,164,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#B8A4FF' }}>{index + 1}</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.04em', marginBottom: 2 }}>{phase.weekRange}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#EEEEF2', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{phase.title}</div>
          </div>
        </div>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#52525A', fontSize: 9 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '6px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: '#7E7E88', lineHeight: 1.68, margin: 0, paddingTop: 8 }}>{phase.purpose}</p>
          {phase.focus?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 8 }}>Focus areas</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phase.focus.map((f, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '3px 11px', borderRadius: 999, background: 'rgba(184,164,255,0.07)', color: '#B8A4FF', border: '1px solid rgba(184,164,255,0.15)' }}>{f}</span>
                ))}
              </div>
            </div>
          )}
          {phase.execute?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 8 }}>Execute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {phase.execute.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#7FD5AA', fontSize: 11, marginTop: 2, flexShrink: 0, opacity: 0.6 }}>→</span>
                    <span style={{ fontSize: 13, color: '#8E8E96', lineHeight: 1.58 }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '11px 14px', background: 'rgba(128,189,255,0.04)', borderRadius: 14, border: '1px solid rgba(128,189,255,0.11)' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#80BDFF', letterSpacing: '0.04em', marginBottom: 6, opacity: 0.8 }}>Monitor</div>
              <p style={{ fontSize: 12, color: '#7E7E88', margin: 0, lineHeight: 1.58 }}>{phase.monitor}</p>
            </div>
            <div style={{ padding: '11px 14px', background: 'rgba(221,185,106,0.04)', borderRadius: 14, border: '1px solid rgba(221,185,106,0.11)' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#DDB96A', letterSpacing: '0.04em', marginBottom: 6, opacity: 0.8 }}>Decision point</div>
              <p style={{ fontSize: 12, color: '#7E7E88', margin: 0, lineHeight: 1.58 }}>{phase.decisionPoint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkoutDayPanel({ day, onClose }: { day: WorkoutDay; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,4,6,0.86)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: 28, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 5 }}>{day.theme}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#EEEEF2', letterSpacing: '-0.02em' }}>{day.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E76', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '7px 10px', borderRadius: 10 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {day.exercises.map((ex, i) => (
            <div key={i} style={{ padding: '13px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: ex.notes || ex.substitution ? 6 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#EEEEF2', letterSpacing: '-0.005em' }}>{ex.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7FD5AA', background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.18)', padding: '2px 10px', borderRadius: 999, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {ex.sets} × {ex.reps}
                </span>
              </div>
              {ex.notes && <div style={{ fontSize: 12, color: '#52525A', lineHeight: 1.55 }}>{ex.notes}</div>}
              {ex.substitution && <div style={{ fontSize: 11, color: '#B8A4FF', marginTop: 5, opacity: 0.8 }}>↔ {ex.substitution}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActionMenuItem({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: color ?? '#9E9EA6', borderRadius: 6, transition: 'background 0.1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
      <span style={{ fontSize: 12, flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ─── Weekly status chips ──────────────────────────────────────────────────────

function WeeklyChips({ schedule, completedKeys, removedKeys, weeklyTargets }: {
  schedule: { day: string; sessions: string[] }[]
  completedKeys: Set<string>
  removedKeys: Set<string>
  weeklyTargets: Record<string, string> | null
}) {
  const counts = { strength: 0, cardio: 0, sauna: 0, walk: 0 }
  const completed = { strength: 0, cardio: 0, sauna: 0, walk: 0 }

  for (const day of schedule) {
    for (const s of (day.sessions ?? [])) {
      const type = classifySession(s)
      const lk = `${day.day}:${s}`
      counts[type]++
      if (completedKeys.has(lk)) completed[type]++
    }
  }

  function parseTarget(val: string | null | undefined): number | null {
    if (!val) return null
    const m = val.match(/(\d+)/)
    return m ? parseInt(m[1]) : null
  }

  const items = [
    { label: 'Strength', type: 'strength', planned: parseTarget(weeklyTargets?.strength) ?? counts.strength, done: completed.strength, color: '#7FD5AA' },
    counts.cardio > 0 && { label: 'Cardio', type: 'cardio', planned: parseTarget(weeklyTargets?.cardio) ?? counts.cardio, done: completed.cardio, color: '#80BDFF' },
    counts.sauna > 0 && { label: 'Sauna', type: 'sauna', planned: parseTarget(weeklyTargets?.sauna) ?? counts.sauna, done: completed.sauna, color: '#E8966A' },
    counts.walk > 0 && { label: 'Walks', type: 'walk', planned: counts.walk, done: completed.walk, color: '#B8A4FF' },
    weeklyTargets?.protein && { label: 'Protein', type: 'protein', planned: 7, done: 0, color: '#DDB96A' },
  ].filter(Boolean) as { label: string; type: string; planned: number; done: number; color: string }[]

  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {items.map(item => (
        <div key={item.type} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '4px 11px', borderRadius: 999,
          background: `${item.color}0D`, border: `1px solid ${item.color}22`,
          fontSize: 12,
        }}>
          <span style={{ color: '#52525A' }}>{item.label}</span>
          <span style={{ fontWeight: 600, color: item.done >= item.planned ? item.color : '#EEEEF2' }}>
            {item.done}<span style={{ color: '#3E3E44', fontWeight: 400 }}>/{item.planned}</span>
          </span>
          {item.done > 0 && (
            <div style={{ width: 28, height: 2.5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(1, item.done / item.planned) * 100}%`, background: item.color, borderRadius: 99 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Strategy pillar card ──────────────────────────────────────────────────────

function PillarCard({ title, accent, children, rationale }: {
  title: string; accent: string; children: React.ReactNode; rationale?: string
}) {
  const [showWhy, setShowWhy] = useState(false)
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.75, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: accent, letterSpacing: '0.03em', opacity: 0.9 }}>{title}</span>
        </div>
        {rationale && (
          <button onClick={() => setShowWhy(v => !v)}
            style={{ fontSize: 10, color: '#44444A', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6E6E76')}
            onMouseLeave={e => (e.currentTarget.style.color = '#44444A')}>
            {showWhy ? 'Hide' : 'Rationale'}
          </button>
        )}
      </div>
      {children}
      {showWhy && rationale && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <BulletText text={rationale} color="#52525A" />
        </div>
      )}
    </div>
  )
}

// ─── Adjust Frequency Modal ───────────────────────────────────────────────────

interface FreqConfig {
  strength: number | string
  cardio: number | string
  sauna: number | string
  walkTarget: string
  sessionDuration: string
}

function AdjustFreqModal({ current, onClose, onApply, loading }: {
  current: FreqConfig
  onClose: () => void
  onApply: (cfg: FreqConfig) => void
  loading: boolean
}) {
  const [cfg, setCfg] = useState<FreqConfig>(current)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,4,6,0.86)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#EEEEF2', marginBottom: 4, letterSpacing: '-0.01em' }}>Adjust Frequency</div>
        <p style={{ fontSize: 13, color: '#52525A', marginBottom: 24, lineHeight: 1.5 }}>Change weekly targets. Strategy will be recalculated.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { label: 'Strength sessions / week', key: 'strength', min: 1, max: 6 },
            { label: 'Cardio sessions / week', key: 'cardio', min: 0, max: 5 },
            { label: 'Sauna / recovery sessions / week', key: 'sauna', min: 0, max: 5 },
          ].map(({ label, key, min, max }) => (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setCfg(c => ({ ...c, [key]: Math.max(min, Number(c[key as keyof FreqConfig]) - 1) }))}
                  style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9E9EA6', cursor: 'pointer', fontSize: 16, transition: 'background 0.12s' }}>−</button>
                <div style={{ width: 48, textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#EEEEF2', fontVariantNumeric: 'tabular-nums' }}>{cfg[key as keyof FreqConfig]}</div>
                <button onClick={() => setCfg(c => ({ ...c, [key]: Math.min(max, Number(c[key as keyof FreqConfig]) + 1) }))}
                  style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9E9EA6', cursor: 'pointer', fontSize: 16, transition: 'background 0.12s' }}>+</button>
              </div>
            </div>
          ))}

          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 8 }}>Walking target</div>
            <input value={cfg.walkTarget} onChange={e => setCfg(c => ({ ...c, walkTarget: e.target.value }))}
              className="input-apple" placeholder="e.g. 8000 steps/day" />
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 8 }}>Session duration</div>
            <input value={cfg.sessionDuration} onChange={e => setCfg(c => ({ ...c, sessionDuration: e.target.value }))}
              className="input-apple" placeholder="e.g. 60–75 min" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => onApply(cfg)} disabled={loading}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'rgba(128,189,255,0.12)', border: '1px solid rgba(128,189,255,0.26)', color: '#80BDFF', opacity: loading ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.14s' }}>
            {loading && <Spinner size={13} color="#80BDFF" strokeWidth={2} />}
            {loading ? 'Recalculating…' : 'Recalculate Strategy'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 12, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E76' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

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

  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set())
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set())
  const [actionMenuKey, setActionMenuKey] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [savingRemoval, setSavingRemoval] = useState(false)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const weekId = getWeekId()

  // DB-backed checklist — loaded from API, not from local React state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    strategy.checklistItems ?? []
  )
  const [checklistLoaded, setChecklistLoaded] = useState(!!strategy.checklistItems)
  const [stepsDismissed, setStepsDismissed] = useState(() => {
    // Persist dismissed state in localStorage so it survives refresh
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`fitness-setup-dismissed-${strategy.id}`) === 'true'
  })

  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [showFreqModal, setShowFreqModal] = useState(false)

  const sp    = tryParse(strategy.strengthPlan)
  const cp    = tryParse(strategy.cardioPlan)
  const sauna = tryParse(strategy.saunaPlan)
  const nutr  = tryParse(strategy.nutritionDir)
  const weeklyTargets  = tryParse(strategy.weeklyTargets)
  const trackingMetrics: string[] = tryParse(strategy.trackingMetrics) ?? []
  const roadmap: RoadmapPhaseData[] = tryParse(strategy.roadmap) ?? []
  const workoutPlan: WorkoutPlan | null = tryParse(strategy.workoutPlan)

  const workoutByLabel = new Map<string, WorkoutDay>()
  if (workoutPlan?.days) {
    for (const d of workoutPlan.days) workoutByLabel.set(d.label.toLowerCase(), d)
  }

  const isDraft = strategy.status === 'draft'

  // Filter out body-metric tasks from checklist display (don't show weight/waist tasks)
  const visibleChecklist = checklistItems.filter(
    item => !BODY_METRIC_PATTERN.test(item.title)
  )
  const allStepsDone = visibleChecklist.length > 0 && visibleChecklist.every(i => i.completed)
  const showNextSteps = visibleChecklist.length > 0 && !stepsDismissed && checklistLoaded

  // Auto-dismiss checklist 1.8s after all steps complete
  useEffect(() => {
    if (allStepsDone && !stepsDismissed) {
      const timer = setTimeout(() => {
        setStepsDismissed(true)
        localStorage.setItem(`fitness-setup-dismissed-${strategy.id}`, 'true')
      }, 1800)
      return () => clearTimeout(timer)
    }
  }, [allStepsDone, stepsDismissed, strategy.id])

  // Load checklist from DB on mount (unless already passed as initial data)
  useEffect(() => {
    if (checklistLoaded) return
    fetch(`/api/fitness/checklist?strategyId=${strategy.id}`)
      .then(r => r.json())
      .then((items: ChecklistItem[]) => {
        if (Array.isArray(items)) setChecklistItems(items)
        setChecklistLoaded(true)
      })
      .catch(() => setChecklistLoaded(true))
  }, [strategy.id, checklistLoaded])

  useEffect(() => {
    if (!strategy.userId) return
    fetch(`/api/fitness/schedule-change?userId=${strategy.userId}&weekId=${weekId}`)
      .then(r => r.json())
      .then((changes: Array<{ id: string; sessionLabel: string; sessionDay: string; action: string; reason?: string | null; undone: boolean }>) => {
        if (!Array.isArray(changes)) return
        const removed = new Set<string>()
        const compl = new Set<string>()
        const permanentlyRemoved = new Set<string>() // sessions with remove_from_plan

        for (const c of changes) {
          if (c.undone) continue
          const lk = `${c.sessionDay}:${c.sessionLabel}`
          if (c.action === 'completed') {
            compl.add(lk)
          } else if (c.reason === 'remove_from_plan') {
            // Permanent removal — track session name (not day:session) so we
            // clean ALL instances across all days
            permanentlyRemoved.add(c.sessionLabel)
          } else {
            removed.add(lk)
          }
        }

        setRemovedKeys(removed)
        setCompletedKeys(compl)

        // Retroactively clean permanently-removed sessions that are still in schedule
        if (permanentlyRemoved.size > 0) {
          setSchedule(prev => {
            const hasStale = prev.some(d =>
              (d.sessions ?? []).some(s => permanentlyRemoved.has(s))
            )
            if (!hasStale) return prev
            const cleaned = prev.map(d => ({
              ...d,
              sessions: (d.sessions ?? []).filter(s => !permanentlyRemoved.has(s)),
            }))
            // Persist cleaned schedule to DB (fire-and-forget)
            fetch('/api/fitness/strategy/update', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ strategyId: strategy.id, weeklySchedule: cleaned }),
            }).catch(() => {})
            return cleaned
          })
        }
      })
      .catch(() => {})
  }, [strategy.userId, strategy.id, weekId])

  async function activate() {
    setActivating(true)
    try {
      await fetch('/api/fitness/strategy/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: strategy.userId, strategyId: strategy.id }) })
      router.refresh()
    } finally { setActivating(false) }
  }

  async function deleteStrategy() {
    setDeleting(true)
    try {
      await fetch(`/api/fitness/strategy/${strategy.id}`, { method: 'DELETE' })
      router.refresh()
    } finally { setDeleting(false) }
  }

  async function adjustStrategy(mode: string, freqConfig?: FreqConfig) {
    setAdjusting(mode)
    setAdjustError(null)
    try {
      const res = await fetch('/api/fitness/strategy/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, mode, frequencyConfig: freqConfig }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Adjustment failed')
      setShowFreqModal(false)
      router.refresh()
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setAdjusting(null) }
  }

  async function persistSchedule(newSchedule: { day: string; sessions: string[] }[]) {
    setSavingSchedule(true)
    try {
      await fetch('/api/fitness/strategy/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategyId: strategy.id, weeklySchedule: newSchedule }) })
    } finally { setSavingSchedule(false) }
  }

  const handleMarkDone = useCallback(async (labelKey: string, session: string, day: string) => {
    setActionMenuKey(null)
    const isAlreadyDone = completedKeys.has(labelKey)
    try {
      if (isAlreadyDone) {
        setCompletedKeys(prev => { const n = new Set(prev); n.delete(labelKey); return n })
      } else {
        setCompletedKeys(prev => new Set([...prev, labelKey]))
        await fetch('/api/fitness/schedule-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: strategy.userId, weekId, sessionLabel: session, sessionDay: day, sessionType: classifySession(session), action: 'completed', reason: null }) })
        setFeedback({ text: `${session} marked as done.`, type: 'ok' })
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
      const isPermanent = selectedReason === 'remove_from_plan'

      if (isPermanent) {
        // ── Permanent removal: strip ALL instances of this session name from
        //    every day in the schedule and save to DB immediately. ──────────────
        const sessionName = removeTarget.session
        const newSchedule = schedule.map(d => ({
          ...d,
          sessions: (d.sessions ?? []).filter(s => s !== sessionName),
        }))
        setSchedule(newSchedule)
        await persistSchedule(newSchedule)

        // Log the change for history (no undo for permanent removal)
        await fetch('/api/fitness/schedule-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: strategy.userId,
            weekId,
            sessionLabel: sessionName,
            sessionDay: removeTarget.day,
            sessionType: removeTarget.sessionType,
            action: 'removed',
            reason: 'remove_from_plan',
          }),
        })

        setFeedback({ text: `"${sessionName}" permanently removed from plan.`, type: 'ok' })
        setTimeout(() => setFeedback(null), 4000)
      } else {
        // ── Weekly removal: mark faded for this week only (existing behaviour) ─
        const res = await fetch('/api/fitness/schedule-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: strategy.userId,
            weekId,
            sessionLabel: removeTarget.session,
            sessionDay: removeTarget.day,
            sessionType: removeTarget.sessionType,
            action: selectedReason === 'moving_to_other_day' ? 'rescheduled' : 'removed',
            reason: selectedReason,
          }),
        })
        const data = await res.json() as { id: string }
        setRemovedKeys(prev => new Set([...prev, removeTarget.labelKey]))
        const allOfType = schedule.flatMap(d => (d.sessions ?? []).map(s => ({ type: classifySession(s), lk: `${d.day}:${s}` }))).filter(x => x.type === removeTarget.sessionType)
        const remaining = allOfType.filter(x => !removedKeys.has(x.lk) && x.lk !== removeTarget.labelKey).length
        const type = removeTarget.sessionType
        let impactText = ''
        if (type === 'strength') impactText = remaining <= 1 ? `Strength drops to ${remaining} session this week.` : `Strength: ${remaining} sessions remaining this week.`
        else if (type === 'cardio') impactText = `Cardio: ${remaining} session${remaining !== 1 ? 's' : ''} remaining this week.`
        else impactText = 'Session removed.'
        setFeedback({ text: impactText, type: remaining <= 1 && type === 'strength' ? 'warn' : selectedReason === 'plan_too_much' ? 'protect' : 'ok' })
        setUndoState({ id: data.id, labelKey: removeTarget.labelKey, label: removeTarget.session })
        setTimeout(() => setUndoState(null), 8000)
      }

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

  function handleDrop(targetDayIdx: number) {
    if (!dragSource) return
    const { dayIdx: srcDay, sessionIdx: srcSession } = dragSource
    if (srcDay === targetDayIdx) { setDragSource(null); setDragOverDay(null); return }
    const newSchedule = schedule.map(d => ({ ...d, sessions: [...d.sessions] }))
    const [session] = newSchedule[srcDay].sessions.splice(srcSession, 1)
    newSchedule[targetDayIdx].sessions.push(session)
    setSchedule(newSchedule); setDragSource(null); setDragOverDay(null)
    persistSchedule(newSchedule)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Modals ── */}
      {openWorkoutDay && <WorkoutDayPanel day={openWorkoutDay} onClose={() => setOpenWorkoutDay(null)} />}

      {showFreqModal && (
        <AdjustFreqModal
          current={{ strength: sp?.sessionsPerWeek ?? 3, cardio: cp?.sessionsPerWeek ?? 2, sauna: sauna?.sessionsPerWeek ?? 2, walkTarget: cp?.walkingTarget ?? '', sessionDuration: sp?.sessionDuration ?? '' }}
          onClose={() => setShowFreqModal(false)}
          onApply={(cfg) => adjustStrategy('frequency', cfg)}
          loading={adjusting === 'frequency'}
        />
      )}

      {removeTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,4,6,0.86)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setRemoveTarget(null); setSelectedReason('') }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', marginBottom: 6 }}>Remove session</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#EEEEF2', lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                Why are you removing <span style={{ color: '#E8907A' }}>{removeTarget.session}</span>?
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
              {REMOVE_REASONS.map(r => (
                <button key={r.value} onClick={() => setSelectedReason(r.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, cursor: 'pointer', background: selectedReason === r.value ? 'rgba(127,213,170,0.07)' : 'rgba(255,255,255,0.025)', border: selectedReason === r.value ? '1px solid rgba(127,213,170,0.28)' : '1px solid rgba(255,255,255,0.06)', textAlign: 'left', width: '100%', transition: 'all 0.14s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: selectedReason === r.value ? '#7FD5AA' : '#EEEEF2', letterSpacing: '-0.005em' }}>{r.label}</div>
                    {!r.affectsAdherence && <div style={{ fontSize: 10, color: '#44444A', marginTop: 2 }}>Won&apos;t count against adherence</div>}
                  </div>
                  {selectedReason === r.value && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6.5" stroke="#7FD5AA" strokeOpacity="0.5" />
                      <path d="M4.5 7L6.5 9L9.5 5" stroke="#7FD5AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleConfirmRemove} disabled={!selectedReason || savingRemoval}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: selectedReason ? 'pointer' : 'not-allowed', background: selectedReason ? 'rgba(232,144,122,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedReason ? 'rgba(232,144,122,0.28)' : 'rgba(255,255,255,0.06)'}`, color: selectedReason ? '#E8907A' : '#3E3E44', opacity: savingRemoval ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.14s' }}>
                {savingRemoval && <Spinner size={13} color="#E8907A" strokeWidth={2} />}
                {savingRemoval ? 'Saving…' : 'Confirm Removal'}
              </button>
              <button onClick={() => { setRemoveTarget(null); setSelectedReason('') }}
                style={{ padding: '11px 18px', borderRadius: 12, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6E6E76' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ A. DRAFT REVIEW BAR ══════════════════════════════════════════════════ */}
      {isDraft && (
        <div style={{ padding: '18px 22px', background: 'rgba(221,185,106,0.05)', border: '1px solid rgba(221,185,106,0.18)', borderRadius: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#DDB96A', marginBottom: 14, opacity: 0.9 }}>
            Draft — Review before activating
          </div>

          {adjustError && (
            <div style={{ marginBottom: 12, padding: '9px 14px', background: 'rgba(232,144,122,0.07)', border: '1px solid rgba(232,144,122,0.2)', borderRadius: 12, fontSize: 12, color: '#E8907A' }}>
              {adjustError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={activate} disabled={activating} className="btn-motion"
              style={{ padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'rgba(127,213,170,0.10)', border: '1px solid rgba(127,213,170,0.28)', color: '#7FD5AA', opacity: activating ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s' }}>
              {activating && <Spinner size={13} color="#7FD5AA" strokeWidth={2} />}
              {activating ? 'Activating…' : 'Activate'}
            </button>

            <button onClick={() => adjustStrategy('realistic')} disabled={!!adjusting} className="btn-motion"
              style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7E7E88', opacity: adjusting === 'realistic' ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              {adjusting === 'realistic' && <Spinner size={12} color="#7E7E88" strokeWidth={2} />}
              {adjusting === 'realistic' ? 'Adjusting…' : '↓ More Realistic'}
            </button>

            <button onClick={() => adjustStrategy('ambitious')} disabled={!!adjusting} className="btn-motion"
              style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7E7E88', opacity: adjusting === 'ambitious' ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              {adjusting === 'ambitious' && <Spinner size={12} color="#7E7E88" strokeWidth={2} />}
              {adjusting === 'ambitious' ? 'Adjusting…' : '↑ More Ambitious'}
            </button>

            <button onClick={() => setShowFreqModal(true)} disabled={!!adjusting} className="btn-motion"
              style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, cursor: 'pointer', background: 'rgba(128,189,255,0.06)', border: '1px solid rgba(128,189,255,0.18)', color: '#80BDFF', opacity: 0.9, transition: 'all 0.15s' }}>
              Adjust Frequency
            </button>

            <div style={{ marginLeft: 'auto' }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#DDB96A' }}>Discard this draft?</span>
                  <button onClick={deleteStrategy} disabled={deleting} className="btn-motion"
                    style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'rgba(232,144,122,0.10)', border: '1px solid rgba(232,144,122,0.26)', color: '#E8907A', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {deleting && <Spinner size={12} color="#E8907A" strokeWidth={2} />}
                    Yes, discard
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-motion"
                    style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6E6E76' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="btn-motion"
                  style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#52525A' }}>
                  Discard Draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ B. QUARTERLY OBJECTIVE ═══════════════════════════════════════════════ */}
      <div style={{
        padding: '22px 26px',
        background: 'rgba(255,255,255,0.018)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: '3px solid rgba(127,213,170,0.4)',
        borderRadius: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525A' }}>
            Quarterly Objective
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#3E3E44' }}>
              {new Date(strategy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 999, background: isDraft ? 'rgba(221,185,106,0.09)' : 'rgba(127,213,170,0.09)', color: isDraft ? '#DDB96A' : '#7FD5AA', border: `1px solid ${isDraft ? 'rgba(221,185,106,0.20)' : 'rgba(127,213,170,0.20)'}`, fontWeight: 500, letterSpacing: '0.02em' }}>
              {isDraft ? 'Draft' : 'Active'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#EEEEF2', lineHeight: 1.52, letterSpacing: '-0.015em' }}>
          {getDisplayObjective(strategy)}
        </div>
      </div>

      {/* ══ C. IMMEDIATE NEXT STEPS ══════════════════════════════════════════════ */}
      {showNextSteps && (
        <div style={{
          padding: '18px 22px', borderRadius: 22,
          background: allStepsDone ? 'rgba(127,213,170,0.05)' : 'rgba(184,164,255,0.05)',
          border: `1px solid ${allStepsDone ? 'rgba(127,213,170,0.18)' : 'rgba(184,164,255,0.14)'}`,
          transition: 'all 0.4s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: allStepsDone ? 0 : 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: allStepsDone ? '#7FD5AA' : '#B8A4FF', letterSpacing: '0.04em' }}>
              {allStepsDone ? 'Initial Setup Complete' : 'Immediate Next Steps'}
            </div>
            <button
              onClick={() => {
                setStepsDismissed(true)
                localStorage.setItem(`fitness-setup-dismissed-${strategy.id}`, 'true')
              }}
              style={{ fontSize: 11, color: '#3E3E44', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
            >
              {allStepsDone ? 'Dismiss' : '✕'}
            </button>
          </div>
          {!allStepsDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleChecklist.map(item => (
                <label key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <div
                    onClick={async () => {
                      const newCompleted = !item.completed
                      // Optimistic UI update
                      setChecklistItems(prev => prev.map(i =>
                        i.id === item.id ? { ...i, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null } : i
                      ))
                      // Persist to DB
                      await fetch('/api/fitness/checklist', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: item.id, completed: newCompleted }),
                      }).catch(() => {})
                    }}
                    style={{
                      width: 20, height: 20, borderRadius: 7, flexShrink: 0, marginTop: 1,
                      background: item.completed ? 'rgba(127,213,170,0.15)' : 'transparent',
                      border: item.completed ? '1.5px solid rgba(127,213,170,0.45)' : '1.5px solid rgba(255,255,255,0.10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.16s', cursor: 'pointer',
                    }}
                  >
                    {item.completed && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#7FD5AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: item.completed ? '#52525A' : '#EEEEF2', lineHeight: 1.55, textDecoration: item.completed ? 'line-through' : 'none', transition: 'all 0.16s', letterSpacing: '-0.005em' }}>
                    {item.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ D. THIS WEEK SCHEDULE + CHIPS ════════════════════════════════════════ */}
      {schedule.length > 0 && (
        <div className="card" onClick={() => actionMenuKey && setActionMenuKey(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 11, fontWeight: 500, color: '#6E6E76', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
              This Week
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {savingSchedule && <span style={{ fontSize: 10, color: '#52525A' }}>Saving…</span>}
              <span style={{ fontSize: 10, color: '#3E3E44' }}>Drag to reschedule</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {schedule.map((day, di) => (
              <div key={di}
                onDragOver={e => { e.preventDefault(); setDragOverDay(di) }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={() => handleDrop(di)}>
                <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 7, letterSpacing: '0.07em', textAlign: 'center', color: dragOverDay === di ? '#B8A4FF' : '#44444A', textTransform: 'uppercase', transition: 'color 0.12s' }}>
                  {day.day?.slice(0, 3)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 40, borderRadius: 10, padding: dragOverDay === di ? 3 : 0, background: dragOverDay === di ? 'rgba(184,164,255,0.05)' : 'transparent', border: dragOverDay === di ? '1px dashed rgba(184,164,255,0.25)' : '1px solid transparent', transition: 'all 0.12s' }}>
                  {(day.sessions ?? []).map((session, si) => {
                    const labelKey = `${day.day}:${session}`
                    const isCompleted = completedKeys.has(labelKey)
                    const isRemoved = removedKeys.has(labelKey)
                    const isDragging = dragSource?.dayIdx === di && dragSource?.sessionIdx === si
                    const matchedWorkout = workoutByLabel.get(session.toLowerCase())
                    const sessionType = classifySession(session)
                    const typeColor = sessionType === 'strength' ? '#7FD5AA' : sessionType === 'cardio' ? '#80BDFF' : sessionType === 'sauna' ? '#E8966A' : '#B8A4FF'
                    const isMenuOpen = actionMenuKey === labelKey

                    return (
                      <div key={si} draggable={!isRemoved && !isCompleted}
                        onDragStart={() => setDragSource({ dayIdx: di, sessionIdx: si })}
                        onDragEnd={() => { setDragSource(null); setDragOverDay(null) }}
                        style={{ position: 'relative', padding: '8px 9px', borderRadius: 10, background: isCompleted ? 'rgba(127,213,170,0.07)' : isRemoved ? 'rgba(255,255,255,0.013)' : isDragging ? 'rgba(184,164,255,0.14)' : 'rgba(255,255,255,0.03)', border: isCompleted ? '1px solid rgba(127,213,170,0.20)' : isRemoved ? '1px solid rgba(255,255,255,0.04)' : `1px solid ${typeColor}1E`, opacity: isDragging ? 0.5 : isRemoved ? 0.35 : 1, cursor: isRemoved ? 'default' : matchedWorkout ? 'pointer' : 'grab', userSelect: 'none', transition: 'opacity 0.14s, background 0.14s' }}>
                        <div onClick={() => !isRemoved && matchedWorkout && setOpenWorkoutDay(matchedWorkout)}
                          style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.35, color: isCompleted ? '#7FD5AA' : isRemoved ? '#3A3A3E' : '#E4E4EA', textDecoration: isRemoved ? 'line-through' : 'none', letterSpacing: '-0.005em' }}>
                          {isCompleted && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ marginRight: 4, verticalAlign: 'middle', opacity: 0.8 }}>
                              <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#7FD5AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                          {session}
                        </div>
                        {!isRemoved && <div style={{ width: 4, height: 4, borderRadius: '50%', background: typeColor, position: 'absolute', top: 7, right: matchedWorkout ? 17 : 7, opacity: 0.7 }} />}
                        {!isRemoved && matchedWorkout && <div onClick={() => setOpenWorkoutDay(matchedWorkout)} style={{ position: 'absolute', top: 5, right: 6, fontSize: 8, color: typeColor, opacity: 0.55 }}>↗</div>}
                        {!isRemoved && (
                          <button onClick={e => { e.stopPropagation(); setActionMenuKey(isMenuOpen ? null : labelKey) }}
                            style={{ position: 'absolute', bottom: 4, right: 4, width: 18, height: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#44444A', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>⋯</button>
                        )}
                        {isMenuOpen && (
                          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.65)', minWidth: 180, padding: '5px', marginTop: 4 }}>
                            {matchedWorkout && <ActionMenuItem icon="↗" label="View workout" onClick={() => { setOpenWorkoutDay(matchedWorkout); setActionMenuKey(null) }} />}
                            <ActionMenuItem icon={isCompleted ? '↩' : '✓'} label={isCompleted ? 'Unmark done' : 'Mark as done'} onClick={() => handleMarkDone(labelKey, session, day.day)} color="#7FD5AA" />
                            <ActionMenuItem icon="↓" label="Replace with lighter" onClick={() => handleRemoveClick(labelKey, session, day.day)} />
                            <ActionMenuItem icon="✕" label="Remove this week" onClick={() => handleRemoveClick(labelKey, session, day.day)} color="#E8907A" />
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                            <ActionMenuItem icon="—" label="Remove from plan" onClick={() => { setSelectedReason('remove_from_plan'); handleRemoveClick(labelKey, session, day.day) }} color="#E8907A" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {(!day.sessions || day.sessions.length === 0) && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.08)', textAlign: 'center', padding: '7px 0' }}>Rest</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <WeeklyChips schedule={schedule} completedKeys={completedKeys} removedKeys={removedKeys} weeklyTargets={weeklyTargets} />
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 14, background: feedback.type === 'warn' ? 'rgba(221,185,106,0.06)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${feedback.type === 'warn' ? 'rgba(221,185,106,0.18)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.18)' : 'rgba(255,255,255,0.07)'}` }}>
          <span style={{ fontSize: 13, color: feedback.type === 'warn' ? '#DDB96A' : feedback.type === 'protect' ? '#7FD5AA' : '#9E9EA6' }}>{feedback.text}</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
            {undoState && <button onClick={handleUndo} style={{ fontSize: 12, color: '#7FD5AA', background: 'none', border: '1px solid rgba(127,213,170,0.25)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}>Undo</button>}
            <button onClick={() => setFeedback(null)} style={{ fontSize: 12, color: '#52525A', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* ══ E. TRAINING PLAN ═════════════════════════════════════════════════════ */}
      {workoutPlan && workoutPlan.days?.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontSize: 11, fontWeight: 500, color: '#7FD5AA', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, opacity: 0.85 }}>
              Training Plan
            </h2>
            <span style={{ fontSize: 11, color: '#3E3E44' }}>Tap any day to see exercises</span>
          </div>

          {(workoutPlan.progressionRule || workoutPlan.trackingNote) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {workoutPlan.progressionRule && (
                <div style={{ padding: '12px 14px', background: 'rgba(127,213,170,0.04)', borderRadius: 14, border: '1px solid rgba(127,213,170,0.11)' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#7FD5AA', letterSpacing: '0.04em', marginBottom: 6, opacity: 0.75 }}>Progression rule</div>
                  <p style={{ fontSize: 12, color: '#7E7E88', margin: 0, lineHeight: 1.6 }}>{workoutPlan.progressionRule}</p>
                </div>
              )}
              {workoutPlan.trackingNote && (
                <div style={{ padding: '12px 14px', background: 'rgba(184,164,255,0.04)', borderRadius: 14, border: '1px solid rgba(184,164,255,0.11)' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#B8A4FF', letterSpacing: '0.04em', marginBottom: 6, opacity: 0.75 }}>Track every session</div>
                  <p style={{ fontSize: 12, color: '#7E7E88', margin: 0, lineHeight: 1.6 }}>{workoutPlan.trackingNote}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
            {workoutPlan.days.map((wd, i) => (
              <div key={i} onClick={() => setOpenWorkoutDay(wd)}
                style={{ padding: '16px 18px', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.18s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(127,213,170,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(127,213,170,0.15)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.022)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#EEEEF2', letterSpacing: '-0.015em' }}>{wd.label}</div>
                    <div style={{ fontSize: 11, color: '#52525A', marginTop: 3 }}>{wd.theme}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#7FD5AA', opacity: 0.45, marginTop: 2 }}>↗</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {wd.exercises.slice(0, 4).map((ex, ei) => (
                    <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: '#7E7E88', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{ex.name}</span>
                      <span style={{ fontSize: 10.5, color: '#7FD5AA', fontWeight: 600, flexShrink: 0, marginLeft: 8, opacity: 0.8 }}>{ex.sets}×{ex.reps}</span>
                    </div>
                  ))}
                  {wd.exercises.length > 4 && <div style={{ fontSize: 10, color: '#44444A', marginTop: 2 }}>+{wd.exercises.length - 4} more</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ F. STRATEGY PILLARS ══════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {sp && (
          <PillarCard title="Strength Training" accent="#7FD5AA" rationale={sp.notes}>
            <DefRow label="Sessions" value={sp.sessionsPerWeek ? `${sp.sessionsPerWeek}× / week` : null} accent="#7FD5AA" />
            <DefRow label="Split" value={sp.split} />
            <DefRow label="Emphasis" value={sp.emphasis} />
            <DefRow label="Duration" value={sp.sessionDuration} />
            <DefRow label="Priority" value={sp.focusPriority} />
          </PillarCard>
        )}

        {nutr && (
          <PillarCard title="Nutrition Direction" accent="#DDB96A" rationale={nutr.rationale}>
            <DefRow label="Approach" value={nutr.approach} />
            <DefRow label="Protein" value={nutr.proteinTarget ? `${nutr.proteinTarget}g / day` : null} accent="#7FD5AA" />
            <DefRow label="Calories" value={nutr.caloricTracking ? 'Tracking' : 'Protein only'} />
            {nutr.mealPlanLinked && <DefRow label="Meal plan" value="Linked" accent="#B8A4FF" />}
            <DefRow label="Key rule" value={nutr.keyRule} />
          </PillarCard>
        )}

        {cp && cp.included !== false && (
          <PillarCard title="Cardio & Movement" accent="#80BDFF" rationale={cp.notes}>
            <DefRow label="Sessions" value={cp.sessionsPerWeek ? `${cp.sessionsPerWeek}× / week` : null} accent="#80BDFF" />
            <DefRow label="Type" value={cp.type} />
            <DefRow label="Duration" value={cp.duration} />
            <DefRow label="Walking" value={cp.walkingTarget} />
          </PillarCard>
        )}

        {sauna && sauna.included !== false && (
          <PillarCard title="Sauna & Recovery" accent="#E8966A" rationale={sauna.integration}>
            <DefRow label="Sessions" value={sauna.sessionsPerWeek ? `${sauna.sessionsPerWeek}× / week` : null} accent="#E8966A" />
            <DefRow label="Days" value={Array.isArray(sauna.days) ? sauna.days.join(', ') : sauna.days} />
            <DefRow label="Duration" value={sauna.duration} />
          </PillarCard>
        )}
      </div>

      {/* ══ G. 12-WEEK ROADMAP ════════════════════════════════════════════════════ */}
      {roadmap.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            12-Week Roadmap
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {roadmap.map((phase, i) => <RoadmapPhase key={i} phase={phase} index={i} />)}
          </div>
        </div>
      )}

      {/* ══ H. TRACKING + DECISION RULES ══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {trackingMetrics.length > 0 && (
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A4FF', opacity: 0.7 }} />
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#B8A4FF', margin: 0, letterSpacing: '0.03em', opacity: 0.9 }}>
                Tracking Metrics
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {trackingMetrics.map((metric, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < trackingMetrics.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'flex-start' }}>
                  <span style={{ color: '#B8A4FF', fontSize: 9, flexShrink: 0, marginTop: 4, opacity: 0.5 }}>◦</span>
                  <span style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.5, letterSpacing: '-0.005em' }}>{metric}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {strategy.decisionRules && (
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A4FF', opacity: 0.7 }} />
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#B8A4FF', margin: 0, letterSpacing: '0.03em', opacity: 0.9 }}>
                Decision Rules
              </h2>
            </div>
            <NumberedText text={strategy.decisionRules} />
          </div>
        )}
      </div>

      {/* ══ I. RISKS ═════════════════════════════════════════════════════════════ */}
      {strategy.risks && (
        <div className="card" style={{ padding: '18px 22px', borderLeft: '3px solid rgba(221,185,106,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DDB96A', opacity: 0.7 }} />
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#DDB96A', margin: 0, letterSpacing: '0.03em', opacity: 0.85 }}>
              Risks
            </h2>
          </div>
          <BulletText text={strategy.risks} color="#7E7E88" />
        </div>
      )}

      {/* ── Delete strategy (active) ── */}
      {!isDraft && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#DDB96A' }}>Delete this strategy permanently?</span>
              <button onClick={deleteStrategy} disabled={deleting} className="btn-motion"
                style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'rgba(232,144,122,0.10)', border: '1px solid rgba(232,144,122,0.26)', color: '#E8907A', display: 'flex', alignItems: 'center', gap: 6 }}>
                {deleting && <Spinner size={12} color="#E8907A" strokeWidth={2} />}
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-motion"
                style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#6E6E76' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="btn-motion"
              style={{ padding: '6px 14px', borderRadius: 10, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#44444A' }}>
              Delete Strategy
            </button>
          )}
        </div>
      )}
    </div>
  )
}
