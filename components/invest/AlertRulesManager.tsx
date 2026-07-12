'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetOption } from './TransactionForm'

export interface AlertRuleRow {
  id: string
  name: string
  type: string
  params: Record<string, unknown>
  isActive: boolean
  cooldownHours: number
}

const TYPE_LABELS: Record<string, string> = {
  price_vs_fair_value: 'Cena vs. fair value / MoS target',
  position_weight: 'Váha pozice nad prahem',
  drawdown_from_peak: 'Pokles od maxima',
  pe_percentile: 'P/E nad percentilem historie',
  cash_below: 'Cash rezerva pod prahem',
  analysis_stale: 'Aktivní analýza je stará',
}

function describeParams(rule: AlertRuleRow, assets: AssetOption[]): string {
  const p = rule.params
  const asset = assets.find((a) => a.id === p.assetId)?.ticker
  const pct = (v: unknown) => `${Math.round(Number(v) * 1000) / 10} %`
  switch (rule.type) {
    case 'price_vs_fair_value':
      return `práh ${pct(p.thresholdPct ?? 0.1)}${asset ? ` · jen ${asset}` : ' · všechny aktivní analýzy'}`
    case 'position_weight':
      return `váha > ${pct(p.thresholdPct)}${asset ? ` · jen ${asset}` : ''}`
    case 'drawdown_from_peak':
      return `pokles ≥ ${pct(p.thresholdPct)} za ${p.periodDays ?? 180} dní${asset ? ` · jen ${asset}` : ' · celé portfolio'}`
    case 'pe_percentile':
      return `${asset ?? '?'} · nad ${Math.round(Number(p.percentile ?? 0.9) * 100)}. percentilem`
    case 'cash_below':
      return `cash < ${Number(p.thresholdCzk).toLocaleString('cs-CZ')} Kč`
    case 'analysis_stale':
      return `starší než ${p.months ?? 6} měsíců`
    default:
      return ''
  }
}

const emptyForm = {
  name: '',
  type: 'price_vs_fair_value',
  thresholdPct: '10',
  periodDays: '180',
  percentile: '90',
  thresholdCzk: '',
  months: '6',
  assetId: '',
  cooldownHours: '72',
}

export default function AlertRulesManager({
  rules,
  assets,
}: {
  rules: AlertRuleRow[]
  assets: AssetOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildParams(): Record<string, unknown> {
    const pct = Number(form.thresholdPct.replace(',', '.')) / 100
    switch (form.type) {
      case 'price_vs_fair_value':
        return { thresholdPct: pct, ...(form.assetId ? { assetId: form.assetId } : {}) }
      case 'position_weight':
        return { thresholdPct: pct, ...(form.assetId ? { assetId: form.assetId } : {}) }
      case 'drawdown_from_peak':
        return {
          thresholdPct: pct,
          periodDays: Number(form.periodDays),
          ...(form.assetId ? { assetId: form.assetId } : {}),
        }
      case 'pe_percentile':
        return { assetId: form.assetId, percentile: Number(form.percentile.replace(',', '.')) / 100 }
      case 'cash_below':
        return { thresholdCzk: Number(form.thresholdCzk.replace(/\s/g, '').replace(',', '.')) }
      case 'analysis_stale':
        return { months: Number(form.months) }
      default:
        return {}
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/invest/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        params: buildParams(),
        cooldownHours: Number(form.cooldownHours),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Chyba (${res.status})`)
      return
    }
    setForm(emptyForm)
    setOpen(false)
    router.refresh()
  }

  async function toggle(rule: AlertRuleRow) {
    await fetch('/api/invest/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    })
    router.refresh()
  }

  async function remove(rule: AlertRuleRow) {
    if (!window.confirm(`Smazat pravidlo „${rule.name}" včetně historie?`)) return
    await fetch(`/api/invest/alerts?id=${rule.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const needsAsset = form.type === 'pe_percentile'
  const optionalAsset = ['price_vs_fair_value', 'position_weight', 'drawdown_from_peak'].includes(form.type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="fin-label">Pravidla ({rules.length})</span>
        <button type="button" className="fin-btn fin-btn-primary" onClick={() => setOpen(!open)}>
          + Nové pravidlo
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="fin-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label className="fin-field-label" htmlFor="ar-name">Název *</label>
              <input
                id="ar-name"
                className="fin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="např. AAPL blízko targetu"
                required
              />
            </div>
            <div>
              <label className="fin-field-label" htmlFor="ar-type">Typ</label>
              <select
                id="ar-type"
                className="fin-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fin-field-label" htmlFor="ar-cooldown">Cooldown (hodin)</label>
              <input
                id="ar-cooldown"
                type="number"
                min="1"
                className="fin-input fin-mono"
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: e.target.value })}
              />
            </div>

            {(form.type === 'price_vs_fair_value' || form.type === 'position_weight' || form.type === 'drawdown_from_peak') && (
              <div>
                <label className="fin-field-label" htmlFor="ar-threshold">Práh (%)</label>
                <input
                  id="ar-threshold"
                  className="fin-input fin-mono"
                  value={form.thresholdPct}
                  onChange={(e) => setForm({ ...form, thresholdPct: e.target.value })}
                  required
                />
              </div>
            )}
            {form.type === 'drawdown_from_peak' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-period">Období (dní)</label>
                <input
                  id="ar-period"
                  type="number"
                  min="7"
                  className="fin-input fin-mono"
                  value={form.periodDays}
                  onChange={(e) => setForm({ ...form, periodDays: e.target.value })}
                />
              </div>
            )}
            {form.type === 'pe_percentile' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-percentile">Percentil (%)</label>
                <input
                  id="ar-percentile"
                  className="fin-input fin-mono"
                  value={form.percentile}
                  onChange={(e) => setForm({ ...form, percentile: e.target.value })}
                />
              </div>
            )}
            {form.type === 'cash_below' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-cash">Práh (Kč)</label>
                <input
                  id="ar-cash"
                  className="fin-input fin-mono"
                  value={form.thresholdCzk}
                  onChange={(e) => setForm({ ...form, thresholdCzk: e.target.value })}
                  required
                />
              </div>
            )}
            {form.type === 'analysis_stale' && (
              <div>
                <label className="fin-field-label" htmlFor="ar-months">Stáří (měsíců)</label>
                <input
                  id="ar-months"
                  type="number"
                  min="1"
                  className="fin-input fin-mono"
                  value={form.months}
                  onChange={(e) => setForm({ ...form, months: e.target.value })}
                />
              </div>
            )}
            {(needsAsset || optionalAsset) && (
              <div>
                <label className="fin-field-label" htmlFor="ar-asset">
                  Asset{optionalAsset ? ' (volitelné — jinak všechny)' : ' *'}
                </label>
                <select
                  id="ar-asset"
                  className="fin-select fin-mono"
                  value={form.assetId}
                  onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                  required={needsAsset}
                >
                  <option value="">— všechny —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.ticker}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="fin-btn fin-btn-primary" disabled={saving}>
              {saving ? 'Ukládám…' : 'Vytvořit pravidlo'}
            </button>
            <button type="button" className="fin-btn" onClick={() => setOpen(false)}>Zrušit</button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="fin-empty">Žádná pravidla. Alerty se vyhodnocují každý večer v rámci daily cronu.</div>
      ) : (
        <table className="fin-table">
          <thead>
            <tr>
              <th>Pravidlo</th>
              <th>Podmínka</th>
              <th className="fin-num">Cooldown</th>
              <th>Stav</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} style={{ opacity: rule.isActive ? 1 : 0.5 }}>
                <td>
                  <span style={{ fontWeight: 600 }}>{rule.name}</span>
                  <div className="fin-subtle" style={{ fontSize: 11 }}>{TYPE_LABELS[rule.type] ?? rule.type}</div>
                </td>
                <td className="fin-muted" style={{ fontSize: 12 }}>{describeParams(rule, assets)}</td>
                <td className="fin-num">{rule.cooldownHours} h</td>
                <td>
                  <button
                    type="button"
                    className={rule.isActive ? 'fin-badge fin-badge-gain' : 'fin-badge'}
                    style={{ cursor: 'pointer', background: 'transparent' }}
                    onClick={() => void toggle(rule)}
                    title="Přepnout aktivní/vypnuté"
                  >
                    {rule.isActive ? 'aktivní' : 'vypnuté'}
                  </button>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="fin-btn fin-btn-danger"
                    style={{ padding: '3px 9px', fontSize: 12 }}
                    onClick={() => void remove(rule)}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
