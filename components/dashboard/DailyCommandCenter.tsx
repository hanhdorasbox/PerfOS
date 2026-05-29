'use client'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TodayTasks from '@/components/dashboard/TodayTasks'
import CalendarWidget from '@/components/calendar/CalendarWidget'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyBriefing {
  id: string
  summary: string
  instruction: string
  directive: string
  priorities: string | null
  worldBriefing: string | null
  relevantUpdates: string | null
  externalContext: string | null
  generatedAt: string | Date
}

interface GoalWithMetrics {
  id: string
  title: string
  category: string
  metrics: { status: string; gap: number; statusLabel: string }
}

interface WeeklyTask {
  id: string
  title: string
  completed: boolean
  effort: number
  priority: number
  goal?: { id: string; title: string; category: string } | null
}

interface FitnessStrategy {
  mainObjective: string
  weeklySchedule: string | null
  nutritionDir: string | null
}

interface PlannedMeal {
  id: string
  dayOfWeek: number
  mealType: string
  title: string
  description: string | null
  calories: number | null
  protein: number | null
}

interface FitnessLog {
  weight: number | null
  waist: number | null
}

interface BriefingPriority {
  text: string
  priority: 'must' | 'should' | 'optional'
  goalTitle: string | null
  whyToday: string
}

interface WorldItem {
  headline: string
  why: string
  category: string
}

interface RelevantItem {
  topic: string
  update: string
}

interface Props {
  briefing: DailyBriefing | null
  goals: GoalWithMetrics[]
  tasks: WeeklyTask[]
  strategy: FitnessStrategy | null
  todayMeals: PlannedMeal[]
  tomorrowMeals: PlannedMeal[]
  fitnessLog: FitnessLog | null
  userId: string
  quarterName: string
  weeklyPlanId?: string
  calendarConnected?: boolean
  calendarIcsConnected?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  must:     '#FF9B87',
  should:   '#ECC666',
  optional: '#6E6E73',
}
const PRIORITY_LABEL: Record<string, string> = {
  must: 'MUST',
  should: 'SHOULD',
  optional: 'OPT',
}
const EFFORT_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Deep work' }
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }
const CATEGORY_COLOR: Record<string, string> = {
  geopolitics: '#F5A56A',
  business:    '#ECC666',
  tech:        '#B8A4FF',
  society:     '#80BDFF',
  science:     '#7FD5AA',
}

function sortMeals(meals: PlannedMeal[]) {
  return [...meals].sort((a, b) => {
    const ao = MEAL_ORDER[a.mealType.toLowerCase()] ?? 9
    const bo = MEAL_ORDER[b.mealType.toLowerCase()] ?? 9
    return ao - bo
  })
}

function parseSafeJson<T>(str: string | null | undefined): T | null {
  if (!str) return null
  try { return JSON.parse(str) as T } catch { return null }
}

// ─── Briefing age helpers ─────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 60 * 1000 // 5 hours

function briefingAgeMs(generatedAt: string | Date | undefined): number {
  if (!generatedAt) return Infinity
  return Date.now() - new Date(generatedAt).getTime()
}

function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 7_200_000) return `1h ago`
  return `${Math.floor(ms / 3_600_000)}h ago`
}

// ─── Active Day Ring ──────────────────────────────────────────────────────────

function ActiveDayRing() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const DAY_START = 7 * 60   // 07:00 in minutes
  const DAY_END   = 22 * 60  // 22:00 in minutes
  const TOTAL     = DAY_END - DAY_START // 900 min

  const current = now.getHours() * 60 + now.getMinutes()

  let phase: 'before' | 'active' | 'after' = 'active'
  let remainMin = TOTAL
  let remainPct = 1

  if (current < DAY_START) {
    phase = 'before'
  } else if (current >= DAY_END) {
    phase = 'after'
    remainMin = 0
    remainPct = 0
  } else {
    phase = 'active'
    remainMin = DAY_END - current
    remainPct = remainMin / TOTAL
  }

  const remH = Math.floor(remainMin / 60)
  const remM = remainMin % 60

  // SVG ring
  const R = 40
  const SW = 5
  const SZ = (R + SW) * 2 + 4
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - remainPct)
  const ringColor = remainPct > 0.4 ? '#7FD5AA' : remainPct > 0.2 ? '#ECC666' : '#FF9B87'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: SZ, height: SZ }}>
        <svg
          width={SZ}
          height={SZ}
          style={{ display: 'block', transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle cx={SZ / 2} cy={SZ / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
          {/* Progress */}
          <circle
            cx={SZ / 2}
            cy={SZ / 2}
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 2s ease, stroke 1s ease' }}
          />
        </svg>
        {/* Centre text */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center',
            lineHeight: 1.2,
            pointerEvents: 'none',
          }}
        >
          {phase === 'active' && (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: ringColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                {Math.round(remainPct * 100)}%
              </div>
              <div style={{ fontSize: 9, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>left</div>
            </>
          )}
          {phase === 'before' && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#B8A4FF', lineHeight: 1.5 }}>Starts<br />07:00</div>
          )}
          {phase === 'after' && (
            <div style={{ fontSize: 10, color: '#6E6E73', lineHeight: 1.5 }}>Day<br />done</div>
          )}
        </div>
      </div>

      {/* Time below ring */}
      <div style={{ textAlign: 'center' }}>
        {phase === 'active' ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {remH}h&nbsp;{String(remM).padStart(2, '0')}m
            </div>
            <div style={{ fontSize: 9, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>remaining</div>
          </>
        ) : phase === 'before' ? (
          <div style={{ fontSize: 10, color: '#6E6E73' }}>07:00 – 22:00</div>
        ) : (
          <div style={{ fontSize: 10, color: '#6E6E73' }}>Reset 07:00</div>
        )}
      </div>
    </div>
  )
}

// ─── World Briefing Item ───────────────────────────────────────────────────────

function WorldBriefingItem({ item }: { item: WorldItem }) {
  const [open, setOpen] = useState(false)
  const catColor = CATEGORY_COLOR[item.category?.toLowerCase()] ?? '#6E6E73'

  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        {item.category && (
          <span style={{
            fontSize: 8, padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2,
            background: `${catColor}18`, color: catColor,
            fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {item.category}
          </span>
        )}
        <span style={{ fontSize: 12, color: '#F5F5F7', lineHeight: 1.45, flex: 1 }}>{item.headline}</span>
        {item.why && (
          <span style={{ fontSize: 10, color: '#6E6E73', flexShrink: 0, marginTop: 2 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>
      {open && item.why && (
        <div style={{
          fontSize: 11, color: '#A1A1A6', marginTop: 5,
          paddingLeft: item.category ? 48 : 0,
          lineHeight: 1.55, fontStyle: 'italic',
        }}>
          → {item.why}
        </div>
      )}
    </div>
  )
}

// ─── Relevant Update Item ─────────────────────────────────────────────────────

function RelevantUpdateItem({ item }: { item: RelevantItem }) {
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#B8A4FF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
        {item.topic}
      </div>
      <div style={{ fontSize: 12, color: '#A1A1A6', lineHeight: 1.45 }}>{item.update}</div>
    </div>
  )
}

// ─── Intelligence skeleton ─────────────────────────────────────────────────────

function Skel({ w, h = 12 }: { w: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 5,
      background: 'rgba(255,255,255,0.06)',
      animation: 'pulse 1.6s ease-in-out infinite',
      marginBottom: 6,
    }} />
  )
}

function IntelligenceSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <Skel w="60%" h={10} />
        {[85, 70, 90].map(w => <Skel key={w} w={`${w}%`} />)}
      </div>
      <div>
        <Skel w="50%" h={10} />
        {[75, 80].map(w => <Skel key={w} w={`${w}%`} />)}
      </div>
    </div>
  )
}

// ─── Priority Item ────────────────────────────────────────────────────────────

function PriorityItem({
  task,
  briefItem,
  onToggle,
  toggling,
}: {
  task: WeeklyTask
  briefItem?: BriefingPriority
  onToggle: (id: string) => void
  toggling: string | null
}) {
  const [hovered, setHovered] = useState(false)
  const priority = briefItem?.priority ?? (task.priority === 1 ? 'must' : task.priority === 3 ? 'optional' : 'should')
  const color = PRIORITY_COLOR[priority]
  const isToggling = toggling === task.id

  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
      {/* Large hit-area button wrapping a small visual circle */}
      <button
        onClick={() => onToggle(task.id)}
        disabled={isToggling}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Mark complete"
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: hovered ? `${color}10` : 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.12s',
          marginTop: -6,
          marginLeft: -6,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `2px solid ${hovered ? color : `${color}66`}`,
            background: isToggling ? `${color}20` : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color 0.12s, background 0.12s',
            pointerEvents: 'none',
          }}
        >
          {isToggling && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 0.8s ease-in-out infinite' }} />
          )}
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#F5F5F7', fontWeight: 600, lineHeight: 1.4 }}>{task.title}</div>
        {task.goal && (
          <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>→ {task.goal.title}</div>
        )}
        {briefItem?.whyToday ? (
          <div style={{ fontSize: 11, color: '#6E6E73', fontStyle: 'italic', marginTop: 2, lineHeight: 1.4 }}>{briefItem.whyToday}</div>
        ) : task.effort > 0 ? (
          <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>{EFFORT_LABEL[task.effort]}</div>
        ) : null}
      </div>

      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color, flexShrink: 0, marginTop: 4 }}>
        {PRIORITY_LABEL[priority]}
      </span>
    </div>
  )
}

// ─── Fitness Snapshot ─────────────────────────────────────────────────────────

function FitnessSnapshot({ strategy, fitnessLog }: { strategy: FitnessStrategy | null; fitnessLog: FitnessLog | null }) {
  const today = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[today.getDay()]

  const schedule = parseSafeJson<Array<{ day: string; sessions: string[] }>>(strategy?.weeklySchedule)
  const todayEntry = schedule?.find(d => d.day.toLowerCase() === todayName.toLowerCase())
  const todaySessions = todayEntry?.sessions ?? []

  const nutritionDir = parseSafeJson<{ proteinTarget?: number; targetProtein?: number }>(strategy?.nutritionDir)
  const targetProtein = nutritionDir?.proteinTarget ?? nutritionDir?.targetProtein

  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
        Today&apos;s Fitness
      </div>
      {todaySessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {todaySessions.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#B8A4FF' }}>▸</span>
              <span style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 500 }}>{s}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E73' }}>Rest day</div>
      )}

      {(fitnessLog?.weight || targetProtein) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {fitnessLog?.weight && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F7' }}>{fitnessLog.weight} kg</div>
              <div style={{ fontSize: 10, color: '#6E6E73' }}>last weighed</div>
            </div>
          )}
          {targetProtein && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#7FD5AA' }}>{targetProtein}g</div>
              <div style={{ fontSize: 10, color: '#6E6E73' }}>protein target</div>
            </div>
          )}
        </div>
      )}

      <Link href="/fitness" style={{ display: 'block', marginTop: 9, fontSize: 11, color: '#6E6E73', textDecoration: 'none' }}>
        Fitness details →
      </Link>
    </div>
  )
}

// ─── Meal Preview ─────────────────────────────────────────────────────────────

function MealPreview({ meals, label, href }: { meals: PlannedMeal[]; label: string; href?: string }) {
  const sorted = sortMeals(meals)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
          {label}
        </div>
        {href && (
          <Link href={href} style={{ fontSize: 11, color: '#B8A4FF', textDecoration: 'none' }}>Full plan →</Link>
        )}
      </div>

      {sorted.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sorted.map(meal => (
            <div key={meal.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6E6E73', minWidth: 60, paddingTop: 1 }}>
                {meal.mealType}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 500 }}>{meal.title}</div>
                {(meal.calories || meal.protein) && (
                  <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>
                    {meal.calories ? `${meal.calories} kcal` : ''}
                    {meal.calories && meal.protein ? ' · ' : ''}
                    {meal.protein ? `${meal.protein}g protein` : ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E73' }}>
          No meal plan.{' '}
          <Link href="/meals" style={{ color: '#B8A4FF', textDecoration: 'none' }}>Generate →</Link>
        </div>
      )}
    </div>
  )
}

// ─── Bullet Directive renderer ────────────────────────────────────────────────

function BulletDirective({ text }: { text: string }) {
  // Split on newlines, strip leading/trailing whitespace
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // First non-bullet line = framing statement; rest = bullet points
  const framing: string[] = []
  const bullets: string[] = []
  let seenBullet = false

  for (const line of lines) {
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      seenBullet = true
      bullets.push(line.replace(/^[•\-\*]\s+/, ''))
    } else if (!seenBullet) {
      framing.push(line)
    } else {
      // continuation after bullets — treat as extra bullet
      bullets.push(line)
    }
  }

  // Fallback: if no bullet markers found, split on '. ' and treat each sentence as a bullet
  if (bullets.length === 0 && framing.length > 0) {
    const sentences = text.split(/(?<=\.)\s+/)
    if (sentences.length > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sentences.filter(Boolean).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: '#B8A4FF', flexShrink: 0, fontSize: 11, marginTop: 2, fontWeight: 800 }}>→</span>
              <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{s.trim()}</span>
            </div>
          ))}
        </div>
      )
    }
    return <div style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.65 }}>{text}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {framing.map((line, i) => (
        <div key={`f${i}`} style={{ fontSize: 13, color: '#F5F5F7', fontWeight: 600, lineHeight: 1.5 }}>
          {line}
        </div>
      ))}
      {bullets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: framing.length ? 6 : 0 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{
                color: '#B8A4FF', flexShrink: 0, fontSize: 13, marginTop: 1,
                lineHeight: 1, fontWeight: 700,
              }}>•</span>
              <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Priority skeleton ────────────────────────────────────────────────────────

function PrioritySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skel w={`${55 + i * 12}%`} h={13} />
            <Skel w="40%" h={10} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyCommandCenter({
  briefing: initialBriefing,
  goals,
  tasks,
  strategy,
  todayMeals,
  fitnessLog,
  userId,
  quarterName,
  weeklyPlanId,
  calendarConnected = false,
  calendarIcsConnected = false,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [briefing, setBriefing] = useState<DailyBriefing | null>(initialBriefing)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(
    initialBriefing?.generatedAt ? new Date(initialBriefing.generatedAt) : null
  )

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

  const clearBriefing = useCallback(async () => {
    await fetch(`/api/dashboard/brief?userId=${userId}`, { method: 'DELETE' })
    setBriefing(null)
    setLastRefreshedAt(null)
    startTransition(() => router.refresh())
  }, [userId, router, startTransition])

  // Auto-generate on mount if no briefing or older than 5 hours; then refresh every 5 hours
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

  async function toggleTask(id: string) {
    setToggling(id)
    await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
    startTransition(() => router.refresh())
    setToggling(null)
  }

  // Parse briefing JSON fields
  const briefPriorities = parseSafeJson<BriefingPriority[]>(briefing?.priorities) ?? []
  // One item per category — deduplicate defensively even if API returns more
  const worldBriefingRaw = parseSafeJson<WorldItem[]>(briefing?.worldBriefing) ?? []
  const worldBriefing = worldBriefingRaw.reduce((acc: WorldItem[], item) => {
    const cat = item.category?.toLowerCase()
    if (!acc.find(x => x.category?.toLowerCase() === cat)) acc.push(item)
    return acc
  }, [])
  const externalContext = briefing?.externalContext ?? null

  // Priority lists
  const incompleteTasks = tasks.filter(t => !t.completed)
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

  const dateStr = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-entrance">
      {/* keyframes are in globals.css */}

      {/* ══ DAILY INTELLIGENCE BAR ══════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(184,164,255,0.05), rgba(255,255,255,0.02))',
        borderRadius: 20,
        border: '1px solid rgba(184,164,255,0.1)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        {/* Bar header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
              Daily Intelligence
            </span>
            <span style={{ fontSize: 11, color: '#6E6E73', marginLeft: 12 }}>
              {dateStr}
            </span>
            {quarterName && (
              <span style={{ fontSize: 10, color: '#6E6E73', marginLeft: 10, opacity: 0.7 }}>· {quarterName}</span>
            )}
            {lastRefreshedAt && !loadingBrief && (
              <span style={{ fontSize: 10, color: '#6E6E73', marginLeft: 10, opacity: 0.6 }}>
                · {formatAge(Date.now() - lastRefreshedAt.getTime())}
              </span>
            )}
          </div>
          {loadingBrief && (
            <Spinner size={14} color="#B8A4FF" strokeWidth={1.8} />
          )}
        </div>

        {/* Bar body: Ring + Intelligence */}
        <div className="r-grid-intel">

          {/* LEFT — Day ring */}
          <div className="intel-ring-col" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            paddingRight: 28,
            paddingTop: 4,
          }}>
            <ActiveDayRing />
          </div>

          {/* RIGHT — Intelligence columns */}
          {loadingBrief && worldBriefing.length === 0 ? (
            <IntelligenceSkeleton />
          ) : (
            <div key={briefing?.id ?? 'empty'} className="animate-fade-in">
              {/* World Briefing — full width, one per category */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 24px' }}>
                {worldBriefing.length > 0 ? (
                  worldBriefing.map((item, i) => (
                    <WorldBriefingItem key={i} item={item} />
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic', paddingTop: 8 }}>
                    Generate briefing to see today&apos;s world summary.
                  </div>
                )}
              </div>

              {/* External context */}
              {externalContext && (
                <div style={{
                  marginTop: 10,
                  padding: '7px 10px',
                  background: 'rgba(236,198,102,0.06)',
                  border: '1px solid rgba(236,198,102,0.18)',
                  borderRadius: 8,
                  fontSize: 11, color: '#ECC666', lineHeight: 1.5,
                }}>
                  ☀️ {externalContext}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ TWO-COLUMN BODY ══════════════════════════════════════════════════ */}
      <div className="r-grid-2">

        {/* LEFT — Directive + Today's Priorities */}
        <div className="card">
          {/* Strategic Directive — purple left border applies only to the directive text */}
          <div style={{ borderLeft: '3px solid #B8A4FF', paddingLeft: 14, marginBottom: briefing?.instruction ? 10 : 18 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 6 }}>
              This Week&apos;s Directive
            </div>
            {loadingBrief && !briefing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skel w="95%" h={13} />
                <Skel w="82%" h={13} />
                <Skel w="70%" h={13} />
              </div>
            ) : briefing?.directive ? (
              <div className="animate-fade-in"><BulletDirective text={briefing.directive} /></div>
            ) : (
              <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic' }}>
                Click ↻ above to generate today&apos;s briefing.
              </div>
            )}
          </div>

          {/* Today block — OUTSIDE purple border, below directive */}
          {briefing?.instruction && (
            <div style={{ marginTop: 16, marginBottom: 18, padding: '8px 12px', background: 'rgba(127,213,170,0.05)', borderRadius: 8, border: '1px solid rgba(127,213,170,0.15)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7FD5AA', marginBottom: 4 }}>
                Today
              </div>
              <span style={{ fontSize: 12, color: '#A1A1A6', lineHeight: 1.6 }}>{briefing.instruction}</span>
            </div>
          )}

          {/* Today's Priorities */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
              Today&apos;s Priorities
            </div>

            {loadingBrief && incompleteTasks.length === 0 ? (
              <PrioritySkeleton />
            ) : incompleteTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic' }}>
                No tasks this week.{' '}
                <Link href="/quarterly" style={{ color: '#B8A4FF', textDecoration: 'none' }}>Set up a plan →</Link>
              </div>
            ) : (
              <>
                {mustDo.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#FF9B87', marginBottom: 2 }}>Must Do</div>
                    {mustDo.map(t => <PriorityItem key={t.id} task={t} briefItem={findBriefItem(t)} onToggle={toggleTask} toggling={toggling} />)}
                  </div>
                )}
                {shouldDo.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ECC666', marginBottom: 2 }}>Should Do</div>
                    {shouldDo.map(t => <PriorityItem key={t.id} task={t} briefItem={findBriefItem(t)} onToggle={toggleTask} toggling={toggling} />)}
                  </div>
                )}
                {optional.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 2 }}>Optional</div>
                    {optional.map(t => <PriorityItem key={t.id} task={t} briefItem={findBriefItem(t)} onToggle={toggleTask} toggling={toggling} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Calendar → Tasks → Fitness → Meals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Calendar */}
          <CalendarWidget
            userId={userId}
            date={new Date().toISOString().split('T')[0]}
            calendarConnected={calendarConnected}
            calendarIcsConnected={calendarIcsConnected}
          />

          {/* 2. This Week — Tasks */}
          <TodayTasks tasks={tasks} weeklyPlanId={weeklyPlanId} />

          {/* 3. Today's Fitness */}
          <FitnessSnapshot strategy={strategy} fitnessLog={fitnessLog} />

          {/* 4. Today's Meals */}
          <MealPreview meals={todayMeals} label="Today's Meals" href="/meals" />
        </div>
      </div>
    </div>
  )
}
