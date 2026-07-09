/**
 * Serializes calls and enforces a minimum interval between them, so we never
 * hammer a provider's rate limit (Finnhub free tier: 60 calls/min).
 */
export class Throttle {
  private lastRun = 0
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const wait = this.lastRun + this.minIntervalMs - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      try {
        return await fn()
      } finally {
        this.lastRun = Date.now()
      }
    })
    // Keep the chain alive even when a task rejects
    this.queue = task.catch(() => undefined)
    return task
  }
}
