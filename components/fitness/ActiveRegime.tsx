'use client'
import { useState, useEffect, useCallback, type ReactNode } from 'react'

interface FitnessStrategy {
  id: string
  mainObjective: string
  strengthPlan: string | null
  cardioPlan: string | null
  saunaPlan: string | null
  nutritionDir: string | null
  weeklySchedule: string | null
  trackingMetrics: string | null
  risks: string | null
  decisionRules: string | null
  status: string
  createdAt: string
  quarterId: string | null
}

interface Props {
  strategy: FitnessStrategy | null
  isDraft?: boolean
  userId: string
}

interface PlanBlock {
  sessionsPerWeek?: number; type?: string; split?: string; duration?: string
  days?: string | string[]; approach?: string; proteinTarget?: number
  caloricTracking?: boolean; mealPlanLinked?: boolean; keyRule?: string
  [key: string]: unknown
}

interface ScheduleDay {
  day: string; activity: string; sessionList: string[]
  [key: string]: unknown
}

interface RemoveTarget { key: string; session: string; day: string; sessionType: string }
interface UndoState { id: string; key: string; label: string }

const REMOVE_REASONS = [
  { value: 'cannot_this_week', label: 'Cannot do it this week', emoji: '📅', affectsAdherence: true },
  { value: 'replace_lighter', label: 'Replacing with something lighter', emoji: '🔄', affectsAdherence: false },
  { value: 'plan_too_much', label: 'Plan is too much right now', emoji: '😤', affectsAdherence: false },
  { value: 'already_done_equivalent', label: 'Already did something equivalent', emoji: '✅', affectsAdherence: false },
  { value: 'remove_from_plan', label: 'Remove from my plan permanently', emoji: '🗑', affectsAdherence: true },
  { value: 'moving_to_other_day', label: 'Moving it to another day', emoji: '📆', affectsAdherence: false },
  { value: 'other', label: 'Other reason', emoji: '💬', affectsAdherence: true },
]

function parsePlan(raw: string | null): PlanBlock | null {
  if (!raw) return null
  try { return JSON.parse(raw) as PlanBlock } catch { return { type: raw } }
}

function parseSchedule(raw: string | null): ScheduleDay[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>[]).map(item => {
        const rawSessions = Array.isArray(item.sessions) ? item.sessions as string[] : null
        const rawActivity = item.activity as string | undefined
        const sessionList: string[] = rawSessions
          ? rawSessions
          : rawActivity ? rawActivity.split(',').map((s: string) => s.trim()).filter(Boolean) : []
        return { ...(item as ScheduleDay), day: item.day as string, activity: rawActivity || (rawSessions ? rawSessions.join(', ') : ''), sessionList }
      })
    }
    return Object.entries(parsed).map(([day, activity]) => ({
      day, activity: String(activity),
      sessionList: String(activity).split(',').map(s => s.trim()).filter(Boolean),
    }))
  } catch { return [] }
}

function parseSessionText(session: string): { activity: string; detail?: string } {
  const parenMatch = session.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) return { activity: parenMatch[1].trim(), detail: parenMatch[2].trim() }
  const durationMatch = session.match(/^(.+?)\s+(\d+\s*min(?:utes?)?)\s*$/i)
  if (durationMatch) return { activity: durationMatch[1].trim(), detail: durationMatch[2].replace(/\s+/, ' ') }
  return { activity: session }
}

function detectSessionType(session: string): string {
  const lower = session.toLowerCase()
  if (/sauna/.test(lower)) return 'sauna'
  if (/cardio|run|cycle|swim|rowing/.test(lower)) return 'cardio'
  if (/walk|steps|stroll/.test(lower)) return 'walk'
  if (/recover|stretch|yoga|mobility|foam/.test(lower)) return 'recovery'
  return 'strength'
}

function getWeekId(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return mon.toISOString().split('T')[0]
}

function calcImpactMessage(session: string, sessionType: string, removedKeys: Set<string>, schedule: ScheduleDay[]): string {
  const allOfType = schedule.flatMap((d, di) =>
    d.sessionList.map((s, si) => ({ key: `${di}:${si}`, type: detectSessionType(s) }))
  ).filter(x => x.type === sessionType)
  const remaining = allOfType.filter(x => !removedKeys.has(x.key)).length

  if (sessionType === 'strength') {
    if (remaining <= 1) return `⚠️ Strength drops to ${remaining} session this week — below target.`
    if (remaining === 2) return `Strength: ${remaining} sessions this week. Target is typically 3. Consider rescheduling.`
    return `Strength: ${remaining} sessions remaining this week. Still on track.`
  }
  if (sessionType === 'cardio') return `Cardio: ${remaining} session${remaining !== 1 ? 's' : ''} remaining this week.`
  if (sessionType === 'sauna') return `Sauna removed. Recovery target may still be met via other protocols.`
  if (sessionType === 'walk') return `Walk removed. Consider adding steps later in the day.`
  return `Session removed from this week's schedule.`
}

function renderPlanBlock(label: string, plan: PlanBlock | null, icon: string): ReactNode {
  if (!plan) return null
  let bullets: string[]
  if (label === 'Nutrition') {
    bullets = []
    if (plan.approach) bullets.push(plan.approach as string)
    if (plan.proteinTarget) bullets.push(`${plan.proteinTarget}g protein / day`)
    else if ((plan as { targetProtein?: number }).targetProtein) bullets.push(`${(plan as { targetProtein?: number }).targetProtein}g protein / day`)
    if (plan.keyRule) bullets.push(plan.keyRule as string)
    if (bullets.length === 0) bullets.push('Nutrition plan active')
  } else {
    bullets = []
    if (plan.sessionsPerWeek) bullets.push(`${plan.sessionsPerWeek}× per week`)
    if (plan.split) bullets.push(plan.split as string)
    if (plan.type) bullets.push(plan.type as string)
    if (plan.duration) bullets.push(`${plan.duration}`)
    if (plan.days) { const daysVal = plan.days; bullets.push(Array.isArray(daysVal) ? daysVal.join(', ') : String(daysVal)) }
    if (bullets.length === 0) bullets.push('Plan active')
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#76746E', paddingTop: 2 }}>{icon} {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 9, color: '#4A8A6E', flexShrink: 0, marginTop: 3, fontWeight: 700 }}>•</span>
            <span style={{ fontSize: 12, color: '#B8B6B0', lineHeight: 1.4 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ActiveRegime({ strategy, isDraft, userId }: Props) {
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set())
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; type: 'ok' | 'warn' | 'protect' } | null>(null)

  const weekId = getWeekId()

  // Load this week's removals on mount
  useEffect(() => {
    if (!userId) return
    fetch(`/api/fitness/schedule-change?userId=${userId}&weekId=${weekId}`)
      .then(r => r.json())
      .then((changes: Array<{ id: string; sessionLabel: string; sessionDay: string; undone: boolean }>) => {
        if (!Array.isArray(changes)) return
        // We can't perfectly reconstruct keys without the original schedule, but we can mark sessions
        // by label+day match — handled in schedule render via removedLabels
        setRemovedKeys(new Set(changes.filter(c => !c.undone).map(c => `${c.sessionDay}:${c.sessionLabel}`)))
      })
      .catch(() => {})
  }, [userId, weekId])

  const schedule = parseSchedule(strategy?.weeklySchedule ?? null)

  const handleRemoveClick = useCallback((key: string, session: string, day: string) => {
    setRemoveTarget({ key, session, day, sessionType: detectSessionType(session) })
    setSelectedReason('')
  }, [])

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget || !selectedReason) return
    setSaving(true)
    try {
      const res = await fetch('/api/fitness/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          weekId,
          sessionLabel: removeTarget.session,
          sessionDay: removeTarget.day,
          sessionType: removeTarget.sessionType,
          action: selectedReason === 'moving_to_other_day' ? 'rescheduled' : 'removed',
          reason: selectedReason,
        }),
      })
      const data = await res.json() as { id: string }

      const labelKey = `${removeTarget.day}:${removeTarget.session}`
      setRemovedKeys(prev => new Set([...prev, labelKey]))

      // Compute impact message
      const newRemoved = new Set([...removedKeys, labelKey])
      const impactText = calcImpactMessage(removeTarget.session, removeTarget.sessionType, newRemoved, schedule)
      const feedbackType = impactText.startsWith('⚠') ? 'warn' : selectedReason === 'plan_too_much' ? 'protect' : 'ok'
      setFeedback({ text: impactText, type: feedbackType })

      setUndoState({ id: data.id, key: labelKey, label: removeTarget.session })
      setTimeout(() => { setUndoState(null) }, 8000)

      setRemoveTarget(null)
      setSelectedReason('')
    } catch { /* silent */ }
    finally { setSaving(false) }
  }, [removeTarget, selectedReason, userId, weekId, removedKeys, schedule])

  const handleUndo = useCallback(async () => {
    if (!undoState) return
    try {
      await fetch('/api/fitness/schedule-change', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: undoState.id }),
      })
      setRemovedKeys(prev => { const next = new Set(prev); next.delete(undoState.key); return next })
      setFeedback(null)
    } catch { /* silent */ }
    setUndoState(null)
  }, [undoState])

  if (!strategy) {
    return (
      <div className="card" style={{ borderLeft: '2px solid rgba(107,227,164,0.2)' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: 10 }}>
          Current Quarterly Fitness Regime
        </div>
        <div style={{ fontSize: 13, color: '#76746E', fontStyle: 'italic' }}>
          No active fitness strategy.{' '}
          <a href="/fitness/strategy" style={{ color: '#6BE3A4', textDecoration: 'none' }}>
            Generate one at Fitness Strategy page.
          </a>
        </div>
      </div>
    )
  }

  const strengthPlan = parsePlan(strategy.strengthPlan)
  const cardioPlan = parsePlan(strategy.cardioPlan)
  const saunaPlan = parsePlan(strategy.saunaPlan)
  const nutritionPlan = parsePlan(strategy.nutritionDir)

  return (
    <div className="card" style={{ borderLeft: `2px solid ${isDraft ? 'rgba(242,192,99,0.4)' : 'rgba(107,227,164,0.3)'}` }}>
      {isDraft && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 14, borderRadius: 8, background: 'rgba(242,192,99,0.07)', border: '1px solid rgba(242,192,99,0.2)' }}>
          <span style={{ fontSize: 12, color: '#F2C063' }}>⚠ Draft strategy — review and activate to make it operational</span>
          <a href="/fitness/strategy" style={{ fontSize: 12, color: '#F2C063', textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>Review & Activate →</a>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDraft ? '#F2C063' : '#76746E', marginBottom: 4 }}>
            {isDraft ? 'Draft Fitness Strategy' : 'Current Quarterly Fitness Regime'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>{strategy.mainObjective}</div>
        </div>
        <a href="/fitness/strategy" style={{ fontSize: 11, color: isDraft ? '#F2C063' : '#6BE3A4', textDecoration: 'none', padding: '4px 10px', border: `1px solid ${isDraft ? 'rgba(242,192,99,0.2)' : 'rgba(107,227,164,0.2)'}`, borderRadius: 6, flexShrink: 0 }}>
          Full Strategy →
        </a>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {renderPlanBlock('Strength', strengthPlan, '🏋️')}
        {renderPlanBlock('Cardio', cardioPlan, '🏃')}
        {renderPlanBlock('Sauna', saunaPlan, '🔥')}
        {nutritionPlan && renderPlanBlock('Nutrition', nutritionPlan, '🥗')}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', marginBottom: 10, borderRadius: 8,
          background: feedback.type === 'warn' ? 'rgba(242,192,99,0.08)' : feedback.type === 'protect' ? 'rgba(107,227,164,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${feedback.type === 'warn' ? 'rgba(242,192,99,0.2)' : feedback.type === 'protect' ? 'rgba(107,227,164,0.2)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          <span style={{ fontSize: 12, color: feedback.type === 'warn' ? '#F2C063' : feedback.type === 'protect' ? '#6BE3A4' : '#B8B6B0' }}>
            {feedback.text}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            {undoState && (
              <button onClick={handleUndo} style={{ fontSize: 11, color: '#6BE3A4', background: 'none', border: '1px solid rgba(107,227,164,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                Undo
              </button>
            )}
            <button onClick={() => setFeedback(null)} style={{ fontSize: 11, color: '#76746E', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Interactive Weekly schedule */}
      {schedule.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#76746E' }}>
              Weekly Schedule
            </div>
            {removedKeys.size > 0 && (
              <span style={{ fontSize: 10, color: '#76746E' }}>
                {removedKeys.size} removed this week
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
            {schedule.slice(0, 7).map((s, di) => (
              <div key={di} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6BE3A4', marginBottom: 6 }}>{s.day?.slice(0, 3).toUpperCase()}</div>
                {s.sessionList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.sessionList.map((session, si) => {
                      const labelKey = `${s.day}:${session}`
                      const isRemoved = removedKeys.has(labelKey)
                      const itemKey = `${di}:${si}`
                      const isHovered = hoverKey === itemKey
                      const parsed = parseSessionText(session)

                      if (isRemoved) {
                        return (
                          <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: 0.35 }}>
                            <span style={{ fontSize: 9, color: '#76746E', flexShrink: 0, fontWeight: 700 }}>—</span>
                            <span style={{ fontSize: 11, color: '#76746E', textDecoration: 'line-through', lineHeight: 1.3 }}>{parsed.activity}</span>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={si}
                          style={{ display: 'flex', gap: 5, alignItems: 'flex-start', position: 'relative', cursor: 'default' }}
                          onMouseEnter={() => setHoverKey(itemKey)}
                          onMouseLeave={() => setHoverKey(null)}
                        >
                          <span style={{ fontSize: 9, color: '#6BE3A4', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>•</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: '#B8B6B0', lineHeight: 1.3 }}>{parsed.activity}</div>
                            {parsed.detail && <div style={{ fontSize: 10, color: '#76746E', marginTop: 1 }}>{parsed.detail}</div>}
                          </div>
                          {/* × remove button — visible on hover */}
                          {isHovered && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveClick(itemKey, session, s.day) }}
                              title="Remove this session"
                              style={{
                                position: 'absolute', right: -6, top: -2,
                                width: 16, height: 16, borderRadius: '50%',
                                background: 'rgba(255,100,100,0.15)', border: '1px solid rgba(255,100,100,0.3)',
                                color: '#FF6B6B', fontSize: 9, fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                lineHeight: 1, padding: 0, flexShrink: 0,
                              }}
                            >✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#4A4845', fontWeight: 700 }}>—</span>
                    <span style={{ fontSize: 11, color: '#4A4845' }}>Rest</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove reason modal */}
      {removeTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '0 20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setRemoveTarget(null) }}
        >
          <div style={{ background: '#1A1916', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#76746E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Remove Session</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>{parseSessionText(removeTarget.session).activity}</div>
              <div style={{ fontSize: 12, color: '#76746E', marginTop: 2 }}>{removeTarget.day}</div>
            </div>
            <div style={{ fontSize: 12, color: '#B8B6B0', marginBottom: 12 }}>Why are you removing this?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REMOVE_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(prev => prev === r.value ? '' : r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: selectedReason === r.value ? 'rgba(107,227,164,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedReason === r.value ? 'rgba(107,227,164,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{r.emoji}</span>
                  <span style={{ fontSize: 12, color: selectedReason === r.value ? '#6BE3A4' : '#B8B6B0' }}>{r.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRemoveTarget(null)} style={{ flex: 1, padding: '9px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#76746E', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={!selectedReason || saving}
                style={{
                  flex: 1, padding: '9px 0', background: selectedReason ? 'rgba(255,100,100,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedReason ? 'rgba(255,100,100,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, color: selectedReason ? '#FF8A8A' : '#4A4845', fontSize: 13, cursor: selectedReason ? 'pointer' : 'default',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
