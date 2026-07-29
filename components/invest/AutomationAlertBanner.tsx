'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Dismissible warning banner shown when the most recent run of one or more
 * automation jobs failed. Dismissal is session-local (resets on reload) — the
 * point is visibility, not a persisted acknowledgement.
 */
export default function AutomationAlertBanner({ failedJobs }: { failedJobs: string[] }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || failedJobs.length === 0) return null

  const label =
    failedJobs.length === 1
      ? `Last ${failedJobs[0]} automation run failed`
      : `${failedJobs.length} automation jobs failed on their last run (${failedJobs.join(', ')})`

  return (
    <div
      role="alert"
      className="fin-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        borderColor: 'var(--fin-loss-border)',
        background: 'var(--fin-loss-bg)',
      }}
    >
      <span className="fin-badge fin-badge-loss">automation</span>
      <span className="fin-loss" style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
        {label} —{' '}
        <Link href="/invest#automation" className="fin-loss" style={{ textDecoration: 'underline' }}>
          see Automation status
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="fin-btn"
        style={{ fontSize: 12, padding: '2px 10px' }}
      >
        Dismiss
      </button>
    </div>
  )
}
