import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import TransactionReviewer from '@/components/finance/TransactionReviewer'
import FinancialReportView from '@/components/finance/FinancialReportView'
import GenerateReportButton from '@/components/finance/GenerateReportButton'

export const dynamic = 'force-dynamic'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function StatementPage({ params }: { params: Promise<{ statementId: string }> }) {
  const { statementId } = await params

  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B' }}>No user found</div>

  const [statement, transactionRules] = await Promise.all([
    prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        transactions: { orderBy: { date: 'desc' } },
        report: true,
      },
    }),
    prisma.transactionRule.findMany({ where: { userId: user.id } }),
  ])

  if (!statement) notFound()

  const statusColors: Record<string, string> = {
    pending: '#F2C063',
    reviewing: '#60A5FA',
    committed: '#6BE3A4',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>
            {months[statement.month - 1]} {statement.year}
          </h1>
          <p style={{ color: '#76746E', fontSize: 13, marginTop: 4 }}>{statement.filename}</p>
        </div>
        <span style={{
          background: `${statusColors[statement.status] ?? '#76746E'}20`,
          color: statusColors[statement.status] ?? '#76746E',
          border: `1px solid ${statusColors[statement.status] ?? '#76746E'}40`,
          padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
        }}>
          {statement.status}
        </span>
      </div>

      {statement.report && (
        <div style={{ marginBottom: 24 }}>
          <FinancialReportView report={statement.report} userId={user.id} />
        </div>
      )}

      {statement.status === 'committed' && !statement.report && (
        <div className="card" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#B8B6B0', fontSize: 14 }}>Statement committed — ready to generate monthly report.</p>
          <GenerateReportButton statementId={statement.id} userId={user.id} />
        </div>
      )}

      <TransactionReviewer
        statement={statement}
        rules={transactionRules}
        userId={user.id}
      />
    </div>
  )
}
