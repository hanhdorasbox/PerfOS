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
}

const STATUS_CONFIG = {
  positive: { label: 'Positive', color: '#6BE3A4', bg: 'rgba(107,227,164,0.1)', border: 'rgba(107,227,164,0.25)' },
  watch:    { label: 'Watch',    color: '#F2C063', bg: 'rgba(242,192,99,0.1)',  border: 'rgba(242,192,99,0.25)' },
  risk:     { label: 'Risk',     color: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' },
  critical: { label: 'Critical', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.25)' },
}

const CATEGORY_COLORS: Record<string, string> = {
  incomes: '#6BE3A4',
  bills: '#B4A7E5',
  subscriptions: '#60A5FA',
  expenses: '#FF6B6B',
  'savings & investments': '#6BE3A4',
  debt: '#F2C063',
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

  const chart: ChartData = report.chartData
    ? JSON.parse(report.chartData)
    : JSON.parse(report.summaryData)

  const { incomeVsExpense, byCategory, txCount } = chart
  const formatKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`
  const net = incomeVsExpense.net
  const margin = incomeVsExpense.income > 0 ? (net / incomeVsExpense.income * 100) : 0

  const parsed = parseNarrative(report.narrative)
  const status = parsed?.status ?? (net >= 0 ? 'positive' : 'risk')
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.watch

  const maxCatVal = Math.max(...Object.values(byCategory), 1)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: '#FAFAFA', fontSize: 20, fontWeight: 700 }}>
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
            background: 'rgba(180,167,229,0.1)', border: '1px solid rgba(180,167,229,0.3)',
            color: '#B4A7E5', padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Download Workbook
        </a>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Income',       value: formatKc(incomeVsExpense.income), color: '#6BE3A4' },
          { label: 'Expenses',     value: formatKc(incomeVsExpense.expense), color: '#FF6B6B' },
          { label: 'Net Balance',  value: (net >= 0 ? '+' : '') + formatKc(net), color: net >= 0 ? '#6BE3A4' : '#FF6B6B' },
          { label: 'Margin',       value: `${margin.toFixed(1)}%`, color: margin >= 10 ? '#6BE3A4' : margin >= 0 ? '#F2C063' : '#FF6B6B' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px' }}>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{kpi.label}</p>
            <p style={{ color: kpi.color, fontSize: 20, fontWeight: 700 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Two-column: TL;DR + Category breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* TL;DR / What matters */}
        {parsed?.tldr && parsed.tldr.length > 0 ? (
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              What matters
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parsed.tldr.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: statusCfg.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
                  <span style={{ color: '#FAFAFA', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ color: '#B8B6B0', fontSize: 13 }}>{txCount} transactions processed</p>
              <p style={{ color: net >= 0 ? '#6BE3A4' : '#FF6B6B', fontSize: 13 }}>
                Month closed {net >= 0 ? 'positive' : 'negative'}
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Spending breakdown
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, val]) => {
                const pct = (val / maxCatVal) * 100
                const color = CATEGORY_COLORS[cat] || '#B4A7E5'
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#B8B6B0', fontSize: 12, textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ color: '#FAFAFA', fontSize: 12, fontWeight: 600 }}>{formatKc(val)}</span>
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
          background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.2)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        }}>
          <p style={{ color: '#F2C063', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            ⚠ Watch points
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {parsed.watchPoints.map((wp, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#F2C063', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ color: '#FAFAFA', fontSize: 13, lineHeight: 1.5 }}>{wp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next actions */}
      {parsed?.nextActions && parsed.nextActions.length > 0 && (
        <div style={{
          background: 'rgba(107,227,164,0.05)', border: '1px solid rgba(107,227,164,0.2)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        }}>
          <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Next actions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsed.nextActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  background: 'rgba(107,227,164,0.15)', color: '#6BE3A4',
                  fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <div>
                  <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{action.title}</span>
                  {action.why && (
                    <span style={{ color: '#76746E', fontSize: 12 }}> — {action.why}</span>
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
            <span style={{ color: '#B8B6B0', fontSize: 13, fontWeight: 600 }}>Detailed analysis</span>
            <span style={{ color: '#76746E', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {deepDiveOpen && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {parsed.deepDive.map((section, i) => (
                <div key={i}>
                  <p style={{ color: '#B8B6B0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    {section.title}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {section.bullets.map((bullet, j) => (
                      <li key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: '#76746E', flexShrink: 0 }}>·</span>
                        <span style={{ color: '#B8B6B0', fontSize: 13, lineHeight: 1.6 }}>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback: old-format narrative (prose) — hidden behind toggle */}
      {!parsed && report.narrative && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setDeepDiveOpen(o => !o)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)',
              border: 'none', cursor: 'pointer', padding: '12px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ color: '#B8B6B0', fontSize: 13, fontWeight: 600 }}>Analysis</span>
            <span style={{ color: '#76746E', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {deepDiveOpen && (
            <div style={{ padding: '16px 20px' }}>
              {report.narrative.split('\n\n').filter(Boolean).map((para, i) => {
                // Strip raw markdown markers
                const clean = para.replace(/^#{1,3}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
                return (
                  <p key={i} style={{ color: '#B8B6B0', fontSize: 13, lineHeight: 1.7, marginBottom: i < 3 ? 12 : 0 }}>{clean}</p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
