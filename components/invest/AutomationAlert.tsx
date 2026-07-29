import { desc } from 'drizzle-orm'
import { getInvestDb, cronRuns } from '@/lib/invest/db'
import AutomationAlertBanner from './AutomationAlertBanner'

// Automation jobs whose health is surfaced on /invest. Other cron routes
// (meal-plan, weekly-report) belong to different modules.
const WATCHED_JOBS = ['daily', 'weekly', 'digest'] as const

/**
 * Server component: finds the most recent run of each watched job and, if its
 * latest run errored, renders a visible banner so a failure doesn't sit
 * silently at the bottom of the Automation status log. Fails closed (renders
 * nothing) if the DB is unavailable.
 */
export default async function AutomationAlert() {
  let failedJobs: string[] = []
  try {
    const db = getInvestDb()
    // A handful of recent runs is enough to find the latest per job (jobs run
    // at most daily); reduce to the newest run for each.
    const recent = await db
      .select({ job: cronRuns.job, status: cronRuns.status, startedAt: cronRuns.startedAt })
      .from(cronRuns)
      .orderBy(desc(cronRuns.startedAt))
      .limit(40)

    const latestByJob = new Map<string, string>()
    for (const run of recent) {
      if (!latestByJob.has(run.job)) latestByJob.set(run.job, run.status)
    }
    failedJobs = WATCHED_JOBS.filter((job) => latestByJob.get(job) === 'error')
  } catch {
    return null
  }

  return <AutomationAlertBanner failedJobs={failedJobs} />
}
