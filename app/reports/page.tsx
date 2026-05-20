import { prisma } from '@/lib/db'
import ReportGeneratorWidget from '@/components/reports/ReportGenerator'
import ReportArchive from '@/components/reports/ReportArchive'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B', padding: 40 }}>No user found.</div>

  const weeklyReports = await prisma.weeklyReport.findMany({
    where: { userId: user.id },
    orderBy: { weekStart: 'desc' },
  })

  return (
    <main className="animate-entrance" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Chief of Staff Reports</h1>
        <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>
          Weekly executive briefings on your quarter performance.
        </p>
      </div>

      <ReportGeneratorWidget userId={user.id} />

      <ReportArchive
        reports={weeklyReports.map(r => ({
          id: r.id,
          weekStart: r.weekStart.toISOString(),
          weekEnd: r.weekEnd.toISOString(),
          executiveSummary: r.executiveSummary ?? null,
          goalBreakdown: r.goalBreakdown ?? null,
        }))}
      />
    </main>
  )
}
