'use client'

import { useCallback, useState } from 'react'
import { formatDate, formatMoney } from '@/lib/invest/format'

export interface AssetRow {
  id: string
  ticker: string
  name: string
  currency: string
  exchange: string | null
  sector: string | null
  manualPricing: boolean
  needsMapping: boolean
  latestPrice: { price: string; date: string } | null
}

interface PriceRow {
  id: string
  price: string
  date: string
}

const emptyForm = {
  ticker: '',
  name: '',
  currency: 'USD',
  exchange: '',
  sector: '',
  manualPricing: false,
}

type FormState = typeof emptyForm

export default function AssetsManager({ initialAssets }: { initialAssets: AssetRow[] }) {
  const [assetList, setAssetList] = useState<AssetRow[]>(initialAssets)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Manual price entry panel
  const [priceAssetId, setPriceAssetId] = useState<string | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceRow[]>([])
  const [priceForm, setPriceForm] = useState({
    price: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)

  const priceAsset = assetList.find((a) => a.id === priceAssetId) ?? null

  const reload = useCallback(async () => {
    const res = await fetch('/api/invest/assets')
    if (res.ok) {
      const data = await res.json()
      setAssetList(data.assets)
    }
  }, [])

  const loadPrices = useCallback(async (assetId: string) => {
    const res = await fetch(`/api/invest/assets/${assetId}/prices`)
    if (res.ok) {
      const data = await res.json()
      setPriceHistory(data.prices)
    }
  }, [])

  function togglePricePanel(asset: AssetRow) {
    if (priceAssetId === asset.id) {
      setPriceAssetId(null)
      return
    }
    setPriceAssetId(asset.id)
    setPriceHistory([])
    setPriceError(null)
    void loadPrices(asset.id)
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setFormOpen(true)
  }

  function startEdit(asset: AssetRow) {
    setEditingId(asset.id)
    setForm({
      ticker: asset.ticker,
      name: asset.name,
      currency: asset.currency,
      exchange: asset.exchange ?? '',
      sector: asset.sector ?? '',
      manualPricing: asset.manualPricing,
    })
    setError(null)
    setFormOpen(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ticker: form.ticker,
      name: form.name,
      currency: form.currency,
      exchange: form.exchange || null,
      sector: form.sector || null,
      manualPricing: form.manualPricing,
    }
    const res = await fetch(editingId ? `/api/invest/assets/${editingId}` : '/api/invest/assets', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Error (${res.status})`)
      return
    }
    setFormOpen(false)
    setForm(emptyForm)
    setEditingId(null)
    await reload()
  }

  async function deleteAsset(asset: AssetRow) {
    if (!window.confirm(`Delete asset ${asset.ticker} including prices and analyses?`)) return
    const res = await fetch(`/api/invest/assets/${asset.id}`, { method: 'DELETE' })
    if (res.ok) {
      if (priceAssetId === asset.id) setPriceAssetId(null)
      await reload()
    }
  }

  async function submitPrice(e: React.FormEvent) {
    e.preventDefault()
    if (!priceAssetId) return
    setPriceSaving(true)
    setPriceError(null)
    const res = await fetch(`/api/invest/assets/${priceAssetId}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(priceForm),
    })
    setPriceSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setPriceError(data?.error ?? `Error (${res.status})`)
      return
    }
    setPriceForm((f) => ({ ...f, price: '' }))
    await Promise.all([loadPrices(priceAssetId), reload()])
  }

  async function deletePrice(row: PriceRow) {
    if (!priceAssetId) return
    const res = await fetch(`/api/invest/assets/${priceAssetId}/prices?date=${row.date}`, {
      method: 'DELETE',
    })
    if (res.ok) await Promise.all([loadPrices(priceAssetId), reload()])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="fin-label">Assets ({assetList.length})</span>
        <button type="button" className="fin-btn fin-btn-primary" onClick={startCreate}>
          + Add asset
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submitForm} className="fin-card" style={{ padding: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <label className="fin-field-label" htmlFor="asset-ticker">
                Ticker *
              </label>
              <input
                id="asset-ticker"
                className="fin-input fin-mono"
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                placeholder="AAPL"
                required
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="fin-field-label" htmlFor="asset-name">
                Name *
              </label>
              <input
                id="asset-name"
                className="fin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Apple Inc."
                required
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="asset-currency">
                Currency *
              </label>
              <select
                id="asset-currency"
                className="fin-select"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CZK">CZK</option>
              </select>
            </div>
            <div>
              <label className="fin-field-label" htmlFor="asset-exchange">
                Exchange
              </label>
              <input
                id="asset-exchange"
                className="fin-input"
                value={form.exchange}
                onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                placeholder="NASDAQ / PSE"
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="asset-sector">
                Sector
              </label>
              <input
                id="asset-sector"
                className="fin-input"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="Technology"
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              fontSize: 13,
              cursor: 'pointer',
            }}
            className="fin-muted"
          >
            <input
              type="checkbox"
              checked={form.manualPricing}
              onChange={(e) => setForm({ ...form, manualPricing: e.target.checked })}
            />
            Manual prices (asset the market-data provider does not know — e.g. Prague exchange)
          </label>

          {error && (
            <p className="fin-loss" style={{ margin: '12px 0 0', fontSize: 13 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create asset"}
            </button>
            <button type="button" className="fin-btn" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="fin-card" style={{ padding: 0, overflowX: 'auto' }}>
        {assetList.length === 0 ? (
          <div className="fin-empty">
            No assets yet. Add the first one with the “+ Add asset” button.
          </div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th>Currency</th>
                <th>Sector</th>
                <th className="fin-num">Last price</th>
                <th>As of</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assetList.map((asset) => (
                <tr key={asset.id}>
                  <td className="fin-mono" style={{ fontWeight: 600 }}>
                    {asset.ticker}
                    {asset.manualPricing && (
                      <span className="fin-badge" style={{ marginLeft: 8 }}>
                        manual
                      </span>
                    )}
                    {asset.needsMapping && (
                      <span className="fin-badge fin-badge-warn" style={{ marginLeft: 8 }}>
                        needs mapping
                      </span>
                    )}
                  </td>
                  <td className="fin-muted">{asset.name}</td>
                  <td className="fin-mono">{asset.currency}</td>
                  <td className="fin-muted">{asset.sector ?? '—'}</td>
                  <td className="fin-num">
                    {asset.latestPrice
                      ? formatMoney(asset.latestPrice.price, asset.currency)
                      : '—'}
                  </td>
                  <td className="fin-subtle">
                    {asset.latestPrice ? formatDate(asset.latestPrice.date) : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="fin-btn"
                      style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                      onClick={() => togglePricePanel(asset)}
                    >
                      Prices
                    </button>
                    <button
                      type="button"
                      className="fin-btn"
                      style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                      onClick={() => startEdit(asset)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="fin-btn fin-btn-danger"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => deleteAsset(asset)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {priceAsset && (
        <div className="fin-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 16,
            }}
          >
            <span className="fin-label">
              Prices — <span className="fin-gold">{priceAsset.ticker}</span>
            </span>
            {!priceAsset.manualPricing && (
              <span className="fin-subtle" style={{ fontSize: 12 }}>
                Asset has automatic prices; manual entry only serves as a supplement or correction.
              </span>
            )}
          </div>

          <form
            onSubmit={submitPrice}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div>
              <label className="fin-field-label" htmlFor="price-date">
                Date
              </label>
              <input
                id="price-date"
                type="date"
                className="fin-input fin-mono"
                value={priceForm.date}
                onChange={(e) => setPriceForm({ ...priceForm, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="price-value">
                Price ({priceAsset.currency})
              </label>
              <input
                id="price-value"
                type="number"
                step="any"
                min="0"
                className="fin-input fin-mono"
                value={priceForm.price}
                onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                placeholder="123.45"
                required
              />
            </div>
            <button type="submit" className="fin-btn fin-btn-primary" disabled={priceSaving}>
              {priceSaving ? "Saving…" : "Save price"}
            </button>
          </form>
          {priceError && (
            <p className="fin-loss" style={{ margin: '10px 0 0', fontSize: 13 }}>
              {priceError}
            </p>
          )}

          {priceHistory.length > 0 && (
            <table className="fin-table" style={{ marginTop: 18 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="fin-num">Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((row) => (
                  <tr key={row.id}>
                    <td className="fin-mono">{formatDate(row.date)}</td>
                    <td className="fin-num">{formatMoney(row.price, priceAsset.currency)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="fin-btn fin-btn-danger"
                        style={{ padding: '3px 9px', fontSize: 12 }}
                        onClick={() => deletePrice(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
