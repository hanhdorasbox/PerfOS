import { prisma } from '@/lib/db'
import PatternAnalyzer from '@/components/operating-manual/PatternAnalyzer'
import AddPatternForm from '@/components/operating-manual/AddPatternForm'
import TrajectoryForecast from '@/components/operating-manual/TrajectoryForecast'
import PatternsList from '@/components/operating-manual/PatternsList'
import AutoPatternRefresh from '@/components/operating-manual/AutoPatternRefresh'
import { Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Domain normalisation ─────────────────────────────────────────────────────

const DOMAIN_NORMALIZE = (domain: string): string => {
  switch (domain) {
    case 'fitness':            return 'Fitness'
    case 'learning':           return 'Learning'
    case 'meals':              return 'Meals'
    case 'time_use':           return 'Time Use'
    case 'forecasting':
    case 'quarterly_planning':
    case 'weekly':
    case 'planning_execution': return 'Planning & Execution'
    default:                   return domain.replace(/_/g, ' ')
  }
}

const DISPLAY_META: Record<string, { color: string }> = {
  'Fitness':              { color: '#7FD5AA' },
  'Learning':             { color: '#80BDFF' },
  'Meals':                { color: '#ECC666' },
  'Planning & Execution': { color: '#B8A4FF' },
  'Time Use':             { color: '#F5A56A' },
}

function getMeta(displayDomain: string) {
  return DISPLAY_META[displayDomain] ?? { color: '#6E6E73' }
}

// ─── Bullet text renderer ─────────────────────────────────────────────────────

function BulletText({ text, color = '#A1A1A6', bulletColor = '#6E6E73' }: { text: string; color?: string; bulletColor?: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const bullets = lines.filter(l => l.startsWith('• ') || l.startsWith('- ') || l.startsWith('* '))

  if (bullets.length === 0) {
    // Fallback: plain text
    return <span style={{ color, fontSize: 13, lineHeight: 1.55 }}>{text}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: bulletColor, flexShrink: 0, fontSize: 12, marginTop: 1, fontWeight: 700, lineHeight: 1 }}>•</span>
          <span style={{ color, fontSize: 13, lineHeight: 1.55 }}>{b.replace(/^[•\-\*]\s+/, '')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Confidence dots ──────────────────────────────────────────────────────────

function ConfidenceDots({ confidence }: { confidence: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: i <= confidence ? '#B8A4FF' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Confidence Ring ──────────────────────────────────────────────────────────

function ConfidenceRing({ pct }: { pct: number }) {
  const R = 34
  const SW = 5
  const SZ = (R + SW) * 2 + 4
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - pct / 100)
  const color = pct >= 70 ? '#7FD5AA' : pct >= 45 ? '#ECC666' : '#F5A56A'

  return (
    <div style={{ position: 'relative', width: SZ, height: SZ }}>
      <svg width={SZ} height={SZ} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={SZ/2} cy={SZ/2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
        <circle
          cx={SZ/2} cy={SZ/2} r={R}
          fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={offset}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        textAlign: 'center', lineHeight: 1.2,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
        <div style={{ fontSize: 8, color: '#6E6E73', letterSpacing: '0.06em', textTransform: 'uppercase' }}>conf.</div>
      </div>
    </div>
  )
}

// ─── Operating Snapshot (right sticky panel) ──────────────────────────────────

type Pattern = {
  id: string; domain: string; pattern: string; evidence: string | null
  confidence: number; implication: string | null; active: boolean
}

function OperatingSnapshot({ patterns }: { patterns: Pattern[] }) {
  if (patterns.length === 0) {
    return (
      <div className="card" style={{ padding: '20px 18px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 14 }}>
          Operating Snapshot
        </div>
        <p style={{ fontSize: 12, color: '#6E6E73', fontStyle: 'italic', lineHeight: 1.6 }}>
          Run pattern analysis to populate the snapshot.
        </p>
      </div>
    )
  }

  // A. Domain counts (normalised)
  const domainCounts: Record<string, number> = {}
  for (const p of patterns) {
    const key = DOMAIN_NORMALIZE(p.domain)
    domainCounts[key] = (domainCounts[key] ?? 0) + 1
  }

  // B. Strongest signal (highest confidence)
  const strongest = [...patterns].sort((a, b) => b.confidence - a.confidence)[0]

  // C. Evidence strength (avg confidence / 5 → %)
  const avgConf = patterns.reduce((s, p) => s + p.confidence, 0) / patterns.length
  const confidencePct = Math.round((avgConf / 5) * 100)

  // D. Planning adjustments (patterns with implications, top 4 by confidence)
  const adjustments = [...patterns]
    .filter(p => p.implication && p.implication.trim())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* A — Domain breakdown */}
      <div className="card" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 14 }}>
          Pattern Snapshot
        </div>

        <div style={{ fontSize: 28, fontWeight: 800, color: '#F5F5F7', letterSpacing: '-0.03em', marginBottom: 2 }}>
          {patterns.length}
        </div>
        <div style={{ fontSize: 10, color: '#6E6E73', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          identified patterns
        </div>

        {/* Domain chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {Object.entries(domainCounts).sort((a,b) => b[1]-a[1]).map(([domain, count]) => {
            const meta = getMeta(domain)
            const barPct = Math.round((count / patterns.length) * 100)
            return (
              <div key={domain}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#A1A1A6' }}>
                    {domain}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: 2, opacity: 0.7 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* B — Strongest signal */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 10 }}>
          Strongest Signal
        </div>
        <div style={{ fontSize: 12, color: '#F5F5F7', lineHeight: 1.6, fontWeight: 500 }}>
          {strongest.pattern}
        </div>
        {strongest.implication && (
          <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(184,164,255,0.07)', borderRadius: 8, border: '1px solid rgba(184,164,255,0.15)' }}>
            <div style={{ fontSize: 11, color: '#B8A4FF', lineHeight: 1.5 }}>→ {strongest.implication}</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <ConfidenceDots confidence={strongest.confidence} />
          <span style={{ fontSize: 10, color: '#6E6E73' }}>{strongest.confidence}/5 confidence</span>
        </div>
      </div>

      {/* C — Evidence strength ring */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <ConfidenceRing pct={confidencePct} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginBottom: 3 }}>
            Pattern Confidence
          </div>
          <div style={{ fontSize: 11, color: '#6E6E73', lineHeight: 1.5 }}>
            {confidencePct >= 70 ? 'Strong evidence base' : confidencePct >= 45 ? 'Moderate evidence' : 'Building evidence'}
          </div>
          <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>
            {patterns.length} patterns · avg {avgConf.toFixed(1)}/5
          </div>
        </div>
      </div>

      {/* D — Planning adjustments */}
      {adjustments.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 12 }}>
            Active Planning Rules
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {adjustments.map(p => {
              const meta = getMeta(DOMAIN_NORMALIZE(p.domain))
              return (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 3, minHeight: 14, background: meta.color, borderRadius: 2, flexShrink: 0, marginTop: 3 }} />
                  <div style={{ fontSize: 12, color: '#A1A1A6', lineHeight: 1.55 }}>{p.implication}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: '#6E6E73', fontStyle: 'italic' }}>
            Derived from detected patterns — actively applied to future planning.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OperatingManualPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF9B87' }}>No user found</div>

  const twoQuartersAgo = new Date()
  twoQuartersAgo.setMonth(twoQuartersAgo.getMonth() - 6)

  let behaviorPatterns: Awaited<ReturnType<typeof prisma.behaviorPattern.findMany>> = []
  let goals: Awaited<ReturnType<typeof prisma.goal.findMany>> = []
  let weeklyReports: Awaited<ReturnType<typeof prisma.weeklyReport.findMany>> = []
  let mealPlans: Awaited<ReturnType<typeof prisma.mealPlan.findMany>> = []
  let fitnessStrategies: Awaited<ReturnType<typeof prisma.fitnessStrategy.findMany>> = []

  try {
    const results = await Promise.all([
      prisma.behaviorPattern.findMany({
        where: { userId: user.id, active: true },
        orderBy: [{ domain: 'asc' }, { confidence: 'desc' }],
      }),
      prisma.goal.findMany({
        where: { userId: user.id, createdAt: { gte: twoQuartersAgo } },
        include: { progressUpdates: true, milestones: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.weeklyReport.findMany({ where: { userId: user.id }, orderBy: { weekStart: 'desc' } }),
      prisma.mealPlan.findMany({ where: { userId: user.id }, include: { feedback: true }, orderBy: { weekStart: 'desc' } }),
      prisma.fitnessStrategy.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    ])
    ;[behaviorPatterns, goals, weeklyReports, mealPlans, fitnessStrategies] = results
  } catch (e) {
    console.error('[OperatingManualPage] DB query failed — schema may not be migrated yet:', e)
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F5F5F7', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Personal Operating Manual
        </h1>
        <div className="card" style={{ background: 'rgba(236,198,102,0.07)', border: '1px solid rgba(236,198,102,0.25)' }}>
          <p style={{ color: '#ECC666', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Database migration in progress
          </p>
          <p style={{ color: '#6E6E73', fontSize: 13 }}>
            New schema columns are being applied. Please refresh the page in a few seconds.
          </p>
        </div>
      </div>
    )
  }

  // Group patterns by normalised display domain
  const patternsByDisplay: Record<string, typeof behaviorPatterns> = {}
  for (const p of behaviorPatterns) {
    const key = DOMAIN_NORMALIZE(p.domain)
    if (!patternsByDisplay[key]) patternsByDisplay[key] = []
    patternsByDisplay[key].push(p)
  }

  // Preferred domain order for display
  const DOMAIN_ORDER = ['Time Use', 'Fitness', 'Learning', 'Meals', 'Planning & Execution']
  const sortedDomains = [
    ...DOMAIN_ORDER.filter(d => patternsByDisplay[d]),
    ...Object.keys(patternsByDisplay).filter(d => !DOMAIN_ORDER.includes(d)),
  ]

  // Empty state — no patterns yet (auto-refresh will trigger in background)
  if (behaviorPatterns.length === 0) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F5F5F7', letterSpacing: '-0.02em' }}>
              Personal Operating Manual
            </h1>
            <p style={{ color: '#6E6E73', fontSize: 14, marginTop: 4 }}>
              Quietly learning how you work — adjusts future planning automatically.
            </p>
            <div style={{ marginTop: 8 }}>
              <AutoPatternRefresh userId={user.id} lastPatternAt={null} />
            </div>
          </div>
          <PatternAnalyzer userId={user.id} existingPatterns={[]} />
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '56px 24px', marginBottom: 24 }}>
          <div style={{ marginBottom: 14, color: '#6E6E73', display: 'flex', justifyContent: 'center' }}><Settings size={40} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', marginBottom: 8 }}>
            Analyzing your behavioral patterns…
          </div>
          <p style={{ color: '#6E6E73', fontSize: 14, maxWidth: 440, margin: '0 auto 24px' }}>
            The system is learning from your goals, tasks, fitness, and finance data. Patterns will appear here automatically — refresh in a moment.
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7', marginBottom: 16 }}>
            Add Manual Observation
          </h3>
          <AddPatternForm userId={user.id} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F5F5F7', letterSpacing: '-0.02em' }}>
            Personal Operating Manual
          </h1>
          <p style={{ color: '#6E6E73', fontSize: 14, marginTop: 4 }}>
            Quietly learning how you work — adjusts future planning automatically.
          </p>
          {/* Auto-refresh status chip — updates patterns in background */}
          <div style={{ marginTop: 8 }}>
            <AutoPatternRefresh
              userId={user.id}
              lastPatternAt={behaviorPatterns[0]?.updatedAt?.toISOString() ?? null}
            />
          </div>
        </div>
        {/* Manual refresh as secondary fallback */}
        <PatternAnalyzer userId={user.id} existingPatterns={behaviorPatterns} />
      </div>

      {/* ── Two-column layout: patterns (75%) + snapshot (25%) ── */}
      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>

        {/* LEFT — Pattern cards */}
        <div>
          <PatternsList
            domainGroups={sortedDomains.map(displayDomain => {
              const meta = getMeta(displayDomain)
              return {
                displayDomain,
                color: meta.color,
                patterns: patternsByDisplay[displayDomain],
              }
            })}
          />

          {/* Manual observation form */}
          <div className="card" style={{ marginTop: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7', marginBottom: 16 }}>
              Add Manual Observation
            </h3>
            <AddPatternForm userId={user.id} />
          </div>
        </div>

        {/* RIGHT — Sticky snapshot */}
        <div style={{ position: 'sticky', top: 20 }}>
          <OperatingSnapshot patterns={behaviorPatterns} />
        </div>
      </div>

      {/* ── Full-width Trajectory Forecast ── */}
      <TrajectoryForecast userId={user.id} hasPatterns={behaviorPatterns.length > 0} />
    </div>
  )
}
