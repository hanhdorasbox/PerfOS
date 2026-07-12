'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncNowButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function sync() {
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch('/api/invest/sync', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setIsError(true)
        setMessage(data?.error ?? `Sync failed (${res.status})`)
      } else {
        setIsError(false)
        const warnings = Array.isArray(data.warnings) ? data.warnings.length : 0
        setMessage(
          `Done: ${data.ordersImported} orders, ${data.dividendsImported} dividends` +
            (warnings > 0 ? `, ${warnings} discrepancies` : ''),
        )
        router.refresh()
      }
    } catch (e) {
      setIsError(true)
      setMessage(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" className="fin-btn fin-btn-primary" onClick={sync} disabled={running}>
        {running ? 'Synchronizuji…' : 'Sync teď'}
      </button>
      {message && (
        <span className={isError ? 'fin-loss' : 'fin-muted'} style={{ fontSize: 12 }}>
          {message}
        </span>
      )}
    </span>
  )
}
