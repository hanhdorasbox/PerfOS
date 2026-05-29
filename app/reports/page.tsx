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

// Minimal serializable shape to pass to client components
interface LiveReportRow {
  id: string
  weekStart: Date
  weekEnd: Date
  liveData?: string | null
  status?: string | null
  updatedAt?: Date | null
  createdAt: Date
}

interface ArchiveRow {
  id: string
  weekStart: Date
  weekEnd: Date
  executiveSummary?: string | null
  goalBreakdown?: string | null
  status?: string | null
  liveData?: string | null
}

export default async function ReportsPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF9B87', padding: 40 }}>No user found.</div>

  const { weekStart, weekEnd } = getWeekBounds()

  // Gracefully handle DB schema migration lag — new columns may not exist yet
  let liveReport: LiveReportRow | null = null
  let archivedReports: ArchiveRow[] = []

  try {
    const [live, archived] = await Promise.all([
      prisma.weeklyReport.findFirst({
        where: { userId: user.id, isLive: true, weekStart: { gte: weekStart, lte: weekEnd } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.weeklyReport.findMany({
        where: { userId: user.id, isLive: false },
        orderBy: { weekStart: 'desc' },
        take: 20,
      }),
    ])
    if (live) liveReport = live as LiveReportRow
    archivedReports = archived as ArchiveRow[]
  } catch (e) {
    console.error('[ReportsPage] DB query failed — schema may not be migrated yet:', e)
    // Fall through with empty data; user sees "Load Live Report" button
  }

  const liveReportSerialized = liveReport ? {
    id: liveReport.id,
    weekStart: liveReport.weekStart.toISOString(),
    weekEnd: liveReport.weekEnd.toISOString(),
    status: liveReport.status ?? 'stable',
    liveData: liveReport.liveData ?? null,
    updatedAt: liveReport.updatedAt?.toISOString() ?? liveReport.createdAt.toISOString(),
  } : null

  return (
    <main className="animate-entrance" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Weekly Command Brief</h1>
        <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>Past Reports</h2>
          <ReportArchive
            reports={archivedReports.map(r => ({
              id: r.id,
              weekStart: r.weekStart.toISOString(),
              weekEnd: r.weekEnd.toISOString(),
              executiveSummary: r.executiveSummary ?? null,
              goalBreakdown: r.goalBreakdown ?? null,
              status: r.status ?? 'stable',
              liveData: r.liveData ?? null,
            }))}
          />
        </div>
      )}
    </main>
  )
}
