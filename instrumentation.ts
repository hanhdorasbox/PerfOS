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
      // Use the local binary directly — npx adds startup overhead and can
      // fail silently on Vercel Lambda where PATH may not include npm shims.
      const prismaBin = `${process.cwd()}/node_modules/.bin/prisma`
      execSync(`${prismaBin} db push --accept-data-loss --skip-generate`, {
        stdio: 'inherit',
        timeout: 90_000, // bumped from 60s — Neon cold-start can be slow
      })
    } catch (e) {
      // Non-fatal: log and continue. App will still work; some new features
      // may be unavailable if the schema hasn't been applied yet.
      console.error('[instrumentation] prisma db push failed:', e)
    }
  }
}
