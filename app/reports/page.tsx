import { prisma } from '@/lib/db'
import LiveWeekReport from '@/components/reports/LiveWeekReport'
import ReportArchive from '@/components/reports/ReportArchive'

export const dynamic = 'force-dynamic'

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

export default async function ReportsPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF6B6B', padding: 40 }}>No user found.</div>

  const { weekStart, weekEnd } = getWeekBounds()

  // Auto-archive stale live reports + get current live report in one pass
  const [liveReport, archivedReports] = await Promise.all([
    prisma.weeklyReport.findFirst({
      where: { userId: user.id, isLive: true, weekStart: { gte: weekStart, lte: weekEnd } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.weeklyReport.findMany({
      where: { userId: user.id, isLive: false },
      orderBy: { weekStart: 'desc' },
      take: 20,
    }),
  ])

  // Serialize for client components
  const liveReportSerialized = liveReport ? {
    id: liveReport.id,
    weekStart: liveReport.weekStart.toISOString(),
    weekEnd: liveReport.weekEnd.toISOString(),
    status: liveReport.status,
    liveData: liveReport.liveData ?? null,
    updatedAt: liveReport.updatedAt.toISOString(),
  } : null

  return (
    <main className="animate-entrance" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAFAFA' }}>Weekly Command Brief</h1>
        <p style={{ color: '#B8B6B0', fontSize: 14, marginTop: 4 }}>
          Live performance snapshot · auto-updates as data comes in
        </p>
      </div>

      {/* Live report */}
      <LiveWeekReport
        initialReport={liveReportSerialized}
        userId={user.id}
      />

      {/* Archive */}
      {archivedReports.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 28 }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#FAFAFA', marginBottom: 16 }}>Past Reports</h2>
          <ReportArchive
            reports={archivedReports.map(r => ({
              id: r.id,
              weekStart: r.weekStart.toISOString(),
              weekEnd: r.weekEnd.toISOString(),
              executiveSummary: r.executiveSummary ?? null,
              goalBreakdown: r.goalBreakdown ?? null,
              status: r.status,
              liveData: r.liveData ?? null,
            }))}
          />
        </div>
      )}
    </main>
  )
}
