'use client'
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { StrategyLifecycleCompact } from '@/components/fitness/StrategyLifecycle'

interface FitnessStrategy {
  id: string
  mainObjective: string
  objectiveShort?: string | null
  strengthPlan: string | null
  cardioPlan: string | null
  saunaPlan: string | null
  nutritionDir: string | null
  weeklySchedule: string | null
  trackingMetrics: string | null
  risks: string | null
  decisionRules: string | null
  roadmap?: string | null
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
  { value: 'cannot_this_week', label: 'Cannot do it this week', affectsAdherence: true },
  { value: 'replace_lighter', label: 'Replacing with something lighter', affectsAdherence: false },
  { value: 'plan_too_much', label: 'Plan is too much right now', affectsAdherence: false },
  { value: 'already_done_equivalent', label: 'Already did something equivalent', affectsAdherence: false },
  { value: 'remove_from_plan', label: 'Remove from my plan permanently', affectsAdherence: true },
  { value: 'moving_to_other_day', label: 'Moving it to another day', affectsAdherence: false },
  { value: 'other', label: 'Other reason', affectsAdherence: true },
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

// Produces a short "12-week body recomposition plan." style summary
function shortSummary(text: string): string {
  if (!text) return 'Quarterly fitness plan.'
  const weekMatch = text.match(/over\s+(\d+)\s*week/i) ?? text.match(/(\d+)[\s\-]week/i)
  const weeks = weekMatch ? parseInt(weekMatch[1]) : null
  const lower = text.toLowerCase()
  let focus = 'fitness'
  if (/waist|body composition|recomposition/.test(lower)) focus = 'body recomposition'
  else if (/muscle|hypertrophy|mass/.test(lower)) focus = 'muscle building'
  else if (/fat loss|weight loss|cut/.test(lower)) focus = 'fat loss'
  else if (/endurance|cardio|aerobic/.test(lower)) focus = 'endurance'
  else if (/strength|power/.test(lower)) focus = 'strength'
  else if (/performance/.test(lower)) focus = 'performance'
  return weeks ? `${weeks}-week ${focus} plan.` : `Quarterly ${focus} plan.`
}

interface Chip { label: string; color: string }

function buildChips(
  obj: string,
  strength: PlanBlock | null,
  cardio: PlanBlock | null,
  nutrition: PlanBlock | null,
): Chip[] {
  const chips: Chip[] = []
  if (strength?.sessionsPerWeek) chips.push({ label: `Strength ${strength.sessionsPerWeek}×/wk`, color: '#B8A4FF' })
  if (cardio?.sessionsPerWeek) chips.push({ label: `Cardio ${cardio.sessionsPerWeek}×/wk`, color: '#80BDFF' })
  const protein = (nutrition?.proteinTarget as number | undefined)
    ?? (nutrition as { targetProtein?: number } | null)?.targetProtein
  if (protein) chips.push({ label: `Protein ${protein}g/day`, color: '#7FD5AA' })
  const lower = obj.toLowerCase()
  let focus = ''
  if (/waist/.test(lower)) focus = 'Waist focus'
  else if (/muscle|hypertrophy/.test(lower)) focus = 'Muscle gain'
  else if (/fat|weight loss/.test(lower)) focus = 'Fat loss'
  else if (/body composition|recomposition/.test(lower)) focus = 'Body comp'
  else if (/endurance/.test(lower)) focus = 'Endurance'
  if (focus) chips.push({ label: focus, color: '#F5A56A' })
  return chips
}

function parseSessionText(session: string): { activity: string; detail?: string } {
  const parenMatch = session.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  const rawActivity = parenMatch ? parenMatch[1].trim() : session
  const detail = parenMatch ? parenMatch[2].trim() : undefined

  // Normalise activity name
  let activity = rawActivity
  // "Rest / passive recovery" → "Rest"
  const slashIdx = activity.indexOf(' / ')
  if (slashIdx > 0) activity = activity.slice(0, slashIdx).trim()
  // "Stairmaster Cardio" → "Stairmaster"
  const cardioSuffix = activity.match(/^(.+?)\s+Cardio$/i)
  if (cardioSuffix && cardioSuffix[1].trim().length > 0) activity = cardioSuffix[1].trim()

  if (detail) return { activity, detail }
  // Trailing duration without parens: "Foo 20 min"
  const durationMatch = session.match(/^(.+?)\s+(\d+\s*min(?:utes?)?)\s*$/i)
  if (durationMatch) return { activity: durationMatch[1].trim(), detail: durationMatch[2].replace(/\s+/, ' ') }
  return { activity }
}

// Extracts only a short meta hint (duration or step count) — discards muscle groups etc.
function extractShortMeta(detail: string | undefined): string | null {
  if (!detail) return null
  // Duration: "20 min", "20–25 min", "20-25 min"
  const dur = detail.match(/(\d+\s*[–\-]\s*\d+\s*min|\d+\s*min)/i)
  if (dur) return dur[1].trim()
  // Step count: "8000 steps", "8,000 steps"
  const steps = detail.match(/(\d[\d,]+)\s*steps/i)
  if (steps) {
    const n = parseInt(steps[1].replace(/,/g, ''))
    return `${Math.round(n / 1000)}k steps`
  }
  return null
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
    if (remaining <= 1) return `Strength drops to ${remaining} session this week — below target.`
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
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', paddingTop: 2 }}>{icon} {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 9, color: '#4A8A6E', flexShrink: 0, marginTop: 3, fontWeight: 700 }}>•</span>
            <span style={{ fontSize: 12, color: '#A1A1A6', lineHeight: 1.4 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ActiveRegime({ strategy, isDraft, userId }: Props) {
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set())
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set())
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; type: 'ok' | 'warn' | 'protect' } | null>(null)
  // Toast shown when a Today item is marked done — allows Undo before it disappears
  const [completionToast, setCompletionToast] = useState<{ id: string; session: string; labelKey: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const weekId = getWeekId()

  // Load this week's session changes (removals + completions) on mount
  useEffect(() => {
    if (!userId) return
    fetch(`/api/fitness/schedule-change?userId=${userId}&weekId=${weekId}`)
      .then(r => r.json())
      .then((changes: Array<{ id: string; sessionLabel: string; sessionDay: string; action?: string; undone: boolean }>) => {
        if (!Array.isArray(changes)) return
        const removed = new Set<string>()
        const completed = new Set<string>()
        for (const c of changes) {
          if (c.undone) continue
          const key = `${c.sessionDay}:${c.sessionLabel}`
          if (c.action === 'completed') completed.add(key)
          else removed.add(key)
        }
        setRemovedKeys(removed)
        setCompletedKeys(completed)
      })
      .catch(() => {})
  }, [userId, weekId])

  const schedule = parseSchedule(strategy?.weeklySchedule ?? null)

  const handleMarkDone = useCallback(async (labelKey: string, session: string, day: string) => {
    const isAlreadyDone = completedKeys.has(labelKey)
    if (isAlreadyDone) {
      // Undo from weekly grid (not Today — completed items are hidden there)
      setCompletedKeys(prev => { const n = new Set(prev); n.delete(labelKey); return n })
    } else {
      // Optimistic
      setCompletedKeys(prev => new Set([...prev, labelKey]))
      try {
        const res = await fetch('/api/fitness/schedule-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, weekId, sessionLabel: session, sessionDay: day, sessionType: detectSessionType(session), action: 'completed', reason: null }),
        })
        const data = await res.json() as { id: string }
        // Show toast with Undo for 5 seconds
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setCompletionToast({ id: data.id, session, labelKey })
        toastTimerRef.current = setTimeout(() => setCompletionToast(null), 5000)
      } catch { /* silent */ }
    }
  }, [completedKeys, userId, weekId])

  const handleUndoCompletion = useCallback(async () => {
    if (!completionToast) return
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null }
    setCompletedKeys(prev => { const n = new Set(prev); n.delete(completionToast.labelKey); return n })
    const toastId = completionToast.id
    setCompletionToast(null)
    try {
      await fetch('/api/fitness/schedule-change', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: toastId }),
      })
    } catch { /* silent */ }
  }, [completionToast])

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
      const feedbackType = impactText.startsWith('Strength drops') ? 'warn' : selectedReason === 'plan_too_much' ? 'protect' : 'ok'
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
      <div className="card" style={{ borderLeft: '2px solid rgba(127,213,170,0.2)' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
          Current Quarterly Fitness Regime
        </div>
        <div style={{ fontSize: 13, color: '#6E6E73', fontStyle: 'italic' }}>
          No active fitness strategy.{' '}
          <a href="/fitness/strategy" style={{ color: '#7FD5AA', textDecoration: 'none' }}>
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
  const chips = buildChips(strategy.mainObjective, strengthPlan, cardioPlan, nutritionPlan)

  return (
    <div className="card" style={{ borderLeft: `2px solid ${isDraft ? 'rgba(236,198,102,0.4)' : 'rgba(127,213,170,0.3)'}` }}>
      {isDraft && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 14, borderRadius: 8, background: 'rgba(236,198,102,0.07)', border: '1px solid rgba(236,198,102,0.2)' }}>
          <span style={{ fontSize: 12, color: '#ECC666' }}>Draft strategy — review and activate to make it operational</span>
          <a href="/fitness/strategy" style={{ fontSize: 12, color: '#ECC666', textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>Review & Activate →</a>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDraft ? '#ECC666' : '#6E6E73', marginBottom: 4 }}>
            {isDraft ? 'Draft Fitness Strategy' : 'Current Quarterly Fitness Regime'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D1D1D6', marginBottom: chips.length > 0 ? 8 : 0 }}>
            {shortSummary(strategy.mainObjective)}
          </div>
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {chips.map((chip, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600,
                  color: chip.color,
                  background: chip.color + '18',
                  border: `1px solid ${chip.color}30`,
                  borderRadius: 20, padding: '2px 9px', lineHeight: 1.6,
                }}>{chip.label}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 12 }}>
          <a href="/fitness/strategy" style={{ fontSize: 11, color: isDraft ? '#ECC666' : '#7FD5AA', textDecoration: 'none', padding: '4px 10px', border: `1px solid ${isDraft ? 'rgba(236,198,102,0.2)' : 'rgba(127,213,170,0.2)'}`, borderRadius: 6, whiteSpace: 'nowrap' }}>
            Full Strategy →
          </a>
          {!isDraft && <span style={{ fontSize: 9, color: '#48484A', whiteSpace: 'nowrap' }}>Synced with strategy</span>}
        </div>
      </div>

      {/* Lifecycle compact row — only for active strategy */}
      {!isDraft && (
        <StrategyLifecycleCompact createdAt={strategy.createdAt} roadmapJson={strategy.roadmap} />
      )}

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', marginBottom: 10, borderRadius: 8,
          background: feedback.type === 'warn' ? 'rgba(236,198,102,0.08)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${feedback.type === 'warn' ? 'rgba(236,198,102,0.2)' : feedback.type === 'protect' ? 'rgba(127,213,170,0.2)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          <span style={{ fontSize: 12, color: feedback.type === 'warn' ? '#ECC666' : feedback.type === 'protect' ? '#7FD5AA' : '#A1A1A6' }}>
            {feedback.text}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            {undoState && (
              <button onClick={handleUndo} style={{ fontSize: 11, color: '#7FD5AA', background: 'none', border: '1px solid rgba(127,213,170,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                Undo
              </button>
            )}
            <button onClick={() => setFeedback(null)} style={{ fontSize: 11, color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Schedule: Today's Plan + Weekly grid + Progress chips */}
      {schedule.length > 0 && (() => {
        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const todayName = DAY_NAMES[new Date().getDay()]
        const todaySchedule = schedule.find(s => s.day === todayName)
        const todaySessions = todaySchedule?.sessionList ?? []

        // Weekly progress counts
        const wCounts = { strength: 0, cardio: 0, sauna: 0, walk: 0 }
        const wDone   = { strength: 0, cardio: 0, sauna: 0, walk: 0 }
        for (const day of schedule) {
          for (const session of day.sessionList) {
            const t = detectSessionType(session) as keyof typeof wCounts
            if (t in wCounts) { wCounts[t]++; if (completedKeys.has(`${day.day}:${session}`)) wDone[t]++ }
          }
        }
        const CHIP_COLORS: Record<string, string> = { strength: '#7FD5AA', cardio: '#80BDFF', sauna: '#F5A56A', walk: '#B8A4FF' }
        const CHIP_LABELS: Record<string, string> = { strength: 'Strength', cardio: 'Cardio', sauna: 'Sauna', walk: 'Walks' }

        return (
          <div>
            {/* ── Today's Plan — only active (not completed/skipped) ───────────── */}
            {todaySessions.length > 0 && (() => {
              const activeSessions = todaySessions.filter(s => {
                const lk = `${todayName}:${s}`
                return !completedKeys.has(lk) && !removedKeys.has(lk)
              })
              const doneCount    = todaySessions.filter(s => completedKeys.has(`${todayName}:${s}`)).length
              const skippedCount = todaySessions.filter(s => removedKeys.has(`${todayName}:${s}`)).length
              const allDone      = activeSessions.length === 0

              // When all done: hide Today section entirely (weekly grid still shows completed items)
              // Only keep visible if there's an active undo toast
              if (allDone && !completionToast) return null

              return (
                <div style={{ marginBottom: 14 }}>
                  {!allDone && (
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD5AA', marginBottom: 8 }}>
                      Today · {todayName}
                    </div>
                  )}

                  {/* Completion toast — appears briefly when item is marked done */}
                  {completionToast && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: allDone ? 0 : 8, borderRadius: 8, background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)' }}>
                      <span style={{ fontSize: 12, color: '#7FD5AA' }}>✓ {parseSessionText(completionToast.session).activity} done</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleUndoCompletion} style={{ fontSize: 11, color: '#7FD5AA', background: 'none', border: '1px solid rgba(127,213,170,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Undo</button>
                        <button onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setCompletionToast(null) }} style={{ fontSize: 11, color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  )}

                  {!allDone && (
                    /* Active (incomplete) sessions only */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeSessions.map((session, i) => {
                        const labelKey = `${todayName}:${session}`
                        const parsed = parseSessionText(session)
                        const meta = extractShortMeta(parsed.detail)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div
                              onClick={() => handleMarkDone(labelKey, session, todayName)}
                              style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: 'transparent', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{parsed.activity}</div>
                              {meta && <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 1 }}>{meta}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => handleMarkDone(labelKey, session, todayName)} style={{ fontSize: 11, fontWeight: 600, color: '#7FD5AA', background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.25)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>✓ Done</button>
                              <button onClick={() => handleRemoveClick(labelKey, session, todayName)} style={{ fontSize: 11, color: '#6E6E73', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Skip</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── Weekly grid ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73' }}>Weekly Schedule</div>
              {(removedKeys.size > 0 || completedKeys.size > 0) && (
                <span style={{ fontSize: 10, color: '#6E6E73' }}>
                  {[completedKeys.size > 0 && `${completedKeys.size} done`, removedKeys.size > 0 && `${removedKeys.size} skipped`].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 12 }}>
              {schedule.slice(0, 7).map((s, di) => (
                <div key={di} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: s.day === todayName ? '1px solid rgba(127,213,170,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: s.day === todayName ? '#7FD5AA' : '#6E6E73', marginBottom: 6 }}>{s.day?.slice(0, 3).toUpperCase()}</div>
                  {s.sessionList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {s.sessionList.map((session, si) => {
                        const labelKey = `${s.day}:${session}`
                        const isRemoved = removedKeys.has(labelKey)
                        const isCompleted = completedKeys.has(labelKey)
                        const itemKey = `${di}:${si}`
                        const isHovered = hoverKey === itemKey
                        const parsed = parseSessionText(session)

                        if (isRemoved) return (
                          <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: 0.35 }}>
                            <span style={{ fontSize: 9, color: '#6E6E73', fontWeight: 700 }}>—</span>
                            <span style={{ fontSize: 11, color: '#6E6E73', textDecoration: 'line-through', lineHeight: 1.3 }}>{parsed.activity}</span>
                          </div>
                        )

                        if (isCompleted) return (
                          <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 9, color: '#7FD5AA', flexShrink: 0, marginTop: 2, fontWeight: 800 }}>✓</span>
                            <div style={{ fontSize: 11, color: '#7FD5AA', lineHeight: 1.3 }}>{parsed.activity}</div>
                          </div>
                        )

                        return (
                          <div key={si} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', position: 'relative', cursor: 'default' }}
                            onMouseEnter={() => setHoverKey(itemKey)}
                            onMouseLeave={() => setHoverKey(null)}>
                            <span style={{ fontSize: 9, color: '#7FD5AA', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>•</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: '#A1A1A6', lineHeight: 1.3 }}>{parsed.activity}</div>
                              {extractShortMeta(parsed.detail) && <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 1 }}>{extractShortMeta(parsed.detail)}</div>}
                            </div>
                            {isHovered && (
                              <div style={{ position: 'absolute', right: -4, top: -2, display: 'flex', gap: 3 }}>
                                <button onClick={e => { e.stopPropagation(); handleMarkDone(labelKey, session, s.day) }} title="Mark done" style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(127,213,170,0.2)', border: '1px solid rgba(127,213,170,0.4)', color: '#7FD5AA', fontSize: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>✓</button>
                                <button onClick={e => { e.stopPropagation(); handleRemoveClick(labelKey, session, s.day) }} title="Skip" style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,155,135,0.15)', border: '1px solid rgba(255,155,135,0.3)', color: '#FF9B87', fontSize: 9, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>✕</button>
                              </div>
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

            {/* ── This week progress chips ─────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {(['strength', 'cardio', 'sauna', 'walk'] as const).filter(t => wCounts[t] > 0).map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: CHIP_COLORS[t] + '10', border: `1px solid ${CHIP_COLORS[t]}28`, fontSize: 12 }}>
                  <span style={{ color: '#6E6E73' }}>{CHIP_LABELS[t]}</span>
                  <span style={{ fontWeight: 700, color: wDone[t] >= wCounts[t] ? CHIP_COLORS[t] : '#F5F5F7' }}>
                    {wDone[t]}<span style={{ color: '#48484A', fontWeight: 400 }}>/{wCounts[t]}</span>
                  </span>
                  {wDone[t] > 0 && (
                    <div style={{ width: 28, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(1, wDone[t] / wCounts[t]) * 100}%`, background: CHIP_COLORS[t], borderRadius: 99 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Remove reason modal */}
      {removeTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '0 20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setRemoveTarget(null) }}
        >
          <div style={{ background: '#1A1916', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Remove Session</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7' }}>{parseSessionText(removeTarget.session).activity}</div>
              <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>{removeTarget.day}</div>
            </div>
            <div style={{ fontSize: 12, color: '#A1A1A6', marginBottom: 12 }}>Why are you removing this?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REMOVE_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(prev => prev === r.value ? '' : r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: selectedReason === r.value ? 'rgba(127,213,170,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedReason === r.value ? 'rgba(127,213,170,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  
                  <span style={{ fontSize: 12, color: selectedReason === r.value ? '#7FD5AA' : '#A1A1A6' }}>{r.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRemoveTarget(null)} style={{ flex: 1, padding: '9px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#6E6E73', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={!selectedReason || saving}
                style={{
                  flex: 1, padding: '9px 0', background: selectedReason ? 'rgba(255,155,135,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedReason ? 'rgba(255,155,135,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, color: selectedReason ? '#FF9B87' : '#4A4845', fontSize: 13, cursor: selectedReason ? 'pointer' : 'default',
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
