'use client'

import { useState } from 'react'

interface ChartData {
  incomeVsExpense: { income: number; expense: number; net: number }
  byCategory: Record<string, number>
  txCount: number
  monthlySummary?: {
    categories: { name: string; budgeted: number; actuals: number; difference: number }[]
    totalRemaining: number
  }
}

interface ReportData {
  id: string
  reportMonth: string
  narrative: string
  chartData: string | null
  summaryData: string
  createdAt: string
}

interface ParsedReport {
  status: 'positive' | 'watch' | 'risk' | 'critical'
  tldr: string[]
  watchPoints: string[]
  nextActions: { title: string; why: string }[]
  deepDive: { title: string; bullets: string[] }[]
}

interface Props {
  report: ReportData
  // userId not needed for regen — reportId is enough
}

const STATUS_CONFIG = {
  positive: { label: 'Positive', color: '#7FD5AA', bg: 'rgba(127,213,170,0.1)', border: 'rgba(127,213,170,0.25)' },
  watch:    { label: 'Watch',    color: '#ECC666', bg: 'rgba(236,198,102,0.1)',  border: 'rgba(236,198,102,0.25)' },
  risk:     { label: 'Risk',     color: '#F5A56A', bg: 'rgba(245,165,106,0.1)',  border: 'rgba(245,165,106,0.25)' },
  critical: { label: 'Critical', color: '#FF9B87', bg: 'rgba(255,155,135,0.1)', border: 'rgba(255,155,135,0.25)' },
}

const CATEGORY_COLORS: Record<string, string> = {
  incomes: '#7FD5AA',
  bills: '#B8A4FF',
  subscriptions: '#80BDFF',
  expenses: '#FF9B87',
  'savings & investments': '#7FD5AA',
  debt: '#ECC666',
}

function parseNarrative(raw: string): ParsedReport | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed.tldr || parsed.status) return parsed as ParsedReport
    return null
  } catch {
    return null
  }
}

export default function FinancialReport({ report }: Props) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false)
  const [narrative, setNarrative] = useState(report.narrative)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')

  async function regenerate() {
    setRegenerating(true)
    setRegenError('')
    try {
      const res = await fetch(`/api/finance/reports/${report.id}/regenerate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setNarrative(data.narrative)
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  const chart: ChartData = report.chartData
    ? JSON.parse(report.chartData)
    : JSON.parse(report.summaryData)

  const { incomeVsExpense, byCategory, txCount } = chart
  const formatKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`
  const net = incomeVsExpense.net
  const margin = incomeVsExpense.income > 0 ? (net / incomeVsExpense.income * 100) : 0

  const parsed = parseNarrative(narrative)
  const status = parsed?.status ?? (net >= 0 ? 'positive' : 'risk')
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.watch

  const maxCatVal = Math.max(...Object.values(byCategory), 1)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: '#F5F5F7', fontSize: 20, fontWeight: 700 }}>
            {report.reportMonth}
          </h2>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
          }}>
            {statusCfg.label}
          </span>
        </div>
        <a
          href="/api/finance/workbook/download"
          style={{
            background: 'rgba(184,164,255,0.1)', border: '1px solid rgba(184,164,255,0.3)',
            color: '#B8A4FF', padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Download Workbook
        </a>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Income',       value: formatKc(incomeVsExpense.income), color: '#7FD5AA' },
          { label: 'Expenses',     value: formatKc(incomeVsExpense.expense), color: '#FF9B87' },
          { label: 'Net Balance',  value: (net >= 0 ? '+' : '') + formatKc(net), color: net >= 0 ? '#7FD5AA' : '#FF9B87' },
          { label: 'Margin',       value: `${margin.toFixed(1)}%`, color: margin >= 10 ? '#7FD5AA' : margin >= 0 ? '#ECC666' : '#FF9B87' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{kpi.label}</p>
            <p style={{ color: kpi.color, fontSize: 20, fontWeight: 700 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Two-column: TL;DR + Category breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* TL;DR / What matters */}
        {parsed?.tldr && parsed.tldr.length > 0 ? (
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              What matters
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parsed.tldr.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: statusCfg.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
                  <span style={{ color: '#F5F5F7', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ color: '#A1A1A6', fontSize: 13 }}>{txCount} transactions processed</p>
              <p style={{ color: net >= 0 ? '#7FD5AA' : '#FF9B87', fontSize: 13 }}>
                Month closed {net >= 0 ? 'positive' : 'negative'}
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ color: '#6E6E73', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Spending breakdown
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, val]) => {
                const pct = (val / maxCatVal) * 100
                const color = CATEGORY_COLORS[cat] || '#B8A4FF'
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#A1A1A6', fontSize: 12, textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ color: '#F5F5F7', fontSize: 12, fontWeight: 600 }}>{formatKc(val)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Watch points */}
      {parsed?.watchPoints && parsed.watchPoints.length > 0 && (
        <div style={{
          background: 'rgba(236,198,102,0.06)', border: '1px solid rgba(236,198,102,0.2)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        }}>
          <p style={{ color: '#ECC666', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            ⚠ Watch points
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
      {parsed?.nextActions && parsed.nextActions.length > 0 && (
        <div style={{
          background: 'rgba(127,213,170,0.05)', border: '1px solid rgba(127,213,170,0.2)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        }}>
          <p style={{ color: '#7FD5AA', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Next actions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsed.nextActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  background: 'rgba(127,213,170,0.15)', color: '#7FD5AA',
                  fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <div>
                  <span style={{ color: '#F5F5F7', fontSize: 13, fontWeight: 600 }}>{action.title}</span>
                  {action.why && (
                    <span style={{ color: '#6E6E73', fontSize: 12 }}> — {action.why}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable deep dive */}
      {parsed?.deepDive && parsed.deepDive.length > 0 && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setDeepDiveOpen(o => !o)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)',
              border: 'none', cursor: 'pointer', padding: '12px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ color: '#A1A1A6', fontSize: 13, fontWeight: 600 }}>Detailed analysis</span>
            <span style={{ color: '#6E6E73', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {deepDiveOpen && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {parsed.deepDive.map((section, i) => (
                <div key={i}>
                  <p style={{ color: '#A1A1A6', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    {section.title}
                  </p>
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

      {/* Old-format narrative → regenerate prompt */}
      {!parsed && narrative && (
        <div style={{ background: 'rgba(236,198,102,0.07)', border: '1px solid rgba(236,198,102,0.25)', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ color: '#ECC666', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ⚠ Analysis is in old format
          </p>
          <p style={{ color: '#6E6E73', fontSize: 12, marginBottom: 14 }}>
            Regenerate to get structured insights: status chip, key bullets, watch signals, action items.
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
            {regenerating ? '⏳ Regenerating...' : '↻ Regenerate Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}
