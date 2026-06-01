'use client'

interface RoadmapPhase {
  phase: string
  weekRange: string
  title: string
  purpose?: string
  focus?: string[]
}

function parseWeekRange(weekRange: string): { start: number; end: number } {
  const m = weekRange.match(/(\d+)\s*[–\-]\s*(\d+)/)
  if (m) return { start: parseInt(m[1]), end: parseInt(m[2]) }
  const single = weekRange.match(/(\d+)/)
  if (single) { const n = parseInt(single[1]); return { start: n, end: n } }
  return { start: 1, end: 4 }
}

export function computeLifecycle(createdAt: string, roadmapJson?: string | null) {
  const startDate = new Date(createdAt)
  const now = new Date()
  const daysSinceStart = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  const totalWeeks = 12
  const currentWeek = Math.min(Math.max(1, Math.floor(daysSinceStart / 7) + 1), totalWeeks)

  let phases: RoadmapPhase[] = []
  if (roadmapJson) {
    try {
      const parsed = JSON.parse(roadmapJson)
      if (Array.isArray(parsed)) phases = parsed as RoadmapPhase[]
    } catch { /* ignore */ }
  }
  if (phases.length === 0) {
    phases = [
      { phase: 'Phase 1', weekRange: 'Weeks 1–4', title: 'Establish' },
      { phase: 'Phase 2', weekRange: 'Weeks 5–8', title: 'Progress' },
      { phase: 'Phase 3', weekRange: 'Weeks 9–12', title: 'Consolidate' },
    ]
  }

  const currentPhase = phases.find(p => {
    const r = parseWeekRange(p.weekRange)
    return currentWeek >= r.start && currentWeek <= r.end
  }) ?? phases[0]

  const phaseIndex = phases.indexOf(currentPhase)
  const phaseWeeks = parseWeekRange(currentPhase.weekRange)
  const weekInPhase = Math.min(currentWeek - phaseWeeks.start + 1, phaseWeeks.end - phaseWeeks.start + 1)
  const phaseWeekTotal = phaseWeeks.end - phaseWeeks.start + 1

  const nextPhase = phases.find(p => parseWeekRange(p.weekRange).start > currentWeek)
  const daysUntilNextPhase = nextPhase
    ? Math.max(0, (parseWeekRange(nextPhase.weekRange).start - 1) * 7 - daysSinceStart)
    : null

  const endDate = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000)
  const daysUntilEnd = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  return {
    startDate, endDate, totalWeeks, currentWeek, daysSinceStart,
    phases, currentPhase, phaseIndex, phaseWeeks,
    weekInPhase, phaseWeekTotal,
    nextPhase, daysUntilNextPhase, daysUntilEnd,
    fullProgress: Math.min(currentWeek / totalWeeks, 1),
    phaseProgress: Math.min(weekInPhase / phaseWeekTotal, 1),
  }
}

const PHASE_COLORS = ['#7FD5AA', '#80BDFF', '#B8A4FF']

// ─── Compact row (for Fitness overview page) ──────────────────────────────────
export function StrategyLifecycleCompact({ createdAt, roadmapJson }: { createdAt: string; roadmapJson?: string | null }) {
  const lc = computeLifecycle(createdAt, roadmapJson)
  const color = PHASE_COLORS[lc.phaseIndex % PHASE_COLORS.length]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}30`, borderRadius: 20, padding: '2px 9px' }}>
        Week {lc.currentWeek}/{lc.totalWeeks}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#A1A1A6' }}>
        {lc.currentPhase.phase}: {lc.currentPhase.title}
      </span>
      {lc.nextPhase && lc.daysUntilNextPhase != null && lc.daysUntilNextPhase > 0 && (
        <span style={{ fontSize: 10, color: '#6E6E73' }}>· Next phase in {lc.daysUntilNextPhase}d</span>
      )}
      {lc.daysUntilEnd <= 14 && lc.daysUntilEnd > 0 && (
        <span style={{ fontSize: 10, color: '#ECC666', fontWeight: 600 }}>· Ends in {lc.daysUntilEnd}d</span>
      )}
    </div>
  )
}

// ─── Medium card (for Strategy page — bars + focus, no phase timeline) ──────────
export function StrategyLifecycleMedium({ createdAt, roadmapJson }: { createdAt: string; roadmapJson?: string | null }) {
  const lc = computeLifecycle(createdAt, roadmapJson)
  const color = PHASE_COLORS[lc.phaseIndex % PHASE_COLORS.length]
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73' }}>
          Strategy Status
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#48484A' }}>
          <span>Started {fmt(lc.startDate)}</span>
          <span>·</span>
          <span>Ends {fmt(lc.endDate)}</span>
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}30`, borderRadius: 20, padding: '3px 12px' }}>
          Week {lc.currentWeek}/{lc.totalWeeks}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#D1D1D6' }}>
          {lc.currentPhase.phase}: {lc.currentPhase.title}
        </span>
        {lc.nextPhase && lc.daysUntilNextPhase != null && lc.daysUntilNextPhase > 0 && (
          <span style={{ fontSize: 11, color: '#6E6E73' }}>
            · {lc.nextPhase.phase} in {lc.daysUntilNextPhase} days
          </span>
        )}
        {lc.daysUntilEnd <= 14 && lc.daysUntilEnd > 0 && (
          <span style={{ fontSize: 11, color: '#ECC666', fontWeight: 600 }}>· Ends in {lc.daysUntilEnd} days</span>
        )}
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: lc.currentPhase.focus?.length ? 12 : 0 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>{lc.currentPhase.phase} · {lc.currentPhase.title}</span>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Week {lc.weekInPhase}/{lc.phaseWeekTotal}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lc.phaseProgress * 100}%`, background: color, borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Overall — {lc.totalWeeks}-week plan</span>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>{lc.totalWeeks - lc.currentWeek} weeks remaining</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lc.fullProgress * 100}%`, background: 'rgba(255,255,255,0.18)', borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Current phase focus chips */}
      {lc.currentPhase.focus && lc.currentPhase.focus.length > 0 && (
        <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            This Phase — Focus
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {lc.currentPhase.focus.map((f, i) => (
              <span key={i} style={{ fontSize: 11, color, background: color + '10', border: `1px solid ${color}20`, borderRadius: 12, padding: '2px 8px' }}>{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Full card (for Fitness Strategy page) ────────────────────────────────────
export function StrategyLifecycleFull({ createdAt, roadmapJson }: { createdAt: string; roadmapJson?: string | null }) {
  const lc = computeLifecycle(createdAt, roadmapJson)
  const color = PHASE_COLORS[lc.phaseIndex % PHASE_COLORS.length]

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E73' }}>
          Strategy Status
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#48484A' }}>
          <span>Started {fmt(lc.startDate)}</span>
          <span>·</span>
          <span>Ends {fmt(lc.endDate)}</span>
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}30`, borderRadius: 20, padding: '3px 12px' }}>
          Week {lc.currentWeek}/{lc.totalWeeks}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#D1D1D6' }}>
          {lc.currentPhase.phase}: {lc.currentPhase.title}
        </span>
        {lc.nextPhase && lc.daysUntilNextPhase != null && lc.daysUntilNextPhase > 0 && (
          <span style={{ fontSize: 11, color: '#6E6E73' }}>
            · {lc.nextPhase.phase} in {lc.daysUntilNextPhase} days
          </span>
        )}
        {lc.daysUntilEnd <= 14 && lc.daysUntilEnd > 0 && (
          <span style={{ fontSize: 11, color: '#ECC666', fontWeight: 600 }}>· Ends in {lc.daysUntilEnd} days</span>
        )}
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>{lc.currentPhase.phase} · {lc.currentPhase.title}</span>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Week {lc.weekInPhase}/{lc.phaseWeekTotal}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lc.phaseProgress * 100}%`, background: color, borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>Overall — {lc.totalWeeks}-week plan</span>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>{lc.totalWeeks - lc.currentWeek} weeks remaining</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lc.fullProgress * 100}%`, background: 'rgba(255,255,255,0.18)', borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Phase timeline */}
      <div style={{ display: 'flex', gap: 6 }}>
        {lc.phases.map((p, i) => {
          const r = parseWeekRange(p.weekRange)
          const isActive = lc.currentWeek >= r.start && lc.currentWeek <= r.end
          const isPast = lc.currentWeek > r.end
          const pc = PHASE_COLORS[i % PHASE_COLORS.length]
          return (
            <div key={i} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: isActive ? pc + '14' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? pc + '35' : 'rgba(255,255,255,0.06)'}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: isActive ? pc : '#48484A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {p.phase}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#F5F5F7' : isPast ? '#6E6E73' : '#48484A', marginTop: 2 }}>
                {p.title}
              </div>
              <div style={{ fontSize: 9, color: '#48484A', marginTop: 1 }}>{p.weekRange}</div>
              {isPast && <div style={{ fontSize: 9, color: pc, marginTop: 2 }}>✓ Complete</div>}
              {isActive && <div style={{ fontSize: 9, color: pc, fontWeight: 700, marginTop: 2 }}>← Now</div>}
              {!isActive && !isPast && <div style={{ fontSize: 9, color: '#48484A', marginTop: 2 }}>Upcoming</div>}
            </div>
          )
        })}
      </div>

      {/* Current phase focus */}
      {lc.currentPhase.focus && lc.currentPhase.focus.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            This Phase — Focus
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {lc.currentPhase.focus.map((f, i) => (
              <span key={i} style={{ fontSize: 11, color, background: color + '10', border: `1px solid ${color}20`, borderRadius: 12, padding: '2px 8px' }}>{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
