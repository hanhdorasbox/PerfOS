import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  ahead: '#30D158',
  on_track: '#0A84FF',
  watch: '#FFD60A',
  at_risk: '#FF9F0A',
  critical: '#FF453A',
}

const STRENGTH_CONFIG = {
  strong:  { label: 'Strong week',  color: '#30D158', bg: 'rgba(107,227,164,0.1)',  border: 'rgba(107,227,164,0.25)' },
  neutral: { label: 'Neutral week', color: '#0A84FF', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)' },
  weak:    { label: 'Weak week',    color: '#FFD60A', bg: 'rgba(242,192,99,0.1)',   border: 'rgba(242,192,99,0.25)' },
}

/** Accept either a JSON array of strings or a plain string — always return string[] */
function toBullets(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    // Old format: plain prose string — split into ≤3-line chunks
    return raw
      .split(/\n\n+/)
      .flatMap(chunk => chunk.replace(/^[-•·]\s*/gm, '').trim())
      .filter(Boolean)
      .slice(0, 6)
  }
}

function BulletList({ items, color = '#A1A1A6', prefix = '·' }: { items: string[], color?: string, prefix?: string }) {
  if (items.length === 0) return null
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{prefix}</span>
          <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.55 }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.weeklyReport.findUnique({ where: { id } })
  if (!report) return notFound()

  const goalBreakdown: any[] = (() => { try { return JSON.parse(report.goalBreakdown || '[]') } catch { return [] } })()
  const strategicWins: string[] = (() => { try { return JSON.parse(report.strategicWins || '[]') } catch { return [] } })()
  const slippageRisks: any[] = (() => { try { return JSON.parse(report.slippageRisks || '[]') } catch { return [] } })()

  const executiveBullets = toBullets(report.executiveSummary)
  const fitnessBullets   = toBullets(report.fitnessSection)
  const careerBullets    = toBullets(report.careerSection)
  const antiDriftBullets = toBullets(report.antiDriftSection)
  const nextWeekBullets  = toBullets(report.nextWeekRec)

  // strategicStrength may be stored as a field in a future version, default neutral
  const strength = 'neutral'
  const strengthCfg = STRENGTH_CONFIG[strength as keyof typeof STRENGTH_CONFIG]

  const onTrack = goalBreakdown.filter(g => ['ahead', 'on_track'].includes(g.status)).length
  const atRisk  = goalBreakdown.filter(g => ['at_risk', 'critical', 'watch'].includes(g.status)).length

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/reports" style={{ fontSize: 12, color: '#A1A1A6', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        ← All Reports
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F5F7' }}>
            Weekly Report
          </h1>
          <p style={{ color: '#A1A1A6', fontSize: 13, marginTop: 4 }}>
            {new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(report.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: strengthCfg.bg, border: `1px solid ${strengthCfg.border}`, color: strengthCfg.color }}>
          {strengthCfg.label}
        </span>
      </div>

      {/* Quick stats bar */}
      {goalBreakdown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Goals tracked', value: goalBreakdown.length, color: '#BF5AF2' },
            { label: 'On track',      value: onTrack,              color: '#30D158' },
            { label: 'At risk',       value: atRisk,               color: atRisk > 0 ? '#FFD60A' : '#6E6E73' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ color: '#6E6E73', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 22, fontWeight: 700, marginTop: 4 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Executive Summary */}
      {executiveBullets.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#BF5AF2', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            What happened this week
          </h2>
          <BulletList items={executiveBullets} color="#BF5AF2" />
        </div>
      )}

      {/* Goal Breakdown */}
      {goalBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Goal Breakdown
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goalBreakdown.map((g: any, i: number) => {
              const color = STATUS_COLORS[g.status] || '#A1A1A6'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'capitalize', flexShrink: 0 }}>
                        {g.status?.replace('_', ' ')}
                      </span>
                    </div>
                    {g.forecastNote && <p style={{ color: '#6E6E73', fontSize: 11 }}>{g.forecastNote}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#6E6E73', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Overall</p>
                      <p style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 700 }}>{g.overallPct != null ? `${Math.round(g.overallPct)}%` : '—'}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#6E6E73', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Delta</p>
                      <p style={{ color: g.delta >= 0 ? '#30D158' : '#FF453A', fontSize: 14, fontWeight: 700 }}>
                        {g.delta != null ? `${g.delta >= 0 ? '+' : ''}${Math.round(g.delta)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Strategic Wins */}
      {strategicWins.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Wins this week
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {strategicWins.map((win, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
                <span style={{ color: '#30D158', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: '#F5F5F7' }}>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Slippage & Risk */}
      {slippageRisks.length > 0 && (
        <div style={{ background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#FF453A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Slippage & Risk
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slippageRisks.map((risk: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.12)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F7' }}>{risk.goal}</span>
                  <span style={{ fontSize: 11, color: risk.recoverable ? '#30D158' : '#FF453A', fontWeight: 600 }}>
                    {risk.recoverable ? 'Recoverable' : 'Critical'}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: '#A1A1A6' }}>{risk.issue}</span>
                {risk.pattern && <p style={{ fontSize: 11, color: '#FFD60A', marginTop: 4 }}>Pattern: {risk.pattern}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fitness + Career side by side */}
      {(fitnessBullets.length > 0 || careerBullets.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {fitnessBullets.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Fitness
              </h2>
              <BulletList items={fitnessBullets} color="#30D158" />
            </div>
          )}
          {careerBullets.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Career Capital
              </h2>
              <BulletList items={careerBullets} color="#0A84FF" />
            </div>
          )}
        </div>
      )}

      {/* Anti-Drift note */}
      {antiDriftBullets.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Drift Patterns
          </h2>
          <BulletList items={antiDriftBullets} color="#FFD60A" />
        </div>
      )}

      {/* Next week actions */}
      {nextWeekBullets.length > 0 && (
        <div style={{ background: 'rgba(107,227,164,0.05)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Next week — do these
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextWeekBullets.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(107,227,164,0.15)', color: '#30D158', fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.5 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chief of Staff Message */}
      {report.chiefOfStaffMsg && (
        <div style={{ padding: '20px 24px', background: 'rgba(180,167,229,0.08)', border: '1px solid rgba(180,167,229,0.25)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#BF5AF2', marginBottom: 10 }}>
            Chief of Staff
          </div>
          <p style={{ fontSize: 14, color: '#F5F5F7', lineHeight: 1.65, fontStyle: 'italic' }}>
            &ldquo;{report.chiefOfStaffMsg}&rdquo;
          </p>
        </div>
      )}
    </main>
  )
}
