'use client'
import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalendarWidget from '@/components/calendar/CalendarWidget'
import Spinner from '@/components/ui/Spinner'
import { Globe, Cpu, TrendingUp, Briefcase, Users, Activity, Timer, Cloud, Shirt, Target, RotateCw, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
  dailyFacts: string | null
  generatedAt: string | Date
}

interface DailyFact {
  category: 'psychology' | 'health' | 'fitness'
  fact: string
  whyItMatters: string
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
  estimatedMinutes?: number | null
  goal?: { id: string; title: string; category: string } | null
  sourceModule?: string | null
  sourceType?:   string | null
  sourceId?:     string | null
}

const SOURCE_LINK: Record<string, { href: string; label: string }> = {
  learning:  { href: '/learning',           label: 'Learning →' },
  fitness:   { href: '/fitness/strategy',   label: 'Fitness →' },
  career:    { href: '/career/trajectory',  label: 'Career →' },
  report:    { href: '/reports',            label: 'Reports →' },
  goal:      { href: '/quarterly',          label: 'Goals →' },
  manual:    { href: '/weekly',             label: 'Weekly →' },
  system:    { href: '/weekly',             label: 'Weekly →' },
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

interface MicroStep {
  title: string
  estimatedMinutes: number
}

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
const EFFORT_MINUTES: Record<number, string> = { 1: '~15m', 2: '~25m', 3: '~45m' }
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }

const INTEL_COLORS: Record<string, string> = {
  geopolitics:  '#C8A06A',
  business:     '#B89A3E',
  tech:         '#8E80C4',
  society:      '#5E94BB',
  science:      '#5EAA88',
  markets:      '#B06E7E',
  psychology:   '#B06E7E',
  health:       '#5EAA88',
  fitness:      '#5EAA88',
  nutrition:    '#B89A3E',
  recovery:     '#8E80C4',
  productivity: '#C8A06A',
  habits:       '#B06E7E',
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

function getTimeLabel(): string | null {
  const h = new Date().getHours()
  if (h >= 6 && h < 11)  return '🌅 Good morning'
  if (h >= 11 && h < 14) return '☀️ Late morning'
  if (h >= 14 && h < 18) return '🌤 Afternoon'
  if (h >= 18 && h < 22) return '🌙 Evening'
  return null
}

function effortTimeLabel(effort: number): string {
  return EFFORT_MINUTES[effort] ?? ''
}

// ─── Briefing age helpers ─────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 60 * 1000

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

  const DAY_START = 7 * 60
  const DAY_END   = 22 * 60
  const TOTAL     = DAY_END - DAY_START

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

  const R = 40
  const SW = 5
  const SZ = (R + SW) * 2 + 4
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - remainPct)
  const ringColor = remainPct > 0.4 ? '#7FD5AA' : remainPct > 0.2 ? '#ECC666' : '#FF9B87'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: SZ, height: SZ }}>
        <svg width={SZ} height={SZ} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
          <circle cx={SZ / 2} cy={SZ / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
          <circle
            cx={SZ / 2} cy={SZ / 2} r={R}
            fill="none" stroke={ringColor} strokeWidth={SW}
            strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 2s ease, stroke 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', textAlign: 'center',
          lineHeight: 1.2, pointerEvents: 'none',
        }}>
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

// ─── Bio Clock ────────────────────────────────────────────────────────────────

const CLOCK_H = 186
const BIO_START = 7
const BIO_END = 22
const BIO_TOTAL = BIO_END - BIO_START

function toPct(h: number, m = 0) {
  return Math.min(1, Math.max(0, (h + m / 60 - BIO_START) / BIO_TOTAL))
}

const BIO_ZONES = [
  { start: 7,  end: 9,  accent: '#C8A06A', label: 'Ramp Up',    bestFor: 'Light tasks, admin, morning routine' },
  { start: 9,  end: 12, accent: '#5EAA88', label: 'Peak Focus', bestFor: 'Deep work, complex decisions, writing' },
  { start: 12, end: 14, accent: '#6E6E73', label: 'Low Tide',   bestFor: 'Lunch, light reading, short breaks' },
  { start: 14, end: 17, accent: '#5E94BB', label: '2nd Wind',   bestFor: 'Collaboration, calls, creative work' },
  { start: 17, end: 20, accent: '#C8906A', label: 'Wind Down',  bestFor: 'Review, planning, low-intensity work' },
  { start: 20, end: 22, accent: '#8E80C4', label: 'Recovery',   bestFor: 'Rest, reading, reflection' },
]

function BioClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const h = now.getHours()
  const m = now.getMinutes()
  const nowPct = toPct(h, m)
  const isActive = h >= BIO_START && h < BIO_END
  const currentZone = BIO_ZONES.find(z => h >= z.start && h < z.end)
  const nextZone = BIO_ZONES.find(z => z.start > h) ?? null
  const minsToNext = nextZone ? (nextZone.start * 60) - (h * 60 + m) : null
  const accent = currentZone?.accent ?? '#6E6E73'
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  // Circular gauge constants
  const SZ = 148, CX = 74, CY = 80, R = 54, SW = 8
  const ARC_START = 225  // degrees from top, clockwise
  const ARC_SWEEP = 270  // total sweep

  function gaugeXY(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180
    return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) }
  }

  function gaugePath(fromDeg: number, toDeg: number, r: number): string {
    const sweep = ((toDeg - fromDeg) % 360 + 360) % 360
    if (sweep < 0.5) return ''
    const s = gaugeXY(fromDeg, r)
    const e = gaugeXY(toDeg, r)
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }

  const bgPath = gaugePath(ARC_START, ARC_START + ARC_SWEEP, R)
  const progressEndDeg = ARC_START + nowPct * ARC_SWEEP
  const progressPath = isActive && nowPct > 0.01
    ? gaugePath(ARC_START, progressEndDeg, R)
    : ''
  const dotPos = isActive ? gaugeXY(progressEndDeg, R) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Arc + time */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: SZ, height: SZ }}>
          <svg width={SZ} height={SZ} style={{ display: 'block', overflow: 'visible' }}>
            {/* Background arc */}
            <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} strokeLinecap="round" />
            {/* Zone-tinted arc segments */}
            {BIO_ZONES.map(z => {
              const zFrom = ARC_START + toPct(z.start) * ARC_SWEEP
              const zTo = ARC_START + toPct(z.end) * ARC_SWEEP
              return (
                <path key={z.label} d={gaugePath(zFrom, zTo, R)} fill="none"
                  stroke={z.accent + '28'} strokeWidth={SW} />
              )
            })}
            {/* Progress arc */}
            {progressPath && (
              <path d={progressPath} fill="none" stroke={accent} strokeWidth={SW} strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 5px ${accent}70)`, transition: 'stroke 1s ease' }} />
            )}
            {/* Zone separator ticks */}
            {BIO_ZONES.slice(1).map(z => {
              const tickDeg = ARC_START + toPct(z.start) * ARC_SWEEP
              const inner = gaugeXY(tickDeg, R - SW / 2 - 1)
              const outer = gaugeXY(tickDeg, R + SW / 2 + 1)
              return (
                <line key={z.label} x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
                  x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
                  stroke="rgba(10,10,12,0.9)" strokeWidth={1.5} />
              )
            })}
            {/* Current position dot */}
            {dotPos && (
              <circle cx={dotPos.x.toFixed(2)} cy={dotPos.y.toFixed(2)} r={5} fill={accent}
                style={{ filter: `drop-shadow(0 0 7px ${accent})` }} />
            )}
          </svg>
          {/* Center text */}
          <div style={{
            position: 'absolute', top: '46%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#F5F5F7', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 5 }}>
              {currentZone?.label ?? (h < BIO_START ? 'Before day' : 'After day')}
            </div>
          </div>
        </div>
      </div>

      {/* Best for */}
      {currentZone && (
        <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3E3E44', marginBottom: 4 }}>
            Best for
          </div>
          <div style={{ fontSize: 11, color: '#8E8E93', lineHeight: 1.5 }}>{currentZone.bestFor}</div>
        </div>
      )}

      {/* Next state */}
      {nextZone && minsToNext != null && minsToNext > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <span style={{ fontSize: 9, color: '#3E3E44', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: nextZone.accent }}>{nextZone.label}</span>
            <span style={{ fontSize: 10, color: '#52525A', marginLeft: 6 }}>
              in {minsToNext >= 60 ? `${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m` : `${minsToNext}m`}
            </span>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
        {BIO_ZONES.map(z => {
          const isCurrent = z === currentZone
          return (
            <div key={z.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: isCurrent ? 1 : 0.3 }}>
              <div style={{ width: isCurrent ? 18 : 12, height: 2.5, borderRadius: 2, background: isCurrent ? z.accent : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
              <span style={{ fontSize: 5.5, color: isCurrent ? z.accent : '#52525A', letterSpacing: '0.04em', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                {z.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Intel Card ───────────────────────────────────────────────────────────────

interface IntelItem {
  category: string
  headline: string
  why: string
}

const INTEL_ICON_MAP: Record<string, LucideIcon> = {
  geopolitics:  Globe,
  tech:         Cpu,
  markets:      TrendingUp,
  business:     Briefcase,
  society:      Users,
  science:      Activity,
  fitness:      Activity,
  health:       Activity,
  psychology:   Activity,
  nutrition:    Activity,
  productivity: Target,
  habits:       Activity,
  recovery:     Activity,
}

function IntelCard({ item }: { item: IntelItem }) {
  const [open, setOpen] = useState(false)
  const catColor = INTEL_COLORS[item.category?.toLowerCase()] ?? '#6E6E73'
  const IconComp = INTEL_ICON_MAP[item.category?.toLowerCase()] ?? Globe

  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{
        padding: '12px 13px', borderRadius: 16,
        background: open ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${catColor}AA`,
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
        transition: 'background 0.15s',
        boxShadow: open ? '0 4px 24px rgba(0,0,0,0.25)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconComp size={10} color={catColor} strokeWidth={2} />
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: catColor }}>
            {item.category}
          </span>
        </div>
        <ChevronDown size={10} color="#444" strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 12, color: '#D4D4D8', lineHeight: 1.5, fontWeight: 450 }}>
        {item.headline}
      </div>
      {open && item.why && (
        <div style={{
          fontSize: 11, color: '#7A7A84', lineHeight: 1.6,
          borderTop: `1px solid ${catColor}22`,
          paddingTop: 8, marginTop: 1,
        }}>
          {item.why}
        </div>
      )}
    </div>
  )
}

// ─── Daily facts ──────────────────────────────────────────────────────────────

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// ─── Priority Item ────────────────────────────────────────────────────────────

function PriorityItem({
  task,
  briefItem,
  onToggle,
  toggling,
  celebTaskId,
  onBreakSteps,
  loadingSteps,
  expandedSteps,
}: {
  task: WeeklyTask
  briefItem?: BriefingPriority
  onToggle: (id: string) => void
  toggling: string | null
  celebTaskId: string | null
  onBreakSteps: (id: string) => void
  loadingSteps: string | null
  expandedSteps: Record<string, MicroStep[]>
}) {
  const [hovered, setHovered] = useState(false)
  const priority = briefItem?.priority ?? (task.priority === 1 ? 'must' : task.priority === 3 ? 'optional' : 'should')
  const color = PRIORITY_COLOR[priority]
  const isToggling = toggling === task.id
  const isCelebrating = celebTaskId === task.id
  const timeLabel = task.estimatedMinutes ? `~${task.estimatedMinutes}m` : effortTimeLabel(task.effort)
  const steps = expandedSteps[task.id]
  const isLoadingThisStep = loadingSteps === task.id

  return (
    <div>
      <style>{`
        @keyframes celebFlash {
          0% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderBottom: steps ? 'none' : '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
        <button
          onClick={() => onToggle(task.id)}
          disabled={isToggling}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title="Mark complete"
          style={{
            width: 36, height: 36, minWidth: 36, borderRadius: 10, flexShrink: 0,
            background: isCelebrating ? `${color}20` : hovered ? `${color}10` : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'background 0.12s', marginTop: -6, marginLeft: -6,
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: `2px solid ${isCelebrating ? color : hovered ? color : `${color}66`}`,
            background: isToggling ? `${color}20` : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.12s, background 0.12s', pointerEvents: 'none',
          }}>
            {isToggling && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 0.8s ease-in-out infinite' }} />
            )}
            {isCelebrating && !isToggling && (
              <span style={{
                fontSize: 10, color, fontWeight: 900,
                animation: 'celebFlash 1.2s ease-out forwards',
              }}>✓</span>
            )}
          </div>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: '#F5F5F7', fontWeight: 600, lineHeight: 1.4,
            position: 'relative',
          }}>
            {task.title}
            {isCelebrating && (
              <span style={{
                marginLeft: 8, fontSize: 11, color: '#7FD5AA', fontWeight: 700,
                animation: 'fadeOut 1.2s ease-out forwards',
                position: 'absolute',
              }}>
                +1 ✓
              </span>
            )}
          </div>
          {task.goal && (
            <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>→ {task.goal.title}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            {task.effort > 0 && (
              <span style={{ fontSize: 10, color: '#6E6E73' }}>{EFFORT_LABEL[task.effort]}</span>
            )}
            {timeLabel && (
              <span style={{
                fontSize: 9, color: '#52525A', background: 'rgba(255,255,255,0.05)',
                padding: '1px 5px', borderRadius: 4, fontWeight: 600,
              }}>
                {timeLabel}
              </span>
            )}
            {briefItem?.whyToday && (
              <span style={{ fontSize: 11, color: '#6E6E73', fontStyle: 'italic', lineHeight: 1.4 }}>{briefItem.whyToday}</span>
            )}
            {task.sourceModule && SOURCE_LINK[task.sourceModule] && (
              <Link
                href={SOURCE_LINK[task.sourceModule].href}
                style={{ fontSize: 10, color: '#6E6E7380', textDecoration: 'none', letterSpacing: '0.02em' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#B8A4FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6E6E7380')}
              >
                {SOURCE_LINK[task.sourceModule].label}
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
          <button
            onClick={() => onBreakSteps(task.id)}
            disabled={isLoadingThisStep}
            title="Break into micro-steps"
            style={{
              fontSize: 9, color: '#52525A', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
              padding: '2px 6px', cursor: 'pointer',
              opacity: isLoadingThisStep ? 0.5 : 1,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#B8A4FF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525A')}
          >
            {isLoadingThisStep ? '…' : '⋯ Steps'}
          </button>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color }}>
            {PRIORITY_LABEL[priority]}
          </span>
        </div>
      </div>

      {/* Micro-steps expansion */}
      {steps && (
        <div style={{
          marginLeft: 30, marginBottom: 8, padding: '8px 10px',
          background: 'rgba(184,164,255,0.05)', border: '1px solid rgba(184,164,255,0.15)',
          borderRadius: 8, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
              <span style={{ fontSize: 9, color: '#52525A', minWidth: 14, textAlign: 'right' }}>{i + 1}.</span>
              <span style={{ fontSize: 11, color: '#A1A1A6', flex: 1, lineHeight: 1.45 }}>{step.title}</span>
              <span style={{ fontSize: 9, color: '#52525A', flexShrink: 0 }}>~{step.estimatedMinutes}m</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Fitness Snapshot ─────────────────────────────────────────────────────────

function FitnessSnapshot({ strategy, userId, onWorkoutLogged }: { strategy: FitnessStrategy | null; userId?: string; onWorkoutLogged?: () => void }) {
  const [loggingSession, setLoggingSession] = useState<string | null>(null)
  const [loggedSessions, setLoggedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    fetch(`/api/fitness/workout?userId=${userId}`)
      .then(r => r.json())
      .then((types: string[]) => setLoggedSessions(new Set(types)))
      .catch(() => {})
  }, [userId])

  const today = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[today.getDay()]

  const schedule = parseSafeJson<Array<{ day: string; sessions: string[] }>>(strategy?.weeklySchedule)
  const todayEntry = schedule?.find(d => d.day.toLowerCase() === todayName.toLowerCase())
  const todaySessions = todayEntry?.sessions ?? []

  const nutritionDir = parseSafeJson<{ proteinTarget?: number; targetProtein?: number }>(strategy?.nutritionDir)
  const targetProtein = nutritionDir?.proteinTarget ?? nutritionDir?.targetProtein

  async function logSession(sessionName: string) {
    if (!userId) return
    setLoggingSession(sessionName)
    try {
      // Extract duration from session name if present, e.g. "Stairmaster Cardio (20–25 min)" → 22
      const durationMatch = sessionName.match(/(\d+)(?:[–-](\d+))?\s*min/i)
      const duration = durationMatch
        ? durationMatch[2]
          ? Math.round((parseInt(durationMatch[1]) + parseInt(durationMatch[2])) / 2)
          : parseInt(durationMatch[1])
        : 30
      await fetch('/api/fitness/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: sessionName, duration, notes: null }),
      })
      setLoggedSessions(prev => new Set([...prev, sessionName]))
      onWorkoutLogged?.()
    } finally {
      setLoggingSession(null)
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
        Today&apos;s Fitness
      </div>
      {todaySessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {todaySessions.map((s, i) => {
            const done = loggedSessions.has(s)
            const isLogging = loggingSession === s
            return (
              <button
                key={i}
                onClick={() => !done && logSession(s)}
                disabled={isLogging || done}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', cursor: done ? 'default' : 'pointer',
                  padding: '3px 0', textAlign: 'left', width: '100%',
                  opacity: isLogging ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${done ? '#7FD5AA' : 'rgba(255,255,255,0.2)'}`,
                  background: done ? 'rgba(127,213,170,0.2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="#7FD5AA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {isLogging && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A3D977', animation: 'pulse 0.8s ease-in-out infinite' }} />}
                </div>
                <span style={{
                  fontSize: 12, color: done ? '#6E6E73' : '#F5F5F7', fontWeight: 500,
                  textDecoration: done ? 'line-through' : 'none', transition: 'all 0.2s',
                }}>{s}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E73' }}>Rest day</div>
      )}

      <Link href="/fitness" style={{ display: 'block', marginTop: 9, fontSize: 11, color: '#6E6E73', textDecoration: 'none' }}>
        Fitness details →
      </Link>
    </div>
  )
}

// ─── Meal Preview ─────────────────────────────────────────────────────────────

function TodaysMeetings({ events, workStartMin, workEndMin }: { events: Array<{ start: Date; end: Date }>; workStartMin: number; workEndMin: number }) {
  const now = new Date()
  const todayEvents = events.filter(e => {
    const eStart = e.start.getHours() * 60 + e.start.getMinutes()
    return eStart >= now.getHours() * 60 + now.getMinutes() // Future events only
  }).sort((a, b) => a.start.getTime() - b.start.getTime())

  if (todayEvents.length === 0) {
    return (
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
          Today's Meetings
        </div>
        <div style={{ fontSize: 12, color: '#6E6E73' }}>No upcoming meetings</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
        Today's Meetings
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {todayEvents.map((event, i) => {
          const startH = event.start.getHours(), startM = event.start.getMinutes()
          const endH = event.end.getHours(), endM = event.end.getMinutes()
          const startMin = startH * 60 + startM
          const endMin = endH * 60 + endM
          const isDuringWork = startMin >= workStartMin && endMin <= workEndMin
          const isPostWork = startMin >= workEndMin
          const eventColor = isPostWork ? '#ECC666' : isDuringWork ? '#80BDFF' : '#6E6E73'
          const durationMin = endMin - startMin
          const durationLabel = durationMin > 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
            : `${durationMin}m`

          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ minWidth: 45, paddingTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: eventColor, fontVariantNumeric: 'tabular-nums' }}>
                  {String(startH).padStart(2, '0')}:{String(startM).padStart(2, '0')}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 500 }}>
                  {event.start.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} – {event.end.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 1 }}>{durationLabel} · {isPostWork ? '⚠️ Post-work' : isDuringWork ? 'Work hours' : 'Personal'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getNextMealTime(meal: PlannedMeal): { minutesUntil: number; timeStr: string } | null {
  const now = new Date()
  const mealHour = meal.mealType.toLowerCase() === 'breakfast' ? 7
    : meal.mealType.toLowerCase() === 'lunch' ? 12
    : meal.mealType.toLowerCase() === 'dinner' ? 18
    : meal.mealType.toLowerCase() === 'snack' ? 15
    : null

  if (!mealHour) return null

  const today = new Date()
  today.setHours(mealHour, 0, 0, 0)
  const nextMeal = today > now ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const diff = nextMeal.getTime() - now.getTime()
  const minutesUntil = Math.round(diff / (60 * 1000))

  if (minutesUntil < 0) return null
  const h = Math.floor(minutesUntil / 60)
  const m = minutesUntil % 60
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`

  return { minutesUntil, timeStr }
}

function MealPreview({ meals, label, href, isTomorrow = false, todayProtein = 0, proteinTarget = null }: { meals: PlannedMeal[]; label: string; href?: string; isTomorrow?: boolean; todayProtein?: number; proteinTarget?: number | null }) {
  const sorted = sortMeals(meals)
  const showProtein = !isTomorrow && proteinTarget && proteinTarget > 0
  const proteinPct = showProtein ? Math.min(100, Math.round((todayProtein / proteinTarget!) * 100)) : 0
  const proteinColor = proteinPct >= 100 ? '#7FD5AA' : proteinPct >= 70 ? '#ECC666' : '#FF9B87'

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showProtein ? 8 : 10 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' }}>
          {label}
        </div>
        {href && (
          <Link href={href} style={{ fontSize: 11, color: '#B8A4FF', textDecoration: 'none' }}>Full plan →</Link>
        )}
      </div>

      {showProtein && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Protein today</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: proteinColor, fontVariantNumeric: 'tabular-nums' }}>
              {todayProtein}g
              <span style={{ fontSize: 10, fontWeight: 400, color: '#52525A' }}> / {proteinTarget}g</span>
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${proteinPct}%`, borderRadius: 999,
              background: proteinColor, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {sorted.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sorted.map(meal => {
            const timing = !isTomorrow ? getNextMealTime(meal) : null
            const isOverdue = timing && timing.minutesUntil < 0
            const isDueSoon = timing && timing.minutesUntil >= 0 && timing.minutesUntil < 30
            const mealColor = isOverdue ? '#FF9B87' : isDueSoon ? '#ECC666' : '#6E6E73'

            return (
              <div key={meal.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: mealColor, minWidth: 60, paddingTop: 1 }}>
                  {meal.mealType}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 500 }}>{meal.title}</div>
                  <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {meal.calories ? `${meal.calories} kcal` : ''}
                    {meal.calories && meal.protein ? ' · ' : ''}
                    {meal.protein ? `${meal.protein}g protein` : ''}
                    {timing && timing.minutesUntil >= 0 && (
                      <>
                        <span style={{ color: '#3E3E44' }}>·</span>
                        <span style={{ color: isDueSoon ? '#ECC666' : '#6E6E73', fontWeight: isDueSoon ? 600 : 400 }}>
                          {isDueSoon ? `⏰ in ${timing.timeStr}` : `in ${timing.timeStr}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E73' }}>
          {isTomorrow ? 'No meals scheduled.' : 'No meal plan.'} {!isTomorrow && (
            <Link href="/meals" style={{ color: '#B8A4FF', textDecoration: 'none' }}>Generate →</Link>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Bullet Directive renderer ────────────────────────────────────────────────

function BulletDirective({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

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
      bullets.push(line)
    }
  }

  // No bullets case
  if (bullets.length === 0 && framing.length > 0) {
    const sentences = text.split(/(?<=\.)\s+/)
    if (sentences.length > 1) {
      const shown = expanded ? sentences : [sentences[0]]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.filter(Boolean).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: '#B8A4FF', flexShrink: 0, fontSize: 11, marginTop: 2, fontWeight: 800 }}>→</span>
              <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{s.trim()}</span>
            </div>
          ))}
          {sentences.length > 1 && (
            <button onClick={onToggle} style={{ alignSelf: 'flex-start', fontSize: 10, color: '#52525A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
              {expanded ? 'Collapse ↑' : 'Show all ↓'}
            </button>
          )}
        </div>
      )
    }
    return <div style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.65 }}>{text}</div>
  }

  // Has framing + bullets
  const framingShown = framing.length > 0 ? framing : []
  const firstBullet = bullets.slice(0, 1)
  const restBullets = bullets.slice(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {framingShown.map((line, i) => (
        <div key={`f${i}`} style={{ fontSize: 13, color: '#F5F5F7', fontWeight: 600, lineHeight: 1.5 }}>
          {line}
        </div>
      ))}
      {/* Always show first bullet */}
      {(framingShown.length === 0 ? firstBullet : (expanded ? bullets : firstBullet)).map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: '#B8A4FF', flexShrink: 0, fontSize: 13, marginTop: 1, lineHeight: 1, fontWeight: 700 }}>•</span>
          <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{b}</span>
        </div>
      ))}
      {/* If framing exists, show rest of bullets only when expanded */}
      {framingShown.length > 0 && expanded && restBullets.map((b, i) => (
        <div key={`rb${i}`} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: '#B8A4FF', flexShrink: 0, fontSize: 13, marginTop: 1, lineHeight: 1, fontWeight: 700 }}>•</span>
          <span style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{b}</span>
        </div>
      ))}
      {(bullets.length > 1 || (framingShown.length > 0 && bullets.length > 0)) && (
        <button onClick={onToggle} style={{ alignSelf: 'flex-start', fontSize: 10, color: '#52525A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
          {expanded ? 'Collapse ↑' : 'Show all ↓'}
        </button>
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

// ─── Focus Mode Overlay ───────────────────────────────────────────────────────

function FocusModeOverlay({
  task,
  onDone,
  onExit,
}: {
  task: WeeklyTask
  onDone: () => void
  onExit: () => void
}) {
  const DURATION = 25 * 60 // 25 minutes in seconds
  const [secondsLeft, setSecondsLeft] = useState(DURATION)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')

  const timeLabel = task.estimatedMinutes
    ? `~${task.estimatedMinutes} min`
    : task.effort === 1 ? '~15 min' : task.effort === 2 ? '~25 min' : task.effort === 3 ? '~45 min' : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10,10,12,0.97)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute', top: 24, right: 24,
          fontSize: 11, color: '#52525A', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer',
        }}
      >
        Exit Focus
      </button>

      {/* Center content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#52525A' }}>
          Focus Mode
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7', lineHeight: 1.35 }}>
          {task.title}
        </div>

        {timeLabel && (
          <span style={{
            fontSize: 12, color: '#A1A1A6', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            padding: '4px 12px',
          }}>
            {timeLabel}
          </span>
        )}

        {/* Timer */}
        <div style={{
          fontSize: 64, fontWeight: 800, color: secondsLeft === 0 ? '#7FD5AA' : '#F5F5F7',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          {mins}:{secs}
        </div>

        {/* Pause/Resume */}
        <button
          onClick={() => setRunning(r => !r)}
          style={{
            fontSize: 13, color: '#A1A1A6', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
            padding: '8px 20px', cursor: 'pointer',
          }}
        >
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>

        {/* Done button */}
        <button
          onClick={onDone}
          style={{
            fontSize: 15, fontWeight: 700, color: '#0A0A0C',
            background: '#7FD5AA', border: 'none', borderRadius: 10,
            padding: '12px 32px', cursor: 'pointer',
          }}
        >
          ✓ Done
        </button>
      </div>
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
  tomorrowMeals,
  userId,
  quarterName,
  weeklyPlanId,
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
  const [directiveExpanded, setDirectiveExpanded] = useState(false)
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high' | null>(null)
  const [morningDismissed, setMorningDismissed] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Record<string, MicroStep[]>>({})
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null)
  const [celebTaskId, setCelebTaskId] = useState<string | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<Array<{ start: Date; end: Date }>>([])

  // Today string for localStorage keys
  const todayStr = new Date().toISOString().split('T')[0]

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

  const clearBriefing = useCallback(async () => {
    await fetch(`/api/dashboard/brief?userId=${userId}`, { method: 'DELETE' })
    setBriefing(null)
    setLastRefreshedAt(null)
    startTransition(() => router.refresh())
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

  async function toggleTask(id: string) {
    setToggling(id)
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Toggle failed')
      // Celebration animation
      setCelebTaskId(id)
      setTimeout(() => setCelebTaskId(null), 1200)
      startTransition(() => router.refresh())
    } catch {
      // Silent
    } finally {
      setToggling(null)
    }
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

  const dateStr = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeContextLabel = getTimeLabel()

  // Focus mode task = first must-do
  const focusTask = mustDo[0] ?? shouldDo[0] ?? null

  return (
    <div className="animate-entrance">
      {/* ── Focus Mode Overlay ── */}
      {focusMode && focusTask && (
        <FocusModeOverlay
          task={focusTask}
          onDone={async () => {
            await toggleTask(focusTask.id)
            setFocusMode(false)
          }}
          onExit={() => setFocusMode(false)}
        />
      )}

      {/* ══ DAILY INTELLIGENCE BAR ══════════════════════════════════════════ */}
      <div style={{
        background: 'rgba(255,255,255,0.018)',
        borderRadius: 28,
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '22px 26px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525A' }}>
              Daily Intelligence
            </span>
            <span style={{ fontSize: 11, color: '#52525A', marginLeft: 12 }}>
              {dateStr}
            </span>
            {quarterName && (
              <span style={{ fontSize: 10, color: '#3E3E44', marginLeft: 10 }}>· {quarterName}</span>
            )}
            {lastRefreshedAt && !loadingBrief && (
              <span style={{ fontSize: 10, color: '#3E3E44', marginLeft: 10 }}>
                · {formatAge(Date.now() - lastRefreshedAt.getTime())}
              </span>
            )}
          </div>
          {loadingBrief && <Spinner size={14} color="#B8A4FF" strokeWidth={1.8} />}
        </div>

        <div className="r-grid-intel">
          <div className="intel-ring-col" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            paddingRight: 20, paddingTop: 4,
          }}>
            <BioClock />
          </div>

          {loadingBrief && intelItems.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Skel w="45%" h={10} />
                  <Skel w="90%" h={12} />
                  <Skel w="70%" h={12} />
                </div>
              ))}
            </div>
          ) : intelItems.length > 0 ? (
            <div key={briefing?.id ?? 'empty'} className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {intelItems.map((item, i) => <IntelCard key={i} item={item} />)}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic', paddingTop: 8 }}>
              Generate briefing to load today&apos;s intelligence board.
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
              background: 'rgba(127,213,170,0.06)',
              border: '1px solid rgba(127,213,170,0.18)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7FD5AA', marginBottom: 6 }}>Good morning 🌅</div>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 6 }}>
                Today&apos;s focus:
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', marginBottom: 12, lineHeight: 1.35 }}>
                {mustDo[0]?.title}
              </div>
              <button
                onClick={dismissMorning}
                style={{
                  fontSize: 12, fontWeight: 600, color: '#7FD5AA',
                  background: 'rgba(127,213,170,0.12)', border: '1px solid rgba(127,213,170,0.25)',
                  borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Got it, let&apos;s go →
              </button>
            </div>
          )}

          {/* Strategic Directive */}
          <div style={{ borderLeft: '3px solid #B8A4FF', paddingLeft: 14, marginBottom: briefing?.instruction ? 10 : 18 }}>
            {timeContextLabel && (
              <div style={{ fontSize: 10, color: '#52525A', marginBottom: 4, letterSpacing: '0.04em' }}>
                {timeContextLabel}
              </div>
            )}
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
              <div className="animate-fade-in">
                <BulletDirective
                  text={briefing.directive}
                  expanded={directiveExpanded}
                  onToggle={() => setDirectiveExpanded(v => !v)}
                />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic' }}>
                Click ↻ above to generate today&apos;s briefing.
              </div>
            )}
          </div>

          {/* Today instruction */}
          {briefing?.instruction && (
            <div style={{ marginTop: 16, marginBottom: 18, padding: '10px 14px', background: 'rgba(127,213,170,0.04)', borderRadius: 14, border: '1px solid rgba(127,213,170,0.12)' }}>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7FD5AA', marginBottom: 5, opacity: 0.8 }}>
                Today
              </div>
              <span style={{ fontSize: 12, color: '#9E9EA6', lineHeight: 1.65 }}>{briefing.instruction}</span>
            </div>
          )}

          {/* Health Summary Badge */}
          {(atRiskCount > 0 || watchCount > 0) && (
            <div style={{
              marginBottom: 14, padding: '8px 12px', borderRadius: 10,
              background: atRiskCount > 0 ? 'rgba(255,155,135,0.06)' : 'rgba(236,198,102,0.06)',
              border: `1px solid ${atRiskCount > 0 ? 'rgba(255,155,135,0.15)' : 'rgba(236,198,102,0.15)'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: atRiskCount > 0 ? '#FF9B87' : '#ECC666' }}>
                {atRiskCount > 0 ? '⚠️ Goal Health' : atRiskCount === 0 && watchCount > 0 ? '~ Watch' : '✓ All Clear'}
              </span>
              {atRiskCount > 0 && (
                <span style={{ fontSize: 10, color: '#FF9B87', fontWeight: 700 }}>
                  {atRiskCount} at risk
                </span>
              )}
              {atRiskCount === 0 && watchCount > 0 && (
                <span style={{ fontSize: 10, color: '#ECC666' }}>
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
                    fontSize: 10, color: '#B8A4FF',
                    background: 'rgba(184,164,255,0.08)',
                    border: '1px solid rgba(184,164,255,0.2)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  ◎ Focus Mode
                </button>
              )}
            </div>

            {/* Completion counter */}
            {(doneTodayCount > 0 || remainingCount > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {doneTodayCount > 0 && (
                  <span style={{ fontSize: 10, color: '#7FD5AA', fontWeight: 600 }}>
                    🔥 ✓ {doneTodayCount} done
                  </span>
                )}
                {doneTodayCount > 0 && remainingCount > 0 && (
                  <span style={{ fontSize: 10, color: '#3E3E44' }}>·</span>
                )}
                {remainingCount > 0 && (
                  <span style={{ fontSize: 10, color: '#6E6E73' }}>{remainingCount} remaining</span>
                )}
              </div>
            )}

            {/* Done for today banners */}
            {allDone && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)',
                borderRadius: 10, fontSize: 12, color: '#7FD5AA', fontWeight: 600,
              }}>
                Day complete 🎉 All done!
              </div>
            )}
            {!allDone && allMustDone && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)',
                borderRadius: 10, fontSize: 12, color: '#7FD5AA', fontWeight: 600,
              }}>
                ✓ Must-have tasks done. Great work 🎉
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
              // Default work schedule: Mon/Wed 7:30-15:30, Tue/Thu/Fri 9:00-17:00
              const workSchedule: Record<number, { start: number; end: number } | null> = {
                0: null, // Sunday — no work
                1: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, // Monday
                2: { start: 9 * 60,       end: 17 * 60 },       // Tuesday
                3: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, // Wednesday
                4: { start: 9 * 60,       end: 17 * 60 },       // Thursday
                5: { start: 9 * 60,       end: 17 * 60 },       // Friday (lighter but same hours)
                6: null, // Saturday — no work
              }
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
                  background: tight ? 'rgba(255,155,135,0.05)' : 'rgba(127,213,170,0.04)',
                  border: `1px solid ${tight ? 'rgba(255,155,135,0.14)' : 'rgba(127,213,170,0.1)'}`,
                }}>
                  <span style={{ fontSize: 11, color: '#6E6E73' }}>
                    Tasks: <strong style={{ color: tight ? '#FF9B87' : '#A1A1A6', fontVariantNumeric: 'tabular-nums' }}>
                      {tH > 0 ? `${tH}h ` : ''}{tM}m
                    </strong>
                  </span>
                  <span style={{ fontSize: 9, color: '#3E3E44' }}>·</span>
                  <span style={{ fontSize: 11, color: '#6E6E73' }}>
                    Free time: <strong style={{ color: '#A1A1A6', fontVariantNumeric: 'tabular-nums' }}>
                      {rH}h {String(rM).padStart(2, '0')}m
                    </strong>
                  </span>
                  {isWorkHours && workRemMin > 0 && (
                    <>
                      <span style={{ fontSize: 9, color: '#3E3E44' }}>·</span>
                      <span style={{ fontSize: 10, color: '#6E6E73' }}>
                        Work until {work!.end === 15 * 60 + 30 ? '15:30' : '17:00'}
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
                        <span style={{ fontSize: 10, color: '#ECC666' }}>
                          {meetsAfterWork} evening meeting{meetsAfterWork === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null
                  })()}
                  {tight && (
                    <span style={{ fontSize: 10, color: '#FF9B87', marginLeft: 'auto', fontWeight: 700 }}>
                      ⚠ Overloaded
                    </span>
                  )}
                </div>
              )
            })()}

            {/* Energy selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {([
                { key: 'low',    label: '🔋 Low' },
                { key: 'medium', label: '⚡ Medium' },
                { key: 'high',   label: '🚀 High' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setEnergyAndPersist(energy === key ? null : key)}
                  style={{
                    fontSize: 10, padding: '4px 10px', borderRadius: 20,
                    border: energy === key ? '1px solid rgba(184,164,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: energy === key ? 'rgba(184,164,255,0.12)' : 'rgba(255,255,255,0.03)',
                    color: energy === key ? '#B8A4FF' : '#6E6E73',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingBrief && incompleteTasks.length === 0 ? (
              <PrioritySkeleton />
            ) : incompleteTasks.length === 0 && doneTodayCount === 0 ? (
              <div style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic' }}>
                No tasks this week.{' '}
                <Link href="/weekly" style={{ color: '#B8A4FF', textDecoration: 'none' }}>Plan this week →</Link>
              </div>
            ) : (
              <>
                {visibleMust.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E8907A', marginBottom: 4, opacity: 0.85 }}>Must Do</div>
                    {visibleMust.map(t => (
                      <PriorityItem
                        key={t.id} task={t} briefItem={findBriefItem(t)}
                        onToggle={toggleTask} toggling={toggling}
                        celebTaskId={celebTaskId}
                        onBreakSteps={loadMicroSteps}
                        loadingSteps={loadingSteps}
                        expandedSteps={expandedSteps}
                      />
                    ))}
                  </div>
                )}
                {visibleShould.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#DDB96A', marginBottom: 4, opacity: 0.85 }}>Should Do</div>
                    {visibleShould.map(t => (
                      <PriorityItem
                        key={t.id} task={t} briefItem={findBriefItem(t)}
                        onToggle={toggleTask} toggling={toggling}
                        celebTaskId={celebTaskId}
                        onBreakSteps={loadMicroSteps}
                        loadingSteps={loadingSteps}
                        expandedSteps={expandedSteps}
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
            const now = new Date()
            const dow = now.getDay()
            const workSchedule: Record<number, { start: number; end: number } | null> = {
              0: null, 1: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, 2: { start: 9 * 60, end: 17 * 60 },
              3: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, 4: { start: 9 * 60, end: 17 * 60 },
              5: { start: 9 * 60, end: 17 * 60 }, 6: null,
            }
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
    </div>
  )
}
