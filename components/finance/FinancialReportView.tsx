'use client'

import { useState } from 'react'
import type { FinancialReport } from '@prisma/client'

interface Props {
  report: FinancialReport
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
  positive: { label: 'Positive', color: '#6BE3A4', bg: 'rgba(107,227,164,0.1)', border: 'rgba(107,227,164,0.25)' },
  watch:    { label: 'Watch',    color: '#F2C063', bg: 'rgba(242,192,99,0.1)',  border: 'rgba(242,192,99,0.25)' },
  risk:     { label: 'Risk',     color: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' },
  critical: { label: 'Critical', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.25)' },
}

function parseAnalysis(raw: string | null): ParsedAnalysis | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p.tldr || p.status) return p as ParsedAnalysis
    return null
  } catch { return null }
}

export default function FinancialReportView({ report }: Props) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false)

  const breakdown: CategoryBreakdown = report.categoryBreakdown ? JSON.parse(report.categoryBreakdown) : {}
  const prevComp = report.prevMonthComparison ? JSON.parse(report.prevMonthComparison) : null
  const savingsRate = report.savingsRate ?? (report.totalIncome > 0 ? ((report.netResult / report.totalIncome) * 100) : 0)
  const parsed = parseAnalysis(report.aiAnalysis ?? null)
  const status = parsed?.status ?? (report.netResult >= 0 ? 'positive' : 'risk')
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.watch
  const maxExpense = Math.max(...Object.values(breakdown).filter(v => v > 0), 1)
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="card">

      {/* Title + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FAFAFA' }}>Monthly Report</h3>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Income',      value: `+${fmt(report.totalIncome)}`,       color: '#6BE3A4' },
          { label: 'Expenses',    value: `-${fmt(Math.abs(report.totalExpenses))}`, color: '#FF6B6B' },
          { label: 'Net Result',  value: `${report.netResult >= 0 ? '+' : ''}${fmt(report.netResult)}`, color: report.netResult >= 0 ? '#6BE3A4' : '#FF6B6B' },
          { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, color: '#B4A7E5' },
        ].map(chip => (
          <div key={chip.label} style={{ background: `${chip.color}10`, border: `1px solid ${chip.color}25`, borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {chip.label}
            </p>
            <p style={{ color: chip.color, fontSize: 18, fontWeight: 700 }}>{chip.value}</p>
          </div>
        ))}
      </div>

      {/* What matters (TL;DR) */}
      {parsed?.tldr && parsed.tldr.length > 0 && (
        <div style={{ marginBottom: 20, padding: '14px 16px', background: `${statusCfg.color}08`, border: `1px solid ${statusCfg.border}`, borderRadius: 12 }}>
          <p style={{ color: statusCfg.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            What matters
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {parsed.tldr.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: statusCfg.color, fontWeight: 700, flexShrink: 0 }}>·</span>
                <span style={{ color: '#FAFAFA', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Category Breakdown
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(breakdown)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .map(([cat, amount]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#B8B6B0', fontSize: 13 }}>{cat}</span>
                    <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>
                      {fmt(Math.abs(amount))}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(Math.abs(amount) / maxExpense) * 100}%`, background: amount > 0 ? '#6BE3A4' : '#B4A7E5', borderRadius: 3, transition: 'width 0.3s ease' }} />
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
            <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>vs Prev Income</p>
            <p style={{ color: prevComp.incomeChange >= 0 ? '#6BE3A4' : '#FF6B6B', fontSize: 14, fontWeight: 700 }}>
              {prevComp.incomeChange >= 0 ? '+' : ''}{fmt(prevComp.incomeChange)}
            </p>
          </div>
          <div>
            <p style={{ color: '#76746E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>vs Prev Expenses</p>
            <p style={{ color: prevComp.expensesChange <= 0 ? '#6BE3A4' : '#FF6B6B', fontSize: 14, fontWeight: 700 }}>
              {prevComp.expensesChange >= 0 ? '+' : ''}{fmt(prevComp.expensesChange)}
            </p>
          </div>
        </div>
      )}

      {/* Watch points */}
      {parsed?.watchPoints && parsed.watchPoints.length > 0 && (
        <div style={{ background: 'rgba(242,192,99,0.06)', border: '1px solid rgba(242,192,99,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
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
        <div style={{ background: 'rgba(107,227,164,0.05)', border: '1px solid rgba(107,227,164,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ color: '#6BE3A4', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Next actions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsed.nextActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(107,227,164,0.15)', color: '#6BE3A4', fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <div>
                  <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{action.title}</span>
                  {action.why && <span style={{ color: '#76746E', fontSize: 12 }}> — {action.why}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback for old plain-text aiAnalysis */}
      {!parsed && report.aiAnalysis && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setDeepDiveOpen(o => !o)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ color: '#B8B6B0', fontSize: 13, fontWeight: 600 }}>AI Analysis</span>
            <span style={{ color: '#76746E', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {deepDiveOpen && (
            <div style={{ padding: '16px 20px' }}>
              {(report.aiAnalysis ?? '').split('\n\n').filter(Boolean).map((para, i) => {
                const clean = para.replace(/^#{1,3}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
                return <p key={i} style={{ color: '#B8B6B0', fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{clean}</p>
              })}
            </div>
          )}
        </div>
      )}

      {/* Expandable deep dive (new format) */}
      {parsed?.deepDive && parsed.deepDive.length > 0 && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setDeepDiveOpen(o => !o)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ color: '#B8B6B0', fontSize: 13, fontWeight: 600 }}>Detailed analysis</span>
            <span style={{ color: '#76746E', fontSize: 12 }}>{deepDiveOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {deepDiveOpen && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {parsed.deepDive.map((section, i) => (
                <div key={i}>
                  <p style={{ color: '#B8B6B0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{section.title}</p>
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
    </div>
  )
}
