/**
 * Next.js instrumentation hook — runs once when the Node.js server starts.
 * Used to apply Prisma schema migrations at runtime, where DATABASE_URL
 * is always available (unlike the build step on some Vercel configurations).
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge), and only in production/server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { execSync } = await import('child_process')
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        timeout: 60_000,
      })
    } catch (e) {
      // Non-fatal: log and continue. App will still work; some new features
      // may be unavailable if the schema hasn't been applied yet.
      console.error('[instrumentation] prisma db push failed:', e)
    }
  }
}
