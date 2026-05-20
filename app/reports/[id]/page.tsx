import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  ahead: '#6BE3A4',
  on_track: '#60A5FA',
  watch: '#F2C063',
  at_risk: '#FB923C',
  critical: '#FF6B6B',
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.weeklyReport.findUnique({ where: { id } })
  if (!report) return notFound()

  const goalBreakdown: any[] = (() => { try { return JSON.parse(report.goalBreakdown || '[]') } catch { return [] } })()
  const strategicWins: string[] = (() => { try { return JSON.parse(report.strategicWins || '[]') } catch { return [] } })()
  const slippageRisks: any[] = (() => { try { return JSON.parse(report.slippageRisks || '[]') } catch { return [] } })()

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/reports" style={{ fontSize: 12, color: '#B8B6B0', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        ← All Reports
      </Link>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FAFAFA' }}>
          Weekly Report — {new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
        <p style={{ color: '#B8B6B0', fontSize: 13, marginTop: 4 }}>
          {new Date(report.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(report.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Executive Summary */}
      {report.executiveSummary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Executive Summary</h2>
          <p style={{ fontSize: 14, color: '#B8B6B0', lineHeight: 1.7 }}>{report.executiveSummary}</p>
        </div>
      )}

      {/* Goal Breakdown */}
      {goalBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Goal Breakdown</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Goal', 'Overall', 'Planned ∆', 'Actual ∆', 'Delta', 'Status', 'Forecast'].map(h => (
                    <th key={h} style={{ color: '#B8B6B0', fontWeight: 600, padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goalBreakdown.map((g: any, i: number) => {
                  const color = STATUS_COLORS[g.status] || '#B8B6B0'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 10px', color: '#FAFAFA', fontWeight: 600 }}>{g.title}</td>
                      <td style={{ padding: '10px 10px', color: '#B8B6B0', fontVariantNumeric: 'tabular-nums' }}>{g.overallPct != null ? `${Math.round(g.overallPct)}%` : '—'}</td>
                      <td style={{ padding: '10px 10px', color: '#B8B6B0', fontVariantNumeric: 'tabular-nums' }}>{g.plannedPct != null ? `+${Math.round(g.plannedPct)}%` : '—'}</td>
                      <td style={{ padding: '10px 10px', color: '#B8B6B0', fontVariantNumeric: 'tabular-nums' }}>{g.actualPct != null ? `+${Math.round(g.actualPct)}%` : '—'}</td>
                      <td style={{ padding: '10px 10px', fontVariantNumeric: 'tabular-nums', color: g.delta >= 0 ? '#6BE3A4' : '#FF6B6B', fontWeight: 700 }}>
                        {g.delta != null ? `${g.delta >= 0 ? '+' : ''}${Math.round(g.delta)}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{g.status?.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '10px 10px', color: '#B8B6B0', fontSize: 12 }}>{g.forecastNote}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strategic Wins */}
      {strategicWins.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Strategic Wins</h2>
          {strategicWins.map((win, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
              <span style={{ color: '#6BE3A4', fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: '#FAFAFA' }}>{win}</span>
            </div>
          ))}
        </div>
      )}

      {/* Slippage & Risk */}
      {slippageRisks.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Slippage & Risk</h2>
          {slippageRisks.map((risk: any, i: number) => (
            <div key={i} style={{ padding: '10px 12px', marginBottom: 8, background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FAFAFA' }}>{risk.goal}</span>
                <span style={{ fontSize: 11, color: risk.recoverable ? '#6BE3A4' : '#FF6B6B' }}>
                  {risk.recoverable ? 'Recoverable' : 'Critical'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#B8B6B0' }}>{risk.issue}</div>
              {risk.pattern && <div style={{ fontSize: 11, color: '#F2C063', marginTop: 4 }}>Pattern: {risk.pattern}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Two-column sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {report.fitnessSection && (
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Fitness Performance</h2>
            <p style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{report.fitnessSection}</p>
          </div>
        )}
        {report.careerSection && (
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Career Capital</h2>
            <p style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{report.careerSection}</p>
          </div>
        )}
      </div>

      {report.antiDriftSection && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Anti-Drift Interpretation</h2>
          <p style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{report.antiDriftSection}</p>
        </div>
      )}

      {report.nextWeekRec && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Next Week Recommendation</h2>
          <p style={{ fontSize: 13, color: '#B8B6B0', lineHeight: 1.6 }}>{report.nextWeekRec}</p>
        </div>
      )}

      {/* Chief of Staff Message */}
      {report.chiefOfStaffMsg && (
        <div style={{
          padding: '20px 24px',
          background: 'rgba(180,167,229,0.08)',
          border: '1px solid rgba(180,167,229,0.25)',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B4A7E5', marginBottom: 12 }}>
            Chief of Staff
          </div>
          <p style={{ fontSize: 15, color: '#FAFAFA', lineHeight: 1.7, fontStyle: 'italic' }}>
            "{report.chiefOfStaffMsg}"
          </p>
        </div>
      )}
    </main>
  )
}
