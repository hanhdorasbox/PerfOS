'use client'
/**
 * Silently refreshes behavior patterns in the background.
 * - Fires once on mount
 * - The server-side analyze route skips if patterns are < 23h old
 * - On success, calls router.refresh() so the page shows fresh patterns
 * - Shows a subtle status chip — never blocks the UI
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  /** ISO string of the most recently updated pattern, or null if none */
  lastPatternAt: string | null
}

type State = 'idle' | 'refreshing' | 'done' | 'skipped' | 'error'

export default function AutoPatternRefresh({ userId, lastPatternAt }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    // Check age client-side first to avoid unnecessary network hit
    if (lastPatternAt) {
      const ageMs = Date.now() - new Date(lastPatternAt).getTime()
      if (ageMs < 23 * 60 * 60 * 1000) {
        setState('skipped')
        return
      }
    }

    // Patterns are stale or don't exist — trigger background analysis
    setState('refreshing')

    fetch('/api/operating-manual/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, auto: true }),
    })
      .then(r => r.json())
      .then((data: { skipped?: boolean; patterns?: unknown[] }) => {
        if (data.skipped) {
          setState('skipped')
        } else {
          setState('done')
          router.refresh()
        }
      })
      .catch(() => setState('error'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Format last updated time
  const lastUpdatedLabel = lastPatternAt
    ? (() => {
        const mins = Math.round((Date.now() - new Date(lastPatternAt).getTime()) / 60000)
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.round(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.round(hrs / 24)}d ago`
      })()
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {state === 'refreshing' && (
        <span style={{
          fontSize: 11, color: '#B4A7E5',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: 99,
            background: '#B4A7E5',
            animation: 'patternPulse 1s ease-in-out infinite',
          }} />
          Learning from your data…
        </span>
      )}
      {(state === 'done' || state === 'skipped') && (
        <span style={{ fontSize: 11, color: '#76746E' }}>
          ✓ Up to date
          {lastUpdatedLabel && ` · ${lastUpdatedLabel}`}
        </span>
      )}
      {state === 'error' && (
        <span style={{ fontSize: 11, color: '#76746E' }}>Auto-learn unavailable</span>
      )}
      <style>{`
        @keyframes patternPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
