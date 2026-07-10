'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetOption } from './TransactionForm'

// Pick or create an asset → fetch fundamentals → open the calculator
export default function NewAnalysisForm({ assets }: { assets: AssetOption[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'existing' | 'new'>(assets.length > 0 ? 'existing' : 'new')
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '')
  const [newAsset, setNewAsset] = useState({ ticker: '', name: '', currency: 'USD' })
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    let targetAssetId = assetId
    let ticker = assets.find((a) => a.id === assetId)?.ticker ?? ''

    if (mode === 'new') {
      const res = await fetch('/api/invest/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsset),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSaving(false)
        setError(data?.error ?? `Vytvoření assetu selhalo (${res.status})`)
        return
      }
      targetAssetId = data.asset.id
      ticker = data.asset.ticker
    }

    const res = await fetch('/api/invest/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: targetAssetId,
        title: title.trim() || `${ticker} — ${new Date().toLocaleDateString('cs-CZ')}`,
      }),
    })
    const data = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(data?.error ?? `Vytvoření analýzy selhalo (${res.status})`)
      return
    }
    router.push(`/invest/analyza/${data.analysis.id}`)
  }

  return (
    <form onSubmit={submit} className="fin-card" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={mode === 'existing' ? 'fin-btn fin-btn-primary' : 'fin-btn'}
          onClick={() => setMode('existing')}
          disabled={assets.length === 0}
        >
          Existující asset
        </button>
        <button
          type="button"
          className={mode === 'new' ? 'fin-btn fin-btn-primary' : 'fin-btn'}
          onClick={() => setMode('new')}
        >
          Nový asset
        </button>
      </div>

      {mode === 'existing' ? (
        <div>
          <label className="fin-field-label" htmlFor="na-asset">Asset</label>
          <select
            id="na-asset"
            className="fin-select fin-mono"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            required
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.ticker}</option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
          <div>
            <label className="fin-field-label" htmlFor="na-ticker">Ticker *</label>
            <input
              id="na-ticker"
              className="fin-input fin-mono"
              value={newAsset.ticker}
              onChange={(e) => setNewAsset({ ...newAsset, ticker: e.target.value })}
              placeholder="AAPL"
              required
            />
          </div>
          <div>
            <label className="fin-field-label" htmlFor="na-name">Název *</label>
            <input
              id="na-name"
              className="fin-input"
              value={newAsset.name}
              onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
              placeholder="Apple Inc."
              required
            />
          </div>
          <div>
            <label className="fin-field-label" htmlFor="na-currency">Měna</label>
            <select
              id="na-currency"
              className="fin-select"
              value={newAsset.currency}
              onChange={(e) => setNewAsset({ ...newAsset, currency: e.target.value })}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CZK">CZK</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="fin-field-label" htmlFor="na-title">Název analýzy</label>
        <input
          id="na-title"
          className="fin-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="AAPL — base case, 07/2026"
        />
      </div>

      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}

      <div>
        <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
          {saving ? 'Zakládám a stahuji fundamenty…' : 'Založit analýzu'}
        </button>
      </div>
      <p className="fin-subtle" style={{ margin: 0, fontSize: 12 }}>
        Po založení se stáhnou fundamenty z API (co jde), zbytek doplníš ručně v kalkulačce.
      </p>
    </form>
  )
}
