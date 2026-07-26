'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Clears manual discount-rate overrides across every analysis so each DCF
// follows its computed WACC, then recomputes and re-renders the list.
export default function AnchorDiscountsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function anchor() {
    if (
      !confirm(
        'Anchor the discount rate of every analysis to its computed WACC?\n\n' +
          'This clears any manually typed discount rate so the DCF uses the ' +
          'model-consistent cost of capital. You can still override any single ' +
          'analysis afterwards.',
      )
    )
      return
    setBusy(true)
    setStatus(null)
    setIsError(false)
    try {
      const res = await fetch('/api/invest/analyses/discounts/anchor-wacc', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as
        | { anchored?: number; kept?: number; total?: number }
        | null
      if (!res.ok || !data) {
        setIsError(true)
        setStatus(`Error (${res.status})`)
        return
      }
      const kept = data.kept ?? 0
      setStatus(
        `${data.anchored ?? 0} anchored to WACC` + (kept > 0 ? ` · ${kept} kept (no WACC yet)` : ''),
      )
      router.refresh()
    } catch (e) {
      setIsError(true)
      setStatus(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {status && (
        <span
          className={isError ? 'fin-warn' : 'fin-subtle'}
          style={{ fontSize: 12, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {status}
        </span>
      )}
      <button type="button" className="fin-btn" onClick={() => void anchor()} disabled={busy}>
        {busy ? 'Anchoring…' : 'Anchor discounts to WACC'}
      </button>
    </div>
  )
}
