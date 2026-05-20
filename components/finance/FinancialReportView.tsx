'use client'
import type { FinancialReport } from '@prisma/client'

interface Props {
  report: FinancialReport
}

interface CategoryBreakdown {
  [category: string]: number
}

export default function FinancialReportView({ report }: Props) {
  const breakdown: CategoryBreakdown = report.categoryBreakdown ? JSON.parse(report.categoryBreakdown) : {}
  const prevComp = report.prevMonthComparison ? JSON.parse(report.prevMonthComparison) : null

  const savingsRate = report.savingsRate ?? (report.totalIncome > 0 ? ((report.netResult / report.totalIncome) * 100) : 0)

  const maxExpense = Math.max(...Object.values(breakdown).filter(v => v > 0), 1)

  const statChips = [
    { label: 'Total Income', value: report.totalIncome, color: '#6BE3A4', prefix: '+' },
    { label: 'Total Expenses', value: Math.abs(report.totalExpenses), color: '#FF6B6B', prefix: '-' },
    { label: 'Net Result', value: report.netResult, color: report.netResult >= 0 ? '#6BE3A4' : '#FF6B6B', prefix: report.netResult >= 0 ? '+' : '' },
    { label: 'Savings Rate', value: savingsRate, color: '#B4A7E5', suffix: '%', isPercent: true },
  ]

  return (
    <div className="card">
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FAFAFA', marginBottom: 16 }}>Monthly Report</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {statChips.map(chip => (
          <div key={chip.label} style={{
            background: `${chip.color}10`, border: `1px solid ${chip.color}25`,
            borderRadius: 12, padding: '12px 14px',
          }}>
            <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {chip.label}
            </p>
            <p style={{ color: chip.color, fontSize: 18, fontWeight: 700 }}>
              {chip.isPercent
                ? `${chip.value.toFixed(1)}%`
                : `${chip.prefix ?? ''}${chip.value.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </p>
          </div>
        ))}
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div style={{ marginBottom: 24 }}>
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
                      {Math.abs(amount).toLocaleString('cs-CZ', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%',
                      width: `${(Math.abs(amount) / maxExpense) * 100}%`,
                      background: amount > 0 ? '#6BE3A4' : '#B4A7E5',
                      borderRadius: 3, transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {prevComp && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 16,
        }}>
          <p style={{ color: '#76746E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            vs Previous Month
          </p>
          {Object.entries(prevComp).map(([key, val]) => (
            <p key={key} style={{ color: '#B8B6B0', fontSize: 13, marginBottom: 2 }}>
              {key}: <span style={{ color: '#FAFAFA' }}>{String(val)}</span>
            </p>
          ))}
        </div>
      )}

      {report.aiAnalysis && (
        <div style={{
          background: 'rgba(180,167,229,0.06)', border: '1px solid rgba(180,167,229,0.15)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <p style={{ color: '#B4A7E5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            AI Analysis
          </p>
          <p style={{ color: '#FAFAFA', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.aiAnalysis}</p>
        </div>
      )}
    </div>
  )
}
