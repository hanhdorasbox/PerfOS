'use client'

import { useState } from 'react'
import { formatPercentSigned } from '@/lib/invest/format'

// Two table cells: an editable target margin-of-safety (folded in from the old
// watchlist) and the live distance from the current (blended) MoS to that
// target. Editing upserts a watchlist row for the asset, so alerts keep working.
export default function TargetMosCells({
  assetId,
  watchId: initialWatchId,
  initialTargetPct,
  currentMos,
}: {
  assetId: string
  watchId: string | null
  /** Stored target as a percentage, e.g. 25 */
  initialTargetPct: number | null
  /** Current (blended) margin of safety as a fraction, e.g. -0.99 */
  currentMos: number | null
}) {
  const [watchId, setWatchId] = useState(initialWatchId)
  const [pct, setPct] = useState(initialTargetPct !== null ? String(initialTargetPct) : '')
  const [saving, setSaving] = useState(false)

  const targetFraction =
    pct.trim() !== '' && Number.isFinite(Number(pct.replace(',', '.')))
      ? Number(pct.replace(',', '.')) / 100
      : null
  const distance = currentMos !== null && targetFraction !== null ? currentMos - targetFraction : null
  const distClass = distance === null ? 'fin-muted' : distance >= 0 ? 'fin-gain' : 'fin-loss'

  async function commit() {
    const n = Number(pct.replace(',', '.'))
    if (pct.trim() === '' || !Number.isFinite(n)) return
    const fraction = Math.max(0, Math.min(0.95, n / 100))
    setSaving(true)
    try {
      if (watchId) {
        await fetch('/api/invest/watchlist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: watchId, targetMos: fraction }),
        })
      } else {
        const res = await fetch('/api/invest/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId, targetMos: fraction }),
        })
        const data = (await res.json().catch(() => null)) as { item?: { id?: string } } | null
        if (res.ok && data?.item?.id) setWatchId(data.item.id)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <td className="fin-num">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
          <input
            className="fin-input fin-mono"
            style={{ width: 52, textAlign: 'right', padding: '4px 6px' }}
            value={pct}
            inputMode="decimal"
            placeholder="—"
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={saving}
            aria-label="Target margin of safety, percent"
          />
          <span className="fin-subtle" style={{ fontSize: 12 }}>%</span>
        </span>
      </td>
      <td className={`fin-num ${distClass}`}>{distance !== null ? formatPercentSigned(distance) : '—'}</td>
    </>
  )
}
