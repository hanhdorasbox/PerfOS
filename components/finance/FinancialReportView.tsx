'use client'

import { useState } from 'react'
import type { FinancialReport } from '@prisma/client'

interface Props {
  report: FinancialReport
  userId: string
}

interface CategoryBreakdown {
  [category: string]: number
}

interface ParsedAnalysis {
  status: 'positive' | 'watch' | 'risk' | 'critical'
  tldr: string[]
  watchPoints: string[]
  nextActions: { title: string; why: string }[]
  deepDive: { title: string; bullets: string[] }[]
}

const STATUS_CONFIG = {
  positive: { label: 'Positive', color: '#7FD5AA', bg: 'rgba(127,213,170,0.1)', border: 'rgba(127,213,170,0.25)' },
  watch:    { label: 'Watch',    color: '#ECC666', bg: 'rgba(236,198,102,0.1)',  border: 'rgba(236,198,102,0.25)' },
  risk:     { label: 'Risk',     color: '#F5A56A', bg: 'rgba(245,165,106,0.1)',  border: 'rgba(245,165,106,0.25)' },
  critical: { label: 'Critical', color: '#FF9B87', bg: 'rgba(255,155,135,0.1)', border: 'rgba(255,155,135,0.25)' },
}

function parseAnalysis(raw: string | null): ParsedAnalysis | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p.tldr || p.status) return p as ParsedAnalysis
    return null
  } catch { return null }
}

export default function FinancialReportView({ report, userId }: Props) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(report.aiAnalysis ?? null)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')

  const breakdown: CategoryBreakdown = report.categoryBreakdown ? JSON.parse(report.categoryBreakdown) : {}
  const prevComp = report.prevMonthComparison ? JSON.parse(report.prevMonthComparison) : null
  const savingsRate = report.savingsRate ?? (report.totalIncome > 0 ? ((report.netResult / report.totalIncome) * 100) : 0)
  const parsed = parseAnalysis(aiAnalysis)
  const status = parsed?.status ?? (report.netResult >= 0 ? 'positive' : 'risk')
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.watch
  const maxExpense = Math.max(...Object.values(breakdown).filter(v => v > 0), 1)
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  async function regenerate() {
    setRegenerating(true)
    setRegenError('')
    try {
      const res = await fetch('/api/finance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: report.statementId, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAiAnalysis(data.report?.aiAnalysis ?? data.aiAnalysis ?? null)
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="card">

      {/* Title + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7' }}>Monthly Report</h3>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* KPI row */}
      <div className="mob-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Income',      value: `+${fmt(report.totalIncome)}`,       color: '#7FD5AA' },
          { label: 'Expenses',    value: `-${fmt(Math.abs(report.totalExpenses))}`, color: '#FF9B87' },
          { label: 'Net Result',  value: `${report.netResult >= 0 ? '+' : ''}${fmt(report.netResult)}`, color: report.netResult >= 0 ? '#7FD5AA' : '#FF9B87' },
          { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, color: '#B8A4FF' },
        ].map(chip => (
          <div key={chip.label} style={{ background: `${chip.color}10`, border: `1px solid ${chip.color}25`, borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {chip.label}
            </p>
            <p style={{ color: chip.color, fontSize: 18, fontWeight: 700 }}>{chip.value}</p>
          </div>
        ))}
      </div>

      {/* ── Old format detected → show regenerate prompt instead of raw text ── */}
      {!parsed && aiAnalysis && (
        <div style={{ background: 'rgba(236,198,102,0.07)', border: '1px solid rgba(236,198,102,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ color: '#ECC666', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            This analysis was generated in the old format
          </p>
          <p style={{ color: '#6E6E73', fontSize: 12, marginBottom: 14 }}>
            Regenerate to get structured insights: status, key points, watch signals, and action items.
          </p>
          {regenError && <p style={{ color: '#FF9B87', fontSize: 12, marginBottom: 10 }}>{regenError}</p>}
          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              background: 'rgba(236,198,102,0.15)', border: '1px solid rgba(236,198,102,0.4)',
              color: '#ECC666', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: regenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {regenerating ? 'Regenerating...' : '↻ Regenerate Analysis'}
          </button>
        </div>
      )}

      {/* ── No analysis yet ─────────────────────────────────────────────────── */}
      {!aiAnalysis && (
        <div style={{ background: 'rgba(184,164,255,0.07)', border: '1px solid rgba(184,164,255,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ color: '#A1A1A6', fontSize: 13, marginBottom: 14 }}>No AI analysis yet.</p>
          {regenError && <p style={{ color: '#FF9B87', fontSize: 12, marginBottom: 10 }}>{regenError}</p>}
          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.4)',
              color: '#B8A4FF', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: regenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {regenerating ? 'Generating...' : 'Generate Analysis'}
          </button>
        </div>
      )}

      {/* ── New structured format ────────────────────────────────────────────── */}
      {parsed && (
        <>
          {/* What matters (TL;DR) */}
          {parsed.tldr && parsed.tldr.length > 0 && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: `${statusCfg.color}08`, border: `1px solid ${statusCfg.border}`, borderRadius: 12 }}>
              <p style={{ color: statusCfg.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                What matters
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {parsed.tldr.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: statusCfg.color, fontWeight: 700, flexShrink: 0 }}>·</span>
                    <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category breakdown */}
          {Object.keys(breakdown).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Category Breakdown
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {Object.entries(breakdown)
                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                  .map(([cat, amount]) => (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#A1A1A6', fontSize: 13 }}>{cat}</span>
                        <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>
                          {fmt(Math.abs(amount))}
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${(Math.abs(amount) / maxExpense) * 100}%`, background: amount > 0 ? '#7FD5AA' : '#B8A4FF', borderRadius: 3, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Previous month comparison */}
          {prevComp && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 24 }}>
              <div>
                <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>vs Prev Income</p>
                <p style={{ color: prevComp.incomeChange >= 0 ? '#7FD5AA' : '#FF9B87', fontSize: 14, fontWeight: 700 }}>
                  {prevComp.incomeChange >= 0 ? '+' : ''}{fmt(prevComp.incomeChange)}
                </p>
              </div>
              <div>
                <p style={{ color: '#6E6E73', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>vs Prev Expenses</p>
                <p style={{ color: prevComp.expensesChange <= 0 ? '#7FD5AA' : '#FF9B87', fontSize: 14, fontWeight: 700 }}>
                  {prevComp.expensesChange >= 0 ? '+' : ''}{fmt(prevComp.expensesChange)}
                </p>
              </div>
            </div>
          )}

          {/* Watch points */}
          {parsed.watchPoints && parsed.watchPoints.length > 0 && (
            <div style={{ background: 'rgba(236,198,102,0.06)', border: '1px solid rgba(236,198,102,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ color: '#ECC666', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Watch points
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parsed.watchPoints.map((wp, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#ECC666', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.5 }}>{wp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next actions */}
          {parsed.nextActions && parsed.nextActions.length > 0 && (
            <div style={{ background: 'rgba(127,213,170,0.05)', border: '1px solid rgba(127,213,170,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ color: '#7FD5AA', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Next actions
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parsed.nextActions.map((action, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ background: 'rgba(127,213,170,0.15)', color: '#7FD5AA', fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <div>
                      <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{action.title}</span>
                      {action.why && <span style={{ color: '#6E6E73', fontSize: 12 }}> — {action.why}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expandable deep dive */}
          {parsed.deepDive && parsed.deepDive.length > 0 && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setDeepDiveOpen(o => !o)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ color: '#A1A1A6', fontSize: 13, fontWeight: 600 }}>Detailed analysis</span>
                <span style={{ color: '#6E6E73', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
              </button>
              {deepDiveOpen && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {parsed.deepDive.map((section, i) => (
                    <div key={i}>
                      <p style={{ color: '#A1A1A6', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{section.title}</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {section.bullets.map((bullet, j) => (
                          <li key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ color: '#6E6E73', flexShrink: 0 }}>·</span>
                            <span style={{ color: '#A1A1A6', fontSize: 13, lineHeight: 1.6 }}>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Regenerate button (subtle, at bottom) */}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={regenerate}
              disabled={regenerating}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6E6E73', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: regenerating ? 'not-allowed' : 'pointer' }}
            >
              {regenerating ? 'Regenerating...' : '↻ Regenerate'}
            </button>
          </div>
        </>
      )}

    </div>
  )
}
