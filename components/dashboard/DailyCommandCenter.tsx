'use client'
import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalendarWidget from '@/components/calendar/CalendarWidget'
import Spinner from '@/components/ui/Spinner'
import { Timer, RotateCw } from 'lucide-react'
import BioClock from './dcc/BioClock'
import IntelCard from './dcc/IntelCard'
import PriorityItem from './dcc/PriorityItem'
import PrioritySkeleton from './dcc/PrioritySkeleton'
import FitnessSnapshot from './dcc/FitnessSnapshot'
import MealPreview from './dcc/MealPreview'
import TodaysMeetings from './dcc/TodaysMeetings'
import FocusModeOverlay from './dcc/FocusModeOverlay'
import BulletDirective from './dcc/BulletDirective'
import Skel from './dcc/Skel'
import { getGreeting, parseSafeJson, briefingAgeMs, formatAge, REFRESH_INTERVAL_MS } from './dcc/helpers'
import WorkScheduleEditor from './dcc/WorkScheduleEditor'
import GapSuggestions, { computeGapSuggestions } from './dcc/GapSuggestions'
import { DEFAULT_WORK_SCHEDULE, getWorkSchedule, minToTimeStr, type WorkSchedule } from '@/lib/work-schedule'
import type {
  DailyBriefing, DailyFact, GoalWithMetrics, WeeklyTask, FitnessStrategy,
  PlannedMeal, BriefingPriority, WorldItem, MicroStep, IntelItem,
} from './dcc/types'

interface Props {
  briefing: DailyBriefing | null
  goals: GoalWithMetrics[]
  tasks: WeeklyTask[]
  strategy: FitnessStrategy | null
  todayMeals: PlannedMeal[]
  tomorrowMeals: PlannedMeal[]
  userId: string
  quarterName: string
  weeklyPlanId?: string
  calendarConnected?: boolean
  calendarIcsConnected?: boolean
  atRiskCount?: number
  watchCount?: number
  todayProtein?: number
  proteinTarget?: number | null
}


const DEFAULT_FACTS: DailyFact[] = [
  {
    category: 'psychology',
    fact: 'Vague tasks create more resistance than difficult ones. Break them into named, concrete steps.',
    whyItMatters: 'Specificity reduces activation energy and makes procrastination less likely.',
  },
  {
    category: 'health',
    fact: 'Morning light exposure within 30 minutes of waking helps regulate your circadian rhythm.',
    whyItMatters: 'Better sleep quality and more consistent energy throughout the day.',
  },
  {
    category: 'fitness',
    fact: 'Protein consistency across days matters more than hitting perfect macros on any single day.',
    whyItMatters: 'Muscle protein synthesis responds to sustained availability, not spikes.',
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyCommandCenter({
  briefing: initialBriefing,
  goals,
  tasks,
  strategy,
  todayMeals,
  tomorrowMeals,
  userId,
  quarterName,
  calendarConnected = false,
  calendarIcsConnected = false,
  atRiskCount = 0,
  watchCount = 0,
  todayProtein = 0,
  proteinTarget = null,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [briefing, setBriefing] = useState<DailyBriefing | null>(initialBriefing)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(
    initialBriefing?.generatedAt ? new Date(initialBriefing.generatedAt) : null
  )

  // ADHD features state
  const [focusMode, setFocusMode] = useState(false)
  const [focusOverride, setFocusOverride] = useState<WeeklyTask | null>(null)
  const [directiveExpanded, setDirectiveExpanded] = useState(false)
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high' | null>(null)
  const [morningDismissed, setMorningDismissed] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Record<string, MicroStep[]>>({})
  const [completedSteps, setCompletedSteps] = useState<Record<string, Set<number>>>({})
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null)

  // Today string for localStorage keys — local timezone so it matches the user's day
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

  // Load persisted steps + completions from localStorage on mount
  useEffect(() => {
    try {
      const savedExpanded: Record<string, MicroStep[]> = {}
      const savedCompleted: Record<string, Set<number>> = {}
      for (const task of tasks) {
        const raw = localStorage.getItem(`steps_${task.id}_${todayStr}`)
        if (!raw) continue
        const { steps, completed } = JSON.parse(raw) as { steps?: MicroStep[]; completed?: number[] }
        if (steps?.length) savedExpanded[task.id] = steps
        if (completed?.length) savedCompleted[task.id] = new Set(completed)
      }
      if (Object.keys(savedExpanded).length) setExpandedSteps(savedExpanded)
      if (Object.keys(savedCompleted).length) setCompletedSteps(savedCompleted)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr])

  function saveStepsToStorage(taskId: string, steps?: MicroStep[], completed?: Set<number>) {
    try {
      const key = `steps_${taskId}_${todayStr}`
      const existing = JSON.parse(localStorage.getItem(key) ?? '{}') as { steps?: MicroStep[]; completed?: number[] }
      localStorage.setItem(key, JSON.stringify({
        steps: steps ?? existing.steps,
        completed: completed != null ? [...completed] : existing.completed,
      }))
    } catch {}
  }

  // Persist completedSteps to localStorage whenever they change
  useEffect(() => {
    try {
      for (const [taskId, completed] of Object.entries(completedSteps)) {
        saveStepsToStorage(taskId, undefined, completed)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps])

  // Persist expandedSteps (step content) to localStorage whenever they change
  useEffect(() => {
    try {
      for (const [taskId, steps] of Object.entries(expandedSteps)) {
        saveStepsToStorage(taskId, steps, undefined)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSteps])

  function toggleStep(taskId: string, index: number) {
    const current = new Set(completedSteps[taskId] ?? [])
    if (current.has(index)) current.delete(index)
    else current.add(index)

    // Write synchronously — don't rely on useEffect scheduling
    saveStepsToStorage(taskId, undefined, current)
    setCompletedSteps(prev => ({ ...prev, [taskId]: current }))

    // Auto-complete task when all micro-steps are checked
    const steps = expandedSteps[taskId] ?? []
    const task = tasks.find(t => t.id === taskId)
    if (steps.length > 0 && current.size === steps.length && task && !task.completed) {
      setTimeout(() => toggleTask(taskId), 500)
    }
  }
  const [celebTaskId, setCelebTaskId] = useState<string | null>(null)
  const [undoTask, setUndoTask] = useState<{ id: string; title: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE)
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false)

  // Load per-device schedule override after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWorkSchedule(getWorkSchedule()))
    return () => cancelAnimationFrame(raf)
  }, [])
  const [calendarEvents, setCalendarEvents] = useState<Array<{ start: Date; end: Date }>>([])

  // Load energy from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('energy_level') as 'low' | 'medium' | 'high' | null
      if (stored) setEnergy(stored)
    } catch {}
  }, [])

  // Fetch calendar events for today
  useEffect(() => {
    if (!calendarConnected && !calendarIcsConnected) return
    const fetchCalendar = async () => {
      try {
        const res = await fetch(`/api/calendar/events?userId=${userId}&date=${todayStr}`)
        if (res.ok) {
          const data = await res.json()
          const events = data.map((e: any) => ({
            start: new Date(e.start),
            end: new Date(e.end),
          }))
          setCalendarEvents(events)
        }
      } catch {}
    }
    fetchCalendar()
  }, [userId, todayStr, calendarConnected, calendarIcsConnected])

  // Load morning dismissed state
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`morning_checkin_${todayStr}`)
      if (dismissed === 'true') setMorningDismissed(true)
    } catch {}
  }, [todayStr])

  const setEnergyAndPersist = (e: 'low' | 'medium' | 'high' | null) => {
    setEnergy(e)
    try { if (e) sessionStorage.setItem('energy_level', e); else sessionStorage.removeItem('energy_level') } catch {}
  }

  const generateBriefing = useCallback(async () => {
    setLoadingBrief(true)
    try {
      const res = await fetch('/api/dashboard/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const data = await res.json()
        setBriefing(data)
        setLastRefreshedAt(new Date())
        startTransition(() => router.refresh())
      }
    } finally {
      setLoadingBrief(false)
    }
  }, [userId, router, startTransition])


  useEffect(() => {
    const age = briefingAgeMs(initialBriefing?.generatedAt)
    if (age > REFRESH_INTERVAL_MS) {
      generateBriefing()
    }
    const id = setInterval(() => {
      generateBriefing()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleTask(id: string, opts?: { skipUndo?: boolean }) {
    setToggling(id)
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Toggle failed')
      // Celebration animation
      setCelebTaskId(id)
      setTimeout(() => setCelebTaskId(null), 1200)
      // Undo affordance — 6s window to take it back
      if (!opts?.skipUndo) {
        const task = tasks.find(t => t.id === id)
        if (task && !task.completed) {
          if (undoTimer.current) clearTimeout(undoTimer.current)
          setUndoTask({ id, title: task.title })
          undoTimer.current = setTimeout(() => setUndoTask(null), 6000)
        }
      } else {
        setUndoTask(null)
      }
      startTransition(() => router.refresh())
    } catch {
      // Silent
    } finally {
      setToggling(null)
    }
  }

  async function undoLastComplete() {
    if (!undoTask) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    const id = undoTask.id
    setUndoTask(null)
    await toggleTask(id, { skipUndo: true })
  }

  async function loadMicroSteps(taskId: string) {
    if (expandedSteps[taskId]) {
      // Toggle off if already loaded
      setExpandedSteps(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
      return
    }
    setLoadingSteps(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/break`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setExpandedSteps(prev => ({ ...prev, [taskId]: data.steps }))
        // Write synchronously so steps survive a refresh
        saveStepsToStorage(taskId, data.steps, completedSteps[taskId])
      }
    } finally {
      setLoadingSteps(null)
    }
  }

  function dismissMorning() {
    setMorningDismissed(true)
    try { localStorage.setItem(`morning_checkin_${todayStr}`, 'true') } catch {}
  }

  // Parse briefing JSON fields
  const briefPriorities = parseSafeJson<BriefingPriority[]>(briefing?.priorities) ?? []
  const worldBriefingRaw = parseSafeJson<WorldItem[]>(briefing?.worldBriefing) ?? []
  const worldBriefing = worldBriefingRaw.reduce((acc: WorldItem[], item) => {
    const cat = item.category?.toLowerCase()
    if (!acc.find(x => x.category?.toLowerCase() === cat)) acc.push(item)
    return acc
  }, [])

  const allDailyFacts = parseSafeJson<DailyFact[]>(briefing?.dailyFacts) ?? []
  const factsPool = allDailyFacts.length > 0 ? allDailyFacts : DEFAULT_FACTS
  const bodyMindFact = factsPool[new Date().getDay() % factsPool.length] ?? factsPool[0]

  const intelItems: IntelItem[] = [
    ...worldBriefing.slice(0, 5).map(item => ({
      category: item.category?.toLowerCase() ?? '',
      headline: item.headline,
      why: item.why,
    })),
    ...(bodyMindFact ? [{
      category: bodyMindFact.category,
      headline: bodyMindFact.fact,
      why: bodyMindFact.whyItMatters,
    }] : []),
  ]

  const incompleteTasks = tasks.filter(t => !t.completed)
  const doneTodayCount = tasks.filter(t => t.completed).length
  const remainingCount = incompleteTasks.length

  const atRiskGoalIds = new Set(
    goals.filter(g => g.metrics.status === 'at_risk' || g.metrics.status === 'critical').map(g => g.id)
  )

  function findBriefItem(task: WeeklyTask): BriefingPriority | undefined {
    return briefPriorities.find(p =>
      p.text.toLowerCase().includes(task.title.toLowerCase().slice(0, 20)) ||
      task.title.toLowerCase().includes(p.text.toLowerCase().slice(0, 20))
    )
  }

  function effectivePriority(t: WeeklyTask): number {
    const b = findBriefItem(t)
    if (b?.priority === 'must' || t.priority === 1 || (t.goal && atRiskGoalIds.has(t.goal.id))) return 1
    if (b?.priority === 'should' || t.priority === 2) return 2
    if (b?.priority === 'optional' || t.priority === 3) return 3
    return t.priority ?? 2
  }

  const mustDo   = incompleteTasks.filter(t => effectivePriority(t) === 1)
  const shouldDo = incompleteTasks.filter(t => effectivePriority(t) === 2)
  const optional = incompleteTasks.filter(t => effectivePriority(t) === 3)

  // Energy-filtered views
  const visibleMust   = energy === 'low' ? mustDo.slice(0, 1) : mustDo
  const visibleShould = energy === 'low' ? [] : shouldDo
  const visibleOpt    = (energy === 'low' || energy === 'medium') ? [] : optional

  // Morning check-in conditions
  const currentHour = new Date().getHours()
  const isMorning = currentHour >= 6 && currentHour < 10
  const showMorningBanner = isMorning && !!briefing && mustDo.length > 0 && !morningDismissed

  // Done for today banners
  const allMustDone = mustDo.length === 0 && doneTodayCount > 0
  const allDone = incompleteTasks.length === 0 && doneTodayCount > 0

  const rawDateStr = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateStr = rawDateStr.charAt(0).toUpperCase() + rawDateStr.slice(1)
  const greeting = getGreeting()

  // Focus mode queue = must-dos first, then should-dos; a gap suggestion can override
  const focusQueue = [...mustDo, ...shouldDo]
  const focusTask = (focusOverride && incompleteTasks.some(t => t.id === focusOverride.id))
    ? focusOverride
    : focusQueue[0] ?? null
  const focusNext = focusQueue.find(t => t.id !== focusTask?.id) ?? null

  // Gap → task suggestions for the rest of the day
  const gapSuggestions = computeGapSuggestions(incompleteTasks, calendarEvents, workSchedule)

  return (
    <div className="animate-entrance">
      {/* ── Focus Mode Overlay ── */}
      {focusMode && focusTask && (
        <FocusModeOverlay
          key={focusTask.id}
          task={focusTask}
          nextTaskTitle={focusNext?.title ?? null}
          onDone={async () => {
            // Stay in focus mode while the queue has more tasks;
            // router.refresh advances focusTask and the key remounts the timer.
            const wasOverride = focusOverride?.id === focusTask.id
            const hasNext = !wasOverride && focusQueue.length > 1
            await toggleTask(focusTask.id)
            setFocusOverride(null)
            if (!hasNext) setFocusMode(false)
          }}
          onExit={() => { setFocusOverride(null); setFocusMode(false) }}
        />
      )}

      {/* ══ DAILY INTELLIGENCE ══════════════════════════════════════════════ */}
      <div className="di-container" style={{
        background: 'rgba(255,255,255,0.018)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 22px',
        marginBottom: 20,
      }}>
        {/* Header — time-based greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="hero-enter" style={{ fontSize: 26, fontWeight: 600, color: '#EEEEF2', letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.1 }}>
              {greeting}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#6E6E76' }}>{dateStr}</span>
              {quarterName && <span style={{ fontSize: 11, color: '#52525A' }}>· {quarterName}</span>}
              {lastRefreshedAt && !loadingBrief && (
                <span style={{ fontSize: 11, color: '#44444A' }}>
                  · updated {formatAge(Date.now() - lastRefreshedAt.getTime())}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={generateBriefing}
            disabled={loadingBrief}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              fontSize: 11, color: loadingBrief ? '#3E3E44' : '#6E6E76',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 9, padding: '7px 13px', cursor: loadingBrief ? 'default' : 'pointer',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {loadingBrief
              ? <Spinner size={11} color="#7f67dd" strokeWidth={1.8} />
              : <RotateCw size={11} strokeWidth={2} />
            }
            <span>{loadingBrief ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>

        {/* Bio Clock + Intel Cards */}
        <div className="intel-main-grid">
          {/* Bio Clock card */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)',
            padding: '18px 16px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Timer size={11} color="#52525A" strokeWidth={2} />
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#52525A' }}>
                Bio Clock
              </span>
            </div>
            <BioClock />
          </div>

          {/* Intel cards grid */}
          {loadingBrief && intelItems.length === 0 ? (
            <div className="intel-cards-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ height: 9, width: '40%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '90%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '70%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.6s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          ) : intelItems.length > 0 ? (
            <div key={briefing?.id ?? 'empty'} className="intel-cards-grid">
              {intelItems.map((item, i) => (
                <div key={i} className="animate-entrance" style={{ animationDelay: `${0.08 + i * 0.055}s`, display: 'flex' }}>
                  <IntelCard item={item} />
                </div>
              ))}
              {/* Quiet placeholders so a lone card doesn't float in an empty grid (pad to full rows) */}
              {intelItems.length < 6 && Array.from({ length: Math.ceil(intelItems.length / 3) * 3 - intelItems.length }).map((_, i) => (
                <div key={`ph${i}`} className="animate-entrance" style={{
                  animationDelay: `${0.08 + (intelItems.length + i) * 0.055}s`,
                  borderRadius: 16, minHeight: 76,
                  border: '1px dashed rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, color: '#3E3E44' }}>
                    {i === 0 ? 'More with next briefing' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 200, gap: 10,
              border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 20,
            }}>
              <div style={{ fontSize: 12, color: '#3A3A3C', textAlign: 'center', lineHeight: 1.7 }}>
                No briefing yet.<br />Hit Refresh to generate today&apos;s intelligence.
              </div>
              <button
                onClick={generateBriefing}
                disabled={loadingBrief}
                style={{
                  fontSize: 11, color: '#6E6E76', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Generate briefing
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ══ TWO-COLUMN BODY ══════════════════════════════════════════════════ */}
      <div className="r-grid-2">

        {/* LEFT — Directive + Today's Priorities */}
        <div className="card">

          {/* Morning check-in banner */}
          {showMorningBanner && (
            <div style={{
              marginBottom: 16, padding: '14px 16px',
              background: 'rgba(100, 240, 170,0.06)',
              border: '1px solid rgba(100, 240, 170,0.18)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#64f0aa', marginBottom: 6 }}>Morning check-in</div>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 6 }}>
                Today&apos;s focus:
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#EEEEF2', marginBottom: 12, lineHeight: 1.35 }}>
                {mustDo[0]?.title}
              </div>
              <button
                onClick={dismissMorning}
                style={{
                  fontSize: 12, fontWeight: 600, color: '#64f0aa',
                  background: 'rgba(100, 240, 170,0.12)', border: '1px solid rgba(100, 240, 170,0.25)',
                  borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Got it, let&apos;s go →
              </button>
            </div>
          )}

          {/* Strategic Directive */}
          <div style={{ borderLeft: '3px solid #a085ff', paddingLeft: 14, marginBottom: briefing?.instruction ? 10 : 18 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 6 }}>
              This Week&apos;s Directive
            </div>
            {loadingBrief && !briefing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skel w="95%" h={13} />
                <Skel w="82%" h={13} />
                <Skel w="70%" h={13} />
              </div>
            ) : briefing?.directive ? (
              <div className="animate-fade-in">
                <BulletDirective
                  text={briefing.directive}
                  expanded={directiveExpanded}
                  onToggle={() => setDirectiveExpanded(v => !v)}
                />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6E6E76', fontStyle: 'italic' }}>
                Click ↻ above to generate today&apos;s briefing.
              </div>
            )}
          </div>

          {/* Today instruction */}
          {briefing?.instruction && (
            <div style={{ marginTop: 16, marginBottom: 18, padding: '10px 14px', background: 'rgba(100, 240, 170,0.04)', borderRadius: 14, border: '1px solid rgba(100, 240, 170,0.12)' }}>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64f0aa', marginBottom: 5, opacity: 0.8 }}>
                Today
              </div>
              <span style={{ fontSize: 12, color: '#9E9EA6', lineHeight: 1.65 }}>{briefing.instruction}</span>
            </div>
          )}

          {/* Health Summary Badge */}
          {(atRiskCount > 0 || watchCount > 0) && (
            <div style={{
              marginBottom: 14, padding: '8px 12px', borderRadius: 10,
              background: atRiskCount > 0 ? 'rgba(255, 130, 99,0.06)' : 'rgba(255, 198, 72,0.06)',
              border: `1px solid ${atRiskCount > 0 ? 'rgba(255, 130, 99,0.15)' : 'rgba(255, 198, 72,0.15)'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: atRiskCount > 0 ? '#ff8263' : '#ffc648' }}>
                {atRiskCount > 0 ? 'Goal health' : atRiskCount === 0 && watchCount > 0 ? 'Watch' : 'All clear'}
              </span>
              {atRiskCount > 0 && (
                <span style={{ fontSize: 10, color: '#ff8263', fontWeight: 700 }}>
                  {atRiskCount} at risk
                </span>
              )}
              {atRiskCount === 0 && watchCount > 0 && (
                <span style={{ fontSize: 10, color: '#ffc648' }}>
                  {watchCount} {watchCount === 1 ? 'goal' : 'goals'} to watch
                </span>
              )}
            </div>
          )}

          {/* Today's Priorities header row */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525A' }}>
                Today&apos;s Priorities
              </div>
              {/* Focus Mode button */}
              {focusTask && (
                <button
                  onClick={() => setFocusMode(true)}
                  title="Enter Focus Mode"
                  style={{
                    fontSize: 10, color: '#a085ff',
                    background: 'rgba(160, 133, 255,0.08)',
                    border: '1px solid rgba(160, 133, 255,0.2)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  Focus mode
                </button>
              )}
            </div>

            {/* Completion counter */}
            {(doneTodayCount > 0 || remainingCount > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {doneTodayCount > 0 && (
                  <span style={{ fontSize: 10, color: '#64f0aa', fontWeight: 600 }}>
                    ✓ {doneTodayCount} done
                  </span>
                )}
                {doneTodayCount > 0 && remainingCount > 0 && (
                  <span style={{ fontSize: 10, color: '#3E3E44' }}>·</span>
                )}
                {remainingCount > 0 && (
                  <span style={{ fontSize: 10, color: '#6E6E76' }}>{remainingCount} remaining</span>
                )}
              </div>
            )}

            {/* Done for today banners */}
            {allDone && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'rgba(100, 240, 170,0.08)', border: '1px solid rgba(100, 240, 170,0.2)',
                borderRadius: 10, fontSize: 12, color: '#64f0aa', fontWeight: 600,
              }}>
                Day complete — everything&apos;s done.
              </div>
            )}
            {!allDone && allMustDone && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'rgba(100, 240, 170,0.08)', border: '1px solid rgba(100, 240, 170,0.2)',
                borderRadius: 10, fontSize: 12, color: '#64f0aa', fontWeight: 600,
              }}>
                ✓ Must-dos done. Nice work.
              </div>
            )}

            {/* Time budget calculator */}
            {incompleteTasks.length > 0 && (() => {
              const totalMin = incompleteTasks.reduce((sum, t) => {
                return sum + (t.estimatedMinutes ?? (t.effort === 1 ? 15 : t.effort === 2 ? 25 : 45))
              }, 0)
              const now = new Date()
              const nowMin = now.getHours() * 60 + now.getMinutes()
              const dow = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
              const work = workSchedule[dow]
              // Remaining work minutes (if still within work hours)
              const workRemMin = work
                ? Math.max(0, work.end - Math.max(nowMin, work.start))
                : 0
              // Calculate minutes busy in calendar events AFTER work hours
              const workEndMin = work ? work.end : 22 * 60
              const busyInEvents = calendarEvents.reduce((busy, event) => {
                const eventStart = event.start.getHours() * 60 + event.start.getMinutes()
                const eventEnd = event.end.getHours() * 60 + event.end.getMinutes()
                // Only count time after work ends
                if (eventEnd <= workEndMin) return busy // Event is during work
                const overlapStart = Math.max(workEndMin, eventStart)
                const overlapEnd = Math.min(22 * 60, eventEnd)
                return busy + Math.max(0, overlapEnd - overlapStart)
              }, 0)
              // Free minutes = time from work end until 22:00, minus calendar meetings after work
              const freeStartMin = Math.max(nowMin, workEndMin)
              const untilEndOfDay = Math.max(0, 22 * 60 - freeStartMin)
              const dayRemMin = Math.max(0, untilEndOfDay - busyInEvents)
              const tight = totalMin > dayRemMin
              const tH = Math.floor(totalMin / 60), tM = totalMin % 60
              const rH = Math.floor(dayRemMin / 60), rM = dayRemMin % 60
              const isWorkHours = work && nowMin >= work.start && nowMin < work.end
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  padding: '7px 11px', borderRadius: 8, marginBottom: 10,
                  background: tight ? 'rgba(255, 130, 99,0.05)' : 'rgba(100, 240, 170,0.04)',
                  border: `1px solid ${tight ? 'rgba(255, 130, 99,0.14)' : 'rgba(100, 240, 170,0.1)'}`,
                }}>
                  <span style={{ fontSize: 11, color: '#6E6E76' }}>
                    Tasks: <strong style={{ color: tight ? '#ff8263' : '#9E9EA6', fontVariantNumeric: 'tabular-nums' }}>
                      {tH > 0 ? `${tH}h ` : ''}{tM}m
                    </strong>
                  </span>
                  <span style={{ fontSize: 9, color: '#3E3E44' }}>·</span>
                  <span style={{ fontSize: 11, color: '#6E6E76' }}>
                    Free time: <strong style={{ color: '#9E9EA6', fontVariantNumeric: 'tabular-nums' }}>
                      {rH}h {String(rM).padStart(2, '0')}m
                    </strong>
                  </span>
                  {isWorkHours && workRemMin > 0 && (
                    <>
                      <span style={{ fontSize: 9, color: '#3E3E44' }}>·</span>
                      <span style={{ fontSize: 10, color: '#6E6E76' }}>
                        Work until {minToTimeStr(work!.end)}
                      </span>
                    </>
                  )}
                  {(() => {
                    const meetsAfterWork = calendarEvents.filter(e => {
                      const eEnd = e.end.getHours() * 60 + e.end.getMinutes()
                      return eEnd > workEndMin
                    }).length
                    return meetsAfterWork > 0 ? (
                      <>
                        <span style={{ fontSize: 9, color: '#3E3E44' }}>·</span>
                        <span style={{ fontSize: 10, color: '#ffc648' }}>
                          {meetsAfterWork} evening meeting{meetsAfterWork === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null
                  })()}
                  {tight && (
                    <span style={{ fontSize: 10, color: '#ff8263', marginLeft: 'auto', fontWeight: 700 }}>
                      Overloaded
                    </span>
                  )}
                  <button
                    onClick={() => setScheduleEditorOpen(v => !v)}
                    title="Edit work hours"
                    style={{
                      marginLeft: tight ? 0 : 'auto', flexShrink: 0,
                      fontSize: 10, color: '#52525A', background: 'none',
                      border: 'none', cursor: 'pointer', padding: '0 2px',
                      transition: 'color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9E9EA6')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#52525A')}
                  >
                    Edit hours
                  </button>
                </div>
              )
            })()}

            {/* Work schedule editor */}
            {scheduleEditorOpen && (
              <WorkScheduleEditor
                schedule={workSchedule}
                onChange={setWorkSchedule}
                onClose={() => setScheduleEditorOpen(false)}
              />
            )}

            {/* Gap → task suggestions */}
            <GapSuggestions
              suggestions={gapSuggestions}
              onFocusTask={(task) => { setFocusOverride(task); setFocusMode(true) }}
            />

            {/* Energy selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525A', marginRight: 2 }}>
                Energy
              </span>
              {([
                { key: 'low',    label: 'Low',    dot: '#ff8263' },
                { key: 'medium', label: 'Medium', dot: '#ffc648' },
                { key: 'high',   label: 'High',   dot: '#64f0aa' },
              ] as const).map(({ key, label, dot }) => (
                <button
                  key={key}
                  onClick={() => setEnergyAndPersist(energy === key ? null : key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 500, padding: '4px 11px', borderRadius: 20,
                    border: energy === key ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.07)',
                    background: energy === key ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
                    color: energy === key ? '#EEEEF2' : '#6E6E76',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: dot,
                    opacity: energy === key ? 1 : 0.4, transition: 'opacity 0.12s',
                  }} />
                  {label}
                </button>
              ))}
            </div>

            {loadingBrief && incompleteTasks.length === 0 ? (
              <PrioritySkeleton />
            ) : incompleteTasks.length === 0 && doneTodayCount === 0 ? (
              <div style={{ fontSize: 12, color: '#6E6E76', fontStyle: 'italic' }}>
                No tasks this week.{' '}
                <Link href="/weekly" style={{ color: '#a085ff', textDecoration: 'none' }}>Plan this week →</Link>
              </div>
            ) : (
              <>
                {visibleMust.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff8263', marginBottom: 4, opacity: 0.85 }}>Must Do</div>
                    {visibleMust.map(t => (
                      <PriorityItem
                        key={t.id} task={t} briefItem={findBriefItem(t)}
                        onToggle={toggleTask} toggling={toggling}
                        celebTaskId={celebTaskId}
                        onBreakSteps={loadMicroSteps}
                        loadingSteps={loadingSteps}
                        expandedSteps={expandedSteps}
                        completedSteps={completedSteps}
                        onToggleStep={toggleStep}
                      />
                    ))}
                  </div>
                )}
                {visibleShould.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffc648', marginBottom: 4, opacity: 0.85 }}>Should Do</div>
                    {visibleShould.map(t => (
                      <PriorityItem
                        key={t.id} task={t} briefItem={findBriefItem(t)}
                        onToggle={toggleTask} toggling={toggling}
                        celebTaskId={celebTaskId}
                        onBreakSteps={loadMicroSteps}
                        loadingSteps={loadingSteps}
                        expandedSteps={expandedSteps}
                        completedSteps={completedSteps}
                        onToggleStep={toggleStep}
                      />
                    ))}
                  </div>
                )}
                {visibleOpt.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525A', marginBottom: 4 }}>Optional</div>
                    {visibleOpt.map(t => (
                      <PriorityItem
                        key={t.id} task={t} briefItem={findBriefItem(t)}
                        onToggle={toggleTask} toggling={toggling}
                        celebTaskId={celebTaskId}
                        onBreakSteps={loadMicroSteps}
                        loadingSteps={loadingSteps}
                        expandedSteps={expandedSteps}
                        completedSteps={completedSteps}
                        onToggleStep={toggleStep}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Calendar → Fitness → Meals → Tomorrow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CalendarWidget
            userId={userId}
            date={new Date().toISOString().split('T')[0]}
            calendarConnected={calendarConnected}
            calendarIcsConnected={calendarIcsConnected}
          />
          {calendarEvents.length > 0 && (() => {
            const dow = new Date().getDay()
            const work = workSchedule[dow]
            const workStartMin = work?.start ?? 7 * 60
            const workEndMin = work?.end ?? 17 * 60
            return <TodaysMeetings events={calendarEvents} workStartMin={workStartMin} workEndMin={workEndMin} />
          })()}
          <FitnessSnapshot strategy={strategy} userId={userId} onWorkoutLogged={() => startTransition(() => router.refresh())} />
          <MealPreview meals={todayMeals} label="Today's Meals" href="/meals" todayProtein={todayProtein} proteinTarget={proteinTarget} />
          {tomorrowMeals.length > 0 && (
            <MealPreview meals={tomorrowMeals} label="Tomorrow's Meals" isTomorrow={true} />
          )}
        </div>
      </div>

      {/* ── Undo toast ── */}
      {undoTask && (
        <div className="expand-enter" style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 14,
          background: 'rgba(30,30,32,0.92)',
          backdropFilter: 'blur(24px) saturate(1.6)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
          maxWidth: 'min(92vw, 440px)',
        }}>
          <span style={{ fontSize: 12, color: '#64f0aa', fontWeight: 600, flexShrink: 0 }}>✓ Done</span>
          <span style={{
            fontSize: 12, color: '#9E9EA6', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {undoTask.title}
          </span>
          <button
            onClick={undoLastComplete}
            style={{
              fontSize: 12, fontWeight: 600, color: '#a085ff', flexShrink: 0,
              background: 'rgba(160, 133, 255,0.10)', border: '1px solid rgba(160, 133, 255,0.22)',
              borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
