'use client'
import type { ReactNode } from 'react'

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
  // Strength/cardio/sauna
  sessionsPerWeek?: number
  type?: string
  split?: string
  duration?: string
  days?: string | string[]
  // Nutrition-specific
  approach?: string
  proteinTarget?: number
  caloricTracking?: boolean
  mealPlanLinked?: boolean
  keyRule?: string
  [key: string]: unknown
}

interface ScheduleDay {
  day: string
  activity: string
  sessionList: string[]  // Always-populated array for bullet rendering
  [key: string]: unknown
}

function parsePlan(raw: string | null): PlanBlock | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as PlanBlock
  } catch {
    return { type: raw }
  }
}

function parseSchedule(raw: string | null): ScheduleDay[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>[]).map(item => {
        // Support both {day, activity} and {day, sessions:[]} formats
        const rawSessions = Array.isArray(item.sessions) ? item.sessions as string[] : null
        const rawActivity = item.activity as string | undefined
        const sessionList: string[] = rawSessions
          ? rawSessions
          : rawActivity
            ? rawActivity.split(',').map((s: string) => s.trim()).filter(Boolean)
            : []
        return {
          ...(item as ScheduleDay),
          day: item.day as string,
          activity: rawActivity || (rawSessions ? rawSessions.join(', ') : ''),
          sessionList,
        }
      })
    }
    // Object keyed by day
    return Object.entries(parsed).map(([day, activity]) => ({
      day,
      activity: String(activity),
      sessionList: String(activity).split(',').map(s => s.trim()).filter(Boolean),
    }))
  } catch {
    return []
  }
}

// Parse a session string into activity + optional detail
// "Lower body strength (Squat focus)" → { activity: "Lower body strength", detail: "Squat focus" }
// "Cardio 25min" → { activity: "Cardio", detail: "25 min" }
// "Sauna 20min" → { activity: "Sauna", detail: "20 min" }
function parseSessionText(session: string): { activity: string; detail?: string } {
  const parenMatch = session.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) return { activity: parenMatch[1].trim(), detail: parenMatch[2].trim() }
  const durationMatch = session.match(/^(.+?)\s+(\d+\s*min(?:utes?)?)\s*$/i)
  if (durationMatch) return { activity: durationMatch[1].trim(), detail: durationMatch[2].replace(/\s+/, ' ') }
  return { activity: session }
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
    if (plan.days) {
      const daysVal = plan.days
      bullets.push(Array.isArray(daysVal) ? daysVal.join(', ') : String(daysVal))
    }
    if (bullets.length === 0) bullets.push('Plan active')
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8,
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start',
    }}>
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

export default function ActiveRegime({ strategy, isDraft }: Props) {
  if (!strategy) {
    return (
      <div
        className="card"
        style={{ borderLeft: '2px solid rgba(107,227,164,0.2)' }}
      >
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
  const schedule = parseSchedule(strategy.weeklySchedule)

  return (
    <div
      className="card"
      style={{ borderLeft: `2px solid ${isDraft ? 'rgba(242,192,99,0.4)' : 'rgba(107,227,164,0.3)'}` }}
    >
      {isDraft && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', marginBottom: 14, borderRadius: 8,
          background: 'rgba(242,192,99,0.07)', border: '1px solid rgba(242,192,99,0.2)',
        }}>
          <span style={{ fontSize: 12, color: '#F2C063' }}>⚠ Draft strategy — review and activate to make it operational</span>
          <a href="/fitness/strategy" style={{ fontSize: 12, color: '#F2C063', textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>
            Review & Activate →
          </a>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDraft ? '#F2C063' : '#76746E', marginBottom: 4 }}>
            {isDraft ? 'Draft Fitness Strategy' : 'Current Quarterly Fitness Regime'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>{strategy.mainObjective}</div>
        </div>
        <a
          href="/fitness/strategy"
          style={{
            fontSize: 11,
            color: isDraft ? '#F2C063' : '#6BE3A4',
            textDecoration: 'none',
            padding: '4px 10px',
            border: `1px solid ${isDraft ? 'rgba(242,192,99,0.2)' : 'rgba(107,227,164,0.2)'}`,
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          Full Strategy →
        </a>
      </div>

      {/* Plan breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {renderPlanBlock('Strength', strengthPlan, '🏋️')}
        {renderPlanBlock('Cardio', cardioPlan, '🏃')}
        {renderPlanBlock('Sauna', saunaPlan, '🔥')}
        {nutritionPlan && renderPlanBlock('Nutrition', nutritionPlan, '🥗')}
      </div>

      {/* Weekly schedule */}
      {schedule.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#76746E', marginBottom: 8 }}>
            Weekly Schedule
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
            {schedule.slice(0, 7).map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6BE3A4', marginBottom: 6 }}>{s.day?.slice(0, 3).toUpperCase()}</div>
                {s.sessionList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.sessionList.map((session, j) => {
                      const parsed = parseSessionText(session)
                      return (
                        <div key={j} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 9, color: '#6BE3A4', flexShrink: 0, marginTop: 2, fontWeight: 700 }}>•</span>
                          <div>
                            <div style={{ fontSize: 11, color: '#B8B6B0', lineHeight: 1.3 }}>{parsed.activity}</div>
                            {parsed.detail && (
                              <div style={{ fontSize: 10, color: '#76746E', marginTop: 1 }}>{parsed.detail}</div>
                            )}
                          </div>
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
    </div>
  )
}
