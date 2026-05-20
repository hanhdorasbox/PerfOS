'use client'

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

interface Props {
  report: ReportData
}

export default function FinancialReport({ report }: Props) {
  const chart: ChartData = report.chartData
    ? JSON.parse(report.chartData)
    : JSON.parse(report.summaryData)

  const { incomeVsExpense, byCategory, txCount } = chart

  const formatKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`

  // Category bar chart
  const maxCatVal = Math.max(...Object.values(byCategory), 1)
  const categoryColors: Record<string, string> = {
    incomes: '#6BE3A4',
    bills: '#B4A7E5',
    subscriptions: '#60A5FA',
    expenses: '#FF6B6B',
    'savings & investments': '#6BE3A4',
    debt: '#F2C063',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: '#FAFAFA', fontSize: 20, fontWeight: 700 }}>
            Financial Report — {report.reportMonth}
          </h2>
          <p style={{ color: '#76746E', fontSize: 13, marginTop: 4 }}>
            Generated {new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <a
          href="/api/finance/workbook/download"
          style={{
            background: 'rgba(180,167,229,0.1)',
            border: '1px solid rgba(180,167,229,0.3)',
            color: '#B4A7E5',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Download Updated Workbook
        </a>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Income', value: formatKc(incomeVsExpense.income), color: '#6BE3A4' },
          { label: 'Total Expenses', value: formatKc(incomeVsExpense.expense), color: '#FF6B6B' },
          { label: 'Net Balance', value: formatKc(incomeVsExpense.net), color: incomeVsExpense.net >= 0 ? '#6BE3A4' : '#FF6B6B' },
          { label: 'Transactions', value: String(txCount), color: '#B4A7E5' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px 18px' }}>
            <p style={{ color: '#76746E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{kpi.label}</p>
            <p style={{ color: kpi.color, fontSize: 22, fontWeight: 700, marginTop: 8 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Spending by Category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ color: '#FAFAFA', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Spending by Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, val]) => {
                const pct = (val / maxCatVal) * 100
                const color = categoryColors[cat] || '#B4A7E5'
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#B8B6B0', fontSize: 13, textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600 }}>{formatKc(val)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 3,
                        width: `${pct}%`,
                        background: color,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* AI Narrative */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <h3 style={{ color: '#FAFAFA', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Analysis</h3>
        <div style={{ color: '#B8B6B0', fontSize: 14, lineHeight: 1.7 }}>
          {report.narrative.split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: i < report.narrative.split('\n\n').length - 1 ? 14 : 0 }}>
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
