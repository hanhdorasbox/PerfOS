'use client'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlannedCounts {
  strength: number; cardio: number; sauna: number; walks: number
}

export interface AlcoholLogEntry {
  date: string
  drinks: number
  missedWorkout: boolean
  missedSteps: boolean
  proteinHit: boolean | null
  calorieOverage: number | null
}

export interface FitnessInsightsProps {
  planned: PlannedCounts
  completed: PlannedCounts
  // Protein now comes from meal plan, not from manual protein logs
  todayProteinFromMeals: number | null   // null = no meal plan for today
  proteinTarget: number
  alcoholLogs: AlcoholLogEntry[]
  alcoholBudget: number
  alcoholBudgetType: string
}

// ── Palette ────────────────────────────────────────────────────────────────────

const C = {
  green:   '#7FD5AA',
  blue:    '#80BDFF',
  purple:  '#B8A4FF',
  amber:   '#ECC666',
  orange:  '#F5A56A',
  red:     '#FF9B87',
  muted:   '#6E6E73',
  dim:     '#48484A',
  text:    '#F5F5F7',
  sub:     '#A1A1A6',
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function MiniBar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(1, Math.max(0, fraction)) * 100}%`, background: color, borderRadius: 4 }} />
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: C.muted, marginBottom: 12 }}>
      {children}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Monday ISO date for current week
function currentWeekId(): string {
  const now = new Date()
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

// ── Card 1: Plan vs Reality ────────────────────────────────────────────────────

function PlanVsRealityCard({ planned, completed }: { planned: PlannedCounts; completed: PlannedCounts }) {
  const rows = [
    { label: 'Strength', color: C.green,  done: completed.strength, total: planned.strength },
    { label: 'Cardio',   color: C.blue,   done: completed.cardio,   total: planned.cardio },
    { label: 'Sauna',    color: C.orange,  done: completed.sauna,    total: planned.sauna },
    { label: 'Walks',    color: C.purple, done: completed.walks,    total: planned.walks },
  ].filter(r => r.total > 0)

  return (
    <div className="card">
      <SectionLabel>Plan vs Reality</SectionLabel>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim }}>No weekly targets set.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const f = r.total > 0 ? r.done / r.total : 0
            const met = r.done >= r.total
            return (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: met ? r.color : C.sub }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: met ? r.color : C.text }}>
                    {r.done}<span style={{ color: C.dim, fontWeight: 400 }}>/{r.total}</span>
                  </span>
                </div>
                <MiniBar fraction={f} color={r.color} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Card 2: Weekly Consistency Score ──────────────────────────────────────────
// Score: workout adherence (75pts) + alcohol (25pts) = 100

function WeeklyConsistencyCard({
  planned, completed,
  alcoholLogs, alcoholBudget,
}: {
  planned: PlannedCounts; completed: PlannedCounts
  alcoholLogs: AlcoholLogEntry[]; alcoholBudget: number
}) {
  const totalDrinks = alcoholLogs.reduce((s, l) => s + l.drinks, 0)

  // Workout score (0-75): average adherence per active category
  const cats = [
    { done: completed.strength, total: planned.strength },
    { done: completed.cardio,   total: planned.cardio },
    { done: completed.walks,    total: planned.walks },
    { done: completed.sauna,    total: planned.sauna },
  ].filter(c => c.total > 0)
  const workoutRatio = cats.length > 0
    ? cats.reduce((s, c) => s + Math.min(1, c.done / c.total), 0) / cats.length
    : 0
  const workoutScore = workoutRatio * 75

  // Alcohol score (0-25)
  const over = Math.max(0, totalDrinks - alcoholBudget)
  const alcoholScore = Math.max(0, 25 - over * 8)

  const score = Math.round(Math.min(100, workoutScore + alcoholScore))

  let status: string, statusColor: string
  if (score >= 85)      { status = 'Excellent week';  statusColor = C.green }
  else if (score >= 70) { status = 'Productive week'; statusColor = C.green }
  else if (score >= 50) { status = 'Partial week';    statusColor = C.amber }
  else if (score >= 30) { status = 'Light week';      statusColor = C.amber }
  else                  { status = 'Recovery week';   statusColor = C.red }

  const bd: { label: string; val: string; color: string }[] = []
  if (planned.strength > 0) {
    const r = completed.strength / planned.strength
    bd.push({ label: 'Strength', val: r >= 1 ? 'on target' : r >= 0.67 ? 'close' : 'behind', color: r >= 0.67 ? C.green : C.amber })
  }
  if (planned.cardio > 0) {
    const r = completed.cardio / planned.cardio
    bd.push({ label: 'Cardio', val: r >= 1 ? 'on target' : r >= 0.5 ? 'partial' : 'behind', color: r >= 0.5 ? C.blue : C.amber })
  }
  if (planned.walks > 0) {
    const r = completed.walks / planned.walks
    bd.push({ label: 'Walks', val: r >= 1 ? 'strong' : r >= 0.6 ? 'good' : 'low', color: r >= 0.6 ? C.purple : C.amber })
  }
  if (totalDrinks > 0) {
    const impact = totalDrinks <= alcoholBudget ? 'low impact' : totalDrinks <= alcoholBudget + 2 ? 'moderate' : 'high impact'
    bd.push({ label: 'Alcohol', val: impact, color: totalDrinks <= alcoholBudget ? C.muted : totalDrinks <= alcoholBudget + 2 ? C.amber : C.red })
  }

  return (
    <div className="card">
      <SectionLabel>Weekly Consistency</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: C.text, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 14, color: C.muted, marginBottom: 3 }}>/ 100</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <MiniBar fraction={score / 100} color={statusColor} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: statusColor, marginBottom: 10 }}>{status}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bd.map(b => (
          <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: C.muted }}>{b.label}</span>
            <span style={{ color: b.color, fontWeight: 600 }}>{b.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card 3: Today's Protein — from meal plan ───────────────────────────────────

function TodayProteinCard({ todayProtein, proteinTarget }: { todayProtein: number | null; proteinTarget: number }) {
  const hasMeals = todayProtein !== null
  const pct = hasMeals ? Math.min(1, todayProtein / Math.max(1, proteinTarget)) : 0
  const met  = hasMeals && todayProtein >= proteinTarget
  const color = met ? C.green : hasMeals && pct >= 0.7 ? C.amber : C.muted

  return (
    <div className="card">
      <SectionLabel>Protein Today</SectionLabel>
      {hasMeals ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{todayProtein}</span>
            <span style={{ fontSize: 14, color: C.muted, marginBottom: 3 }}>/ {proteinTarget}g</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <MiniBar fraction={pct} color={color} />
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            From today&apos;s meal plan ·{' '}
            <a href="/meals" style={{ color: C.blue, textDecoration: 'none' }}>Edit meals →</a>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>No meal plan for today.</div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Protein is calculated from your meal plan.{' '}
            <a href="/meals" style={{ color: C.blue, textDecoration: 'none' }}>Add meals →</a>
          </div>
        </>
      )}
    </div>
  )
}

// ── Card 4: Alcohol Impact ─────────────────────────────────────────────────────

function AlcoholImpactCard({
  alcoholLogs, alcoholBudget, alcoholBudgetType,
}: { alcoholLogs: AlcoholLogEntry[]; alcoholBudget: number; alcoholBudgetType: string }) {
  const totalDrinks = alcoholLogs.reduce((s, l) => s + l.drinks, 0)

  if (totalDrinks === 0) {
    return (
      <div className="card">
        <SectionLabel>Alcohol Impact</SectionLabel>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.dim, lineHeight: 1, marginBottom: 4 }}>0</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>No drinks logged this week.</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.green }}>Impact: Low</div>
      </div>
    )
  }

  const overBudget = totalDrinks > alcoholBudget
  const highImpact = totalDrinks > alcoholBudget + 2
  const singleHighDay = alcoholLogs.some(l => l.drinks >= 4)
  const impactLabel = highImpact ? 'Progress blocker' : overBudget ? 'Moderate' : 'Low'
  const impactColor = highImpact ? C.red : overBudget ? C.amber : C.green
  const estKcal = Math.round(totalDrinks * 120)

  const signals: { text: string; color: string }[] = []
  if (singleHighDay)                                 signals.push({ text: '4+ drinks in one occasion', color: C.red })
  if (alcoholLogs.some(l => l.missedWorkout))        signals.push({ text: 'Workout missed next day', color: C.amber })
  if (alcoholLogs.some(l => l.proteinHit === false)) signals.push({ text: 'Protein missed next day', color: C.amber })
  if (alcoholLogs.some(l => l.missedSteps))          signals.push({ text: 'Steps missed next day', color: C.amber })
  if (estKcal > 0)                                   signals.push({ text: `~${estKcal} kcal estimated`, color: C.muted })

  const rec = highImpact
    ? 'Schedule 7 alcohol-free days and rebuild training consistency.'
    : overBudget
    ? 'Keep next 3 days alcohol-free and protect training sessions.'
    : 'Within budget — maintain current pattern.'

  return (
    <div className="card">
      <SectionLabel>Alcohol Impact</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: impactColor, lineHeight: 1 }}>{totalDrinks}</span>
        <span style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>/ {alcoholBudget} used</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <MiniBar fraction={totalDrinks / Math.max(1, alcoholBudget + 3)} color={impactColor} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: impactColor, marginBottom: signals.length ? 8 : 0 }}>
        Impact: {impactLabel}
      </div>
      {signals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          {signals.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: s.color }}>· {s.text}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: C.sub, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: `2px solid ${impactColor}38` }}>
        {rec}
      </div>
    </div>
  )
}

// ── Card 5: Minimum Effective Week ────────────────────────────────────────────

type RowStatus = 'pass' | 'warn' | 'fail'

function MinimumEffectiveWeekCard({
  planned, completed,
  alcoholLogs, alcoholBudget,
}: {
  planned: PlannedCounts; completed: PlannedCounts
  alcoholLogs: AlcoholLogEntry[]; alcoholBudget: number
}) {
  const totalDrinks = alcoholLogs.reduce((s, l) => s + l.drinks, 0)

  const minStrength = planned.strength >= 2 ? planned.strength - 1 : planned.strength > 0 ? 1 : null
  const minCardio   = planned.cardio   >  0 ? 1 : null
  const minWalks    = planned.walks    >= 4 ? Math.ceil(planned.walks * 0.6) : planned.walks > 0 ? 2 : null
  const hasAlcohol  = alcoholBudget > 0

  function rowStatus(done: number, min: number): RowStatus {
    if (done >= min) return 'pass'
    if (done >= Math.max(1, min - 1)) return 'warn'
    return 'fail'
  }

  const checks: { label: string; value: string; status: RowStatus; minimum: string }[] = []

  if (minStrength !== null) checks.push({
    label: 'Strength', value: `${completed.strength}/${planned.strength}`,
    status: rowStatus(completed.strength, minStrength), minimum: `min ${minStrength}`,
  })
  if (minCardio !== null) checks.push({
    label: 'Cardio', value: `${completed.cardio}/${planned.cardio}`,
    status: rowStatus(completed.cardio, minCardio), minimum: `min ${minCardio}`,
  })
  if (minWalks !== null) checks.push({
    label: 'Walks', value: `${completed.walks}/${planned.walks}`,
    status: rowStatus(completed.walks, minWalks), minimum: `min ${minWalks}`,
  })
  if (hasAlcohol) checks.push({
    label: 'Alcohol', value: totalDrinks <= alcoholBudget ? 'Under limit' : `${totalDrinks}/${alcoholBudget}`,
    status: totalDrinks <= alcoholBudget ? 'pass' : totalDrinks <= alcoholBudget + 2 ? 'warn' : 'fail',
    minimum: `≤${alcoholBudget}/wk`,
  })

  const fails = checks.filter(c => c.status === 'fail').length
  const warns = checks.filter(c => c.status === 'warn').length

  let verdict: string, verdictColor: string
  if (fails === 0 && warns === 0) { verdict = 'Productive week.'; verdictColor = C.green }
  else if (fails === 0)           { verdict = 'Still a productive week.'; verdictColor = C.amber }
  else if (fails === 1)           { verdict = 'One rescue action needed.'; verdictColor = C.amber }
  else                            { verdict = 'Recovery week. Return to baseline.'; verdictColor = C.red }

  let rescue = ''
  const firstFail = checks.find(c => c.status === 'fail')
  if (firstFail) {
    if (firstFail.label === 'Strength') rescue = 'Complete one strength session before Sunday.'
    else if (firstFail.label === 'Cardio') rescue = 'Add one cardio session this week.'
    else if (firstFail.label === 'Walks') rescue = 'Add a walk today or tomorrow.'
    else if (firstFail.label === 'Alcohol') rescue = 'Stay alcohol-free for the rest of the week.'
  }

  const icon = (s: RowStatus) => s === 'pass'
    ? <CheckCircle2 size={13} strokeWidth={2} color={C.green} style={{ flexShrink: 0 }} />
    : s === 'warn'
    ? <AlertTriangle size={13} strokeWidth={2} color={C.amber} style={{ flexShrink: 0 }} />
    : <XCircle size={13} strokeWidth={2} color={C.red} style={{ flexShrink: 0 }} />
  const borderColor = fails > 0 ? C.red : warns > 0 ? C.amber : C.green

  return (
    <div className="card" style={{ borderLeft: `2px solid ${borderColor}40` }}>
      <SectionLabel>Minimum Effective Week</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {icon(c.status)}
              <span style={{ color: c.status === 'pass' ? C.sub : c.status === 'warn' ? C.amber : C.text }}>{c.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.dim }}>{c.minimum}</span>
              <span style={{ fontWeight: 700, color: c.status === 'pass' ? C.green : c.status === 'warn' ? C.amber : C.red }}>{c.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 10px', borderRadius: 6, background: `${borderColor}08`, border: `1px solid ${borderColor}20`, marginBottom: rescue ? 8 : 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: borderColor }}>{verdict}</span>
      </div>

      {rescue && (
        <div style={{ fontSize: 11, color: C.sub }}>
          <span style={{ color: C.amber, fontWeight: 600 }}>One action: </span>{rescue}
        </div>
      )}
    </div>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function FitnessInsights({
  planned, completed,
  todayProteinFromMeals, proteinTarget,
  alcoholLogs, alcoholBudget, alcoholBudgetType,
}: FitnessInsightsProps) {
  return (
    <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
      <WeeklyConsistencyCard
        planned={planned} completed={completed}
        alcoholLogs={alcoholLogs} alcoholBudget={alcoholBudget}
      />
      <AlcoholImpactCard
        alcoholLogs={alcoholLogs} alcoholBudget={alcoholBudget} alcoholBudgetType={alcoholBudgetType}
      />
      <MinimumEffectiveWeekCard
        planned={planned} completed={completed}
        alcoholLogs={alcoholLogs} alcoholBudget={alcoholBudget}
      />
    </div>
  )
}
