'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, RotateCcw } from 'lucide-react'
import { FIELD_DEFS, effectiveValue, type FieldDef } from '@/lib/invest/valuation/fields'
import { computeValuation } from '@/lib/invest/valuation/compute'
import { formatMoney, formatNumber, formatPercent, formatPercentSigned } from '@/lib/invest/format'
import InfoHint from '@/components/invest/InfoHint'

export interface CalcInput {
  field: string
  fetchedValue: string | null
  manualValue: string | null
  note: string | null
  source: string
  snapshotAt: string
}

export interface CalcAnalysis {
  id: string
  title: string
  status: 'draft' | 'active' | 'archived'
  qualitativeNotes: string
}

interface Props {
  analysis: CalcAnalysis
  asset: { ticker: string; name: string; currency: string }
  initialInputs: CalcInput[]
  currentPrice: string | null
  targetMos: string | null
  fundamentalsFetchedAt: string | null
  /**
   * Multiplier from the fetched-data currency into the asset's display
   * currency (1 when they match). Stored values stay in the native currency;
   * we convert only at the display/edit boundary so the math stays consistent.
   */
  fxFactor?: number
  /** Native currency of the fetched figures (e.g. "USD"), for the FX note. */
  dataCurrency?: string | null
}

type InputMap = Record<string, CalcInput>

const STATUS_LABELS = { draft: 'draft', active: 'active', archived: 'archived' } as const

function toMap(inputs: CalcInput[]): InputMap {
  return Object.fromEntries(inputs.map((i) => [i.field, i]))
}

/** Trims binary-float noise from a converted money figure without losing scale. */
function tidy(n: number): number {
  return Number(n.toPrecision(12))
}

/**
 * Editor value: percents are edited as 2.5 (=0.025); money is shown in the
 * display currency (native × fxFactor); other numbers raw. Stored state stays
 * native — `fromEditor` reverses the money conversion on the way back in.
 */
function toEditor(def: FieldDef, value: string | null, fxFactor: number): string {
  if (value === null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  if (def.format === 'percent') return String(Math.round(n * 1e6) / 1e4)
  if (def.format === 'money') return String(tidy(n * fxFactor))
  return String(n)
}

function fromEditor(def: FieldDef, raw: string, fxFactor: number): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  if (def.format === 'percent') return n / 100
  // Money is typed in the display currency → store back in the native currency.
  if (def.format === 'money') return fxFactor !== 0 ? tidy(n / fxFactor) : n
  return n
}

function formatByDef(def: FieldDef, value: string | null, currency: string, fxFactor: number): string {
  if (value === null) return '—'
  if (def.format === 'percent') return formatPercent(value)
  if (def.format === 'money') return formatMoney(Number(value) * fxFactor, currency, 2)
  return formatNumber(value, 2)
}

/** Per-share/money output (already computed in the native currency) → display currency. */
function displayMoney(value: string | number | null, currency: string, fxFactor: number): string {
  if (value === null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return formatMoney(n * fxFactor, currency)
}

const METHOD_COLORS = { dcf: 'var(--fin-gold)', pe: '#61adff', ev: '#4fd1c5' }

/**
 * Horizontal band from the lowest to the highest method value, with a marker
 * per method, the blended point, and the current price — so the read is a range
 * with a visible spread, not one number. Positions use the native values (the
 * FX factor cancels in a ratio); only the end labels are converted.
 */
function MethodRange({
  currency,
  fxFactor,
  dcf,
  pe,
  ev,
  blended,
  low,
  high,
  price,
}: {
  currency: string
  fxFactor: number
  dcf: number | null
  pe: number | null
  ev: number | null
  blended: number
  low: number
  high: number
  price: number | null
}) {
  const anchors = [low, high, ...(price != null ? [price] : [])]
  const dmin = Math.min(...anchors)
  const dmax = Math.max(...anchors)
  const pad = (dmax - dmin || Math.abs(dmax) || 1) * 0.12
  const lo = dmin - pad
  const hi = dmax + pad
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
  const markers = [
    { v: dcf, color: METHOD_COLORS.dcf, label: 'DCF' },
    { v: pe, color: METHOD_COLORS.pe, label: 'P/E' },
    { v: ev, color: METHOD_COLORS.ev, label: 'EV/EBITDA' },
  ]
  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          marginTop: 30,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${pos(low)}%`,
            width: `${pos(high) - pos(low)}%`,
            top: 0,
            bottom: 0,
            background: 'rgba(212,175,55,0.20)',
            borderRadius: 4,
          }}
        />
        <div
          title="Blended fair value"
          style={{ position: 'absolute', left: `${pos(blended)}%`, top: -4, bottom: -4, width: 2, background: 'var(--fin-gold)', transform: 'translateX(-1px)' }}
        />
        {markers.map((m) =>
          m.v == null ? null : (
            <div key={m.label} style={{ position: 'absolute', left: `${pos(m.v)}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, border: '2px solid #0b0b0e' }} />
              <div className="fin-mono" style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: m.color, whiteSpace: 'nowrap' }}>
                {m.label}
              </div>
            </div>
          ),
        )}
        {price != null && (
          <div style={{ position: 'absolute', left: `${pos(price)}%`, top: -9, bottom: -9, width: 2, background: 'var(--fin-text)', transform: 'translateX(-1px)' }}>
            <div className="fin-mono" style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--fin-text)', whiteSpace: 'nowrap' }}>
              price
            </div>
          </div>
        )}
      </div>
      <div className="fin-subtle" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span className="fin-mono">{formatMoney(low * fxFactor, currency)}</span>
        <span className="fin-mono">{formatMoney(high * fxFactor, currency)}</span>
      </div>
    </div>
  )
}

export default function AnalysisCalculator({
  analysis,
  asset,
  initialInputs,
  currentPrice,
  targetMos,
  fundamentalsFetchedAt,
  fxFactor = 1,
  dataCurrency = null,
}: Props) {
  const router = useRouter()
  const [inputs, setInputs] = useState<InputMap>(toMap(initialInputs))
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState(analysis.qualitativeNotes)
  const [status, setStatus] = useState(analysis.status)
  const [title, setTitle] = useState(analysis.title)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refetchDiffs, setRefetchDiffs] = useState<
    Array<{ field: string; changePct: number | null }>
  >([])
  const [refetching, setRefetching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fading, setFading] = useState(false)
  const [aiFilling, setAiFilling] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const computed = useMemo(
    () => computeValuation(Object.values(inputs), currentPrice),
    [inputs, currentPrice],
  )

  const problemFields = new Set(computed.problems.map((p) => p.field))

  async function persistField(field: string, manualValue: number | null, note?: string | null) {
    setSaving(field)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}/inputs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, manualValue, ...(note !== undefined ? { note } : {}) }),
    })
    setSaving(null)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Failed to save field (${res.status})`)
      return false
    }
    return true
  }

  function setLocal(field: string, patch: Partial<CalcInput>) {
    setInputs((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }))
  }

  async function commitDraft(def: FieldDef) {
    const raw = drafts[def.key]
    if (raw === undefined) return
    const current = inputs[def.key]
    const parsed = fromEditor(def, raw, fxFactor)

    // For fetched fields an empty input means "reset to fetched"
    const manualValue =
      parsed === null ? null : parsed
    const prevManual = current?.manualValue ?? null
    const nextManual = manualValue === null ? null : String(manualValue)
    setDrafts((d) => {
      const next = { ...d }
      delete next[def.key]
      return next
    })
    if (nextManual === prevManual) return

    setLocal(def.key, { manualValue: nextManual })
    const ok = await persistField(def.key, manualValue)
    if (!ok) setLocal(def.key, { manualValue: prevManual })
  }

  async function resetField(def: FieldDef) {
    const prev = inputs[def.key]?.manualValue ?? null
    setLocal(def.key, { manualValue: null })
    const ok = await persistField(def.key, null)
    if (!ok) setLocal(def.key, { manualValue: prev })
  }

  async function saveNote(def: FieldDef, note: string) {
    const current = inputs[def.key]
    const manual = current?.manualValue !== null ? Number(current?.manualValue) : null
    setLocal(def.key, { note: note || null })
    await persistField(def.key, manual, note || null)
  }

  async function patchAnalysis(patch: Record<string, unknown>) {
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Save failed (${res.status})`)
      return
    }
    router.refresh()
  }

  async function refetch() {
    setRefetching(true)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}/refetch`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    setRefetching(false)
    if (!res.ok) {
      setError(data?.error ?? `Refetch failed (${res.status})`)
      return
    }
    setRefetchDiffs(data.diffs ?? [])
    // pull fresh fetched values into local state
    for (const diff of data.diffs ?? []) {
      setLocal(diff.field, { fetchedValue: diff.current })
    }
    if (data.priceError) {
      setError(`Fundamentals updated, but the current price couldn't be fetched: ${data.priceError}`)
    }
    // Pull the freshly stored price snapshot into the page so Current Price
    // and Margin of Safety update without a manual reload.
    router.refresh()
  }

  // Linear growth fade: year 1 = current Y1 growth, year 5 = terminal growth,
  // years 2–4 evenly interpolated. Persists all five as overrides.
  async function applyFade() {
    const startRaw = effectiveValue(inputs['fcfGrowthY1'] ?? { fetchedValue: null, manualValue: null })
    const endRaw = effectiveValue(inputs['terminalGrowth'] ?? { fetchedValue: null, manualValue: null })
    const start = startRaw !== null ? Number(startRaw) : NaN
    const end = endRaw !== null ? Number(endRaw) : NaN
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('Set Year-1 growth and Terminal growth first — fade fills years 2–5 between them.')
      return
    }
    setFading(true)
    setError(null)
    const step = (end - start) / 4
    for (let y = 1; y <= 5; y++) {
      const value = start + step * (y - 1)
      const field = `fcfGrowthY${y}`
      setLocal(field, { manualValue: String(value) })
      const ok = await persistField(field, value)
      if (!ok) break
    }
    setFading(false)
  }

  // Ask the AI to estimate the judgment assumptions (growth path, terminal,
  // WACC components, relative benchmarks) and write them as overrides. Fetched
  // fundamentals are left untouched; the result is a starting point to verify.
  async function applyAiFill() {
    setAiFilling(true)
    setError(null)
    setAiNote(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}/inputs/ai`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    setAiFilling(false)
    if (!res.ok) {
      setError(data?.error ?? `AI fill failed (${res.status})`)
      return
    }
    for (const { field, manualValue } of (data.applied ?? []) as Array<{ field: string; manualValue: string }>) {
      setLocal(field, { manualValue })
      setDrafts((d) => {
        const next = { ...d }
        delete next[field]
        return next
      })
    }
    setAiNote(
      data.rationale
        ? `AI estimate (verify before trusting): ${data.rationale}`
        : 'AI filled all inputs — a starting point to review and adjust.',
    )
  }

  async function deleteAnalysis() {
    if (!confirm(`Delete analysis "${title}" for ${asset.ticker}? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/invest/analyses/${analysis.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `Delete failed (${res.status})`)
      setDeleting(false)
      return
    }
    router.push('/invest/analysis')
    router.refresh()
  }

  function fieldRow(def: FieldDef) {
    const input = inputs[def.key]
    if (!input) return null
    const isOverridden = input.manualValue !== null && input.fetchedValue !== null
    const isFetched = input.manualValue === null && input.fetchedValue !== null
    const diff = refetchDiffs.find((d) => d.field === def.key)
    const hasProblem = problemFields.has(def.key)
    const draft = drafts[def.key]

    // The discount rate has no fetched value: with no manual override it
    // auto-derives from the WACC (or CAPM). Show that derived value in the box,
    // faded, and offer a reset back to it when the user has typed an override.
    const isDiscount = def.key === 'discountRate'
    const discountAuto = isDiscount && input.manualValue === null
    const discountOverride = isDiscount && input.manualValue !== null
    const autoValue = discountAuto ? computed.effectiveDiscountRate : null
    const discountLabel =
      computed.discountRateSource === 'wacc'
        ? 'auto · WACC'
        : computed.discountRateSource === 'capm'
          ? 'auto · cost of equity'
          : 'auto'

    const fetchedDelta =
      isOverridden && Number(input.fetchedValue) !== 0
        ? (Number(input.manualValue) - Number(input.fetchedValue)) /
          Math.abs(Number(input.fetchedValue))
        : null

    return (
      <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="fin-field-label" htmlFor={`field-${def.key}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
          {def.label}
          {def.hint && <InfoHint text={def.hint} />}
          {isFetched && <Database size={11} aria-label="value from API" className="fin-subtle" />}
          {(isOverridden || discountOverride) && <span className="fin-badge fin-badge-gold" style={{ fontSize: 9, padding: '0 6px' }}>override</span>}
          {discountAuto && <span className="fin-badge" style={{ fontSize: 9, padding: '0 6px' }}>{discountLabel}</span>}
          {diff && diff.changePct !== null && (
            <span className="fin-badge fin-badge-warn" style={{ fontSize: 9, padding: '0 6px' }}>
              fetched changed by {formatPercentSigned(diff.changePct)}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id={`field-${def.key}`}
            type="text"
            inputMode="decimal"
            className="fin-input fin-mono"
            style={{
              ...(isOverridden || discountOverride
                ? { borderColor: 'var(--fin-gold-border)', fontWeight: 700 }
                : {}),
              ...(isFetched || discountAuto ? { color: 'var(--fin-text-2)' } : {}),
              ...(hasProblem ? { borderColor: 'var(--fin-loss-border)' } : {}),
            }}
            value={
              draft !== undefined
                ? draft
                : toEditor(def, discountAuto ? autoValue : effectiveValue(input), fxFactor)
            }
            placeholder={def.format === 'percent' ? '% p.a.' : '—'}
            onChange={(e) => setDrafts((d) => ({ ...d, [def.key]: e.target.value }))}
            onBlur={() => void commitDraft(def)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={saving === def.key}
          />
          {def.format === 'percent' && <span className="fin-subtle" style={{ fontSize: 12 }}>%</span>}
          {(isOverridden || discountOverride) && (
            <button
              type="button"
              className="fin-btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              title={discountOverride ? 'Reset to auto (WACC)' : 'Reset to fetched value'}
              onClick={() => void resetField(def)}
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
        {isOverridden && (
          <div className="fin-subtle" style={{ fontSize: 11 }}>
            <s>{formatByDef(def, input.fetchedValue, asset.currency, fxFactor)}</s>
            {fetchedDelta !== null && (
              <span className="fin-gold"> {formatPercentSigned(fetchedDelta)} vs. fetched</span>
            )}
          </div>
        )}
        {discountAuto && (
          <div className="fin-subtle" style={{ fontSize: 11 }}>
            {computed.discountRateSource === 'wacc'
              ? 'Following the computed WACC. Type a value to override.'
              : computed.discountRateSource === 'capm'
                ? 'Following the CAPM cost of equity (no debt inputs yet for a full WACC). Type to override.'
                : 'Enter WACC components below, or type a discount rate.'}
          </div>
        )}
        {def.help && !isOverridden && !isDiscount && (
          <div className="fin-subtle" style={{ fontSize: 11 }}>{def.help}</div>
        )}
        {(def.key === 'peBenchmark' || def.key === 'evEbitdaBenchmark') && (
          <input
            type="text"
            className="fin-input"
            style={{ fontSize: 12 }}
            placeholder="Note — where the number comes from"
            defaultValue={input.note ?? ''}
            onBlur={(e) => void saveNote(def, e.target.value.trim())}
          />
        )}
      </div>
    )
  }

  const price = currentPrice !== null ? Number(currentPrice) : null
  const target = targetMos !== null ? Number(targetMos) : null
  const mos = computed.marginOfSafety !== null ? Number(computed.marginOfSafety) : null

  const mosClass =
    mos === null
      ? 'fin-muted'
      : target !== null && mos >= target
        ? 'fin-gain'
        : mos > 0
          ? 'fin-warn'
          : 'fin-loss'

  // ── Blended read ──
  const blended = computed.blendedFairValue !== null ? Number(computed.blendedFairValue) : null
  const low = computed.fairValueLow !== null ? Number(computed.fairValueLow) : null
  const high = computed.fairValueHigh !== null ? Number(computed.fairValueHigh) : null
  const spread = computed.methodSpread !== null ? Number(computed.methodSpread) : null
  const blendedMos = computed.blendedMarginOfSafety !== null ? Number(computed.blendedMarginOfSafety) : null
  const agreement =
    spread === null || computed.methodCount < 2
      ? null
      : spread < 0.15
        ? { label: 'methods agree', cls: 'fin-gain' }
        : spread < 0.35
          ? { label: 'moderate spread', cls: 'fin-warn' }
          : { label: 'wide spread — assumptions dominate', cls: 'fin-loss' }
  const blendedMosClass =
    blendedMos === null
      ? 'fin-muted'
      : target !== null && blendedMos >= target
        ? 'fin-gain'
        : blendedMos > 0
          ? 'fin-warn'
          : 'fin-loss'

  const group = (name: FieldDef['group']) => FIELD_DEFS.filter((d) => d.group === name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div className="fin-card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="fin-input"
          style={{ maxWidth: 340, fontWeight: 600 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== analysis.title && void patchAnalysis({ title })}
          aria-label="Analysis name"
        />
        <select
          className="fin-select"
          style={{ width: 'auto' }}
          value={status}
          onChange={(e) => {
            const next = e.target.value as typeof status
            setStatus(next)
            void patchAnalysis({ status: next })
          }}
          aria-label="Analysis status"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {fundamentalsFetchedAt && (
            <span className="fin-subtle" style={{ fontSize: 11 }}>
              fundamentals: {new Date(fundamentalsFetchedAt).toLocaleDateString('en-US')}
            </span>
          )}
          <button type="button" className="fin-btn" onClick={() => void refetch()} disabled={refetching}>
            {refetching ? 'Fetching…' : 'Refresh data & price'}
          </button>
          <button
            type="button"
            className="fin-btn"
            style={{ borderColor: 'var(--fin-loss-border)', color: 'var(--fin-loss)' }}
            onClick={() => void deleteAnalysis()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete analysis'}
          </button>
        </span>
      </div>

      {error && <p className="fin-loss" style={{ margin: 0, fontSize: 13 }}>{error}</p>}

      {/* ── Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Fair value (DCF)
            <InfoHint text="What one share is worth per the discounted-cash-flow model: present value of 5 years of FCF plus terminal value, minus net debt, divided by shares. Your intrinsic-value estimate to compare against the market price." />
          </div>
          <div className="fin-value-lg fin-gold" style={{ fontSize: 28 }}>
            {computed.fairValue ? displayMoney(computed.fairValue, asset.currency, fxFactor) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Implied (P/E)
            <InfoHint text="A second, independent value estimate: sector P/E benchmark × EPS. If it disagrees a lot with the DCF, revisit your assumptions." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromPe ? displayMoney(computed.impliedFromPe, asset.currency, fxFactor) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Implied (EV/EBITDA)
            <InfoHint text="A third value estimate: (sector EV/EBITDA × EBITDA − net debt) ÷ shares. Cross-check the DCF and P/E — three methods agreeing is a stronger signal." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {computed.impliedFromEvEbitda ? displayMoney(computed.impliedFromEvEbitda, asset.currency, fxFactor) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Current price
            <InfoHint text="The latest market price from the daily price snapshot. Shows “—” until a price has been fetched (or set manually) for this asset." />
          </div>
          <div className="fin-value-lg" style={{ fontSize: 28 }}>
            {price !== null ? displayMoney(price, asset.currency, fxFactor) : '—'}
          </div>
        </div>
        <div className="fin-card">
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Margin of safety{target !== null && <> · target {formatPercent(target)}</>}
            <InfoHint text="(Fair value − price) ÷ fair value. How far below intrinsic value the stock trades. Positive = trading below fair value (cushion); negative = above. The bigger the buffer, the more room for error in your assumptions." />
          </div>
          <div className={`fin-value-lg ${mosClass}`} style={{ fontSize: 28 }}>
            {mos !== null ? formatPercentSigned(mos) : '—'}
          </div>
        </div>
      </div>

      {/* ── Blended fair value ── */}
      {blended !== null && low !== null && high !== null && (
        <div className="fin-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div className="fin-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Blended fair value
              <InfoHint text="Equal-weighted average of the methods that produced a value (DCF, P/E, EV/EBITDA). No single method is authoritative — the DCF is an intrinsic estimate, the multiples are relative to the sector — so read the band and how tightly they agree, not one number. The margin of safety here is against the blend." />
            </div>
            <div className="fin-value-lg fin-gold" style={{ fontSize: 30, lineHeight: 1 }}>
              {displayMoney(blended, asset.currency, fxFactor)}
            </div>
            <span className={`fin-mono ${blendedMosClass}`} style={{ fontSize: 14 }}>
              {blendedMos !== null ? `MoS ${formatPercentSigned(blendedMos)}` : ''}
            </span>
            {agreement && (
              <span className={`fin-badge ${agreement.cls === 'fin-gain' ? 'fin-badge-gold' : ''}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
                <span className={agreement.cls}>{agreement.label}</span>
                {spread !== null && <> · ±{formatPercent(spread / 2, 0)}</>}
              </span>
            )}
          </div>
          <MethodRange
            currency={asset.currency}
            fxFactor={fxFactor}
            dcf={computed.fairValue !== null ? Number(computed.fairValue) : null}
            pe={computed.impliedFromPe !== null ? Number(computed.impliedFromPe) : null}
            ev={computed.impliedFromEvEbitda !== null ? Number(computed.impliedFromEvEbitda) : null}
            blended={blended}
            low={low}
            high={high}
            price={price}
          />
        </div>
      )}

      {fxFactor !== 1 && dataCurrency && (
        <p className="fin-subtle" style={{ margin: '-6px 0 0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          Shown in {asset.currency} — fetched data is in {dataCurrency}, converted at{' '}
          <span className="fin-mono">{formatNumber(fxFactor, 4)}</span> {asset.currency}/{dataCurrency}.
          <InfoHint text="Finnhub reports this stock's price and fundamentals in its listing currency. They're converted to the asset's display currency at the latest CNB fixing so the figures aren't shown under the wrong symbol. Ratios like margin of safety are unaffected by the conversion." />
        </p>
      )}

      {computed.problems.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8 }}>Missing for fair value calculation</div>
          <ul className="fin-warn" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {computed.problems.map((p, i) => (
              <li key={i}>
                {p.field ? `${FIELD_DEFS.find((d) => d.key === p.field)?.label ?? p.field}: ` : ''}
                {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {computed.warnings.length > 0 && (
        <div className="fin-card" style={{ borderColor: 'var(--fin-warn-border)' }}>
          <div className="fin-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Sanity check
            <InfoHint text="These don't block the calculation, but the numbers look inconsistent — most often FCF, net debt and total debt entered in different scales (absolute vs. millions). They must all be in the same units." />
          </div>
          <ul className="fin-warn" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {computed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── DCF inputs ── */}
      <div className="fin-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="fin-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            DCF — inputs (FCFF, 5 years + terminal)
            <InfoHint text="Projects free cash flow for 5 years, then a perpetual terminal value, discounts both to today at the discount rate (mid-year convention — cash arrives through the year, not on Dec 31), subtracts net debt, and divides by shares. Most of the value usually sits in the terminal value — so the discount rate and terminal growth matter most." />
          </div>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="fin-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => void applyAiFill()}
              disabled={aiFilling}
            >
              {aiFilling ? 'AI filling…' : 'Fill with AI'}
              <InfoHint text="Asks the AI to fill EVERY input for this ticker — fundamentals (FCF, net debt, shares, beta, EPS, EBITDA), the FCF growth path, terminal growth, WACC components and the sector P/E and EV/EBITDA benchmarks — as overrides. Where the data API already supplied a fundamental, the AI reuses that exact value; the rest it estimates. The model can't see live filings, so treat the result as a starting point to verify, not advice." />
            </button>
            <button
              type="button"
              className="fin-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => void applyFade()}
              disabled={fading}
            >
              {fading ? 'Fading…' : 'Fade to terminal'}
              <InfoHint text="Fills years 1–5 by linearly stepping from your Year-1 growth down to the terminal growth. More realistic than holding one high growth rate flat for 5 years. You can still fine-tune any single year afterwards." />
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('dcf').map(fieldRow)}
        </div>
        {aiNote && (
          <p className="fin-subtle" style={{ margin: '12px 0 0', fontSize: 12 }}>{aiNote}</p>
        )}
      </div>

      {/* ── WACC helper ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          Discount-rate helper (WACC)
          <InfoHint text="Builds the discount rate for the DCF. Cost of equity = risk-free + beta × equity risk premium (CAPM). WACC then blends that with the after-tax cost of debt, weighted by market cap vs. total debt. For an FCFF model, WACC is the correct rate — use it, not the cost of equity alone." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('wacc').map(fieldRow)}
        </div>
        {/* Result + action in their own footer row, right-aligned */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 20,
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid var(--fin-border-strong, rgba(255,255,255,0.08))',
            flexWrap: 'wrap',
          }}
        >
          <span className="fin-subtle" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            Cost of equity
            <InfoHint text="rf + beta × ERP. The return equity investors require. It’s the equity leg of the WACC — with no debt, WACC equals this." />
            ={' '}
            <span className="fin-mono">
              {computed.capmRate ? formatPercent(computed.capmRate) : '—'}
            </span>
          </span>
          <span className="fin-subtle" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            WACC
            <InfoHint text="E/V × cost of equity + D/V × cost of debt × (1 − tax). Needs cost of debt, tax rate, total debt, shares and the current price. Falls back to cost of equity if those aren’t all set." />
            ={' '}
            <span className="fin-mono fin-gold">
              {computed.wacc ? formatPercent(computed.wacc) : '—'}
            </span>
          </span>
          {inputs['discountRate']?.manualValue != null ? (
            <button
              type="button"
              className="fin-btn"
              title="Clear the manual discount so the DCF follows the WACC automatically"
              onClick={() => {
                setLocal('discountRate', { manualValue: null })
                void persistField('discountRate', null)
              }}
            >
              Reset discount to auto (WACC)
            </button>
          ) : (
            <span className="fin-subtle" style={{ fontSize: 12 }}>
              Discount rate follows the {computed.discountRateSource === 'capm' ? 'cost of equity' : 'WACC'} automatically
            </span>
          )}
        </div>
      </div>

      {/* ── Relative valuation ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 16 }}>Relative valuation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {group('relative').map(fieldRow)}
        </div>
      </div>

      {/* ── Sensitivity ── */}
      <div className="fin-card" style={{ overflowX: 'auto' }}>
        <div className="fin-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          Sensitivity — fair value per share
          <InfoHint text="Fair value at nearby discount rates and terminal growth rates. The gold-outlined cell is your base case. Green = meets your target margin of safety at the current price; red = fair value below the current price. Shows how fragile the result is to the two assumptions that matter most." />
        </div>
        {computed.sensitivity ? (
          <table className="fin-table" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th
                  colSpan={computed.sensitivity[0].length}
                  style={{
                    textAlign: 'center',
                    color: 'var(--fin-gold)',
                    fontWeight: 600,
                    fontSize: 11,
                    letterSpacing: 0.3,
                    paddingBottom: 2,
                    border: 'none',
                  }}
                >
                  Terminal growth →
                </th>
              </tr>
              <tr>
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                <th aria-hidden style={{ border: 'none', background: 'transparent' }} />
                {computed.sensitivity[0].map((cell) => (
                  <th key={cell.terminalGrowth} className="fin-num">
                    {formatPercent(cell.terminalGrowth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.sensitivity.map((row, rowIndex) => (
                <tr key={row[0].discountRate}>
                  {rowIndex === 0 && (
                    <th
                      rowSpan={computed.sensitivity!.length}
                      style={{
                        writingMode: 'vertical-rl',
                        textAlign: 'center',
                        color: 'var(--fin-gold)',
                        fontWeight: 600,
                        fontSize: 11,
                        letterSpacing: 0.3,
                        whiteSpace: 'nowrap',
                        padding: '0 4px',
                        border: 'none',
                        background: 'transparent',
                      }}
                    >
                      Discount rate (WACC) ↓
                    </th>
                  )}
                  <td className="fin-num fin-muted">{formatPercent(row[0].discountRate)}</td>
                  {row.map((cell) => {
                    const fv = cell.fairValue !== null ? Number(cell.fairValue) : null
                    const cellMos = fv !== null && price !== null && fv > 0 ? (fv - price) / fv : null
                    const background =
                      fv === null
                        ? undefined
                        : target !== null && cellMos !== null && cellMos >= target
                          ? 'var(--fin-gain-bg)'
                          : price !== null && fv < price
                            ? 'var(--fin-loss-bg)'
                            : undefined
                    return (
                      <td
                        key={cell.terminalGrowth}
                        className="fin-num"
                        style={{
                          background,
                          ...(cell.isBase
                            ? {
                                outline: '1px solid var(--fin-gold)',
                                outlineOffset: -1,
                                color: 'var(--fin-gold)',
                                fontWeight: 700,
                              }
                            : {}),
                        }}
                      >
                        {fv !== null ? formatNumber(fv * fxFactor, 1) : '×'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="fin-empty">The table appears once the DCF is complete.</div>
        )}
      </div>

      {/* ── Qualitative notes ── */}
      <div className="fin-card">
        <div className="fin-label" style={{ marginBottom: 12 }}>
          Qualitative notes (moat, management, risks — markdown)
        </div>
        <textarea
          className="fin-input"
          style={{ minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== analysis.qualitativeNotes && void patchAnalysis({ qualitativeNotes: notes })}
        />
      </div>
    </div>
  )
}
