'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateInvestment, type PropertyInputs, type Financing } from '@/lib/reality/calc'
import { DEFAULT_INPUTS } from '@/lib/reality/defaults'
import { formatCZK, formatPct } from '@/lib/reality/format'
import ProjectionChart from './ProjectionChart'

interface Props {
  id?: string
  initialTitle?: string
  initialAddress?: string
  initialInputs?: PropertyInputs
}

type NumericKey = Exclude<keyof PropertyInputs, 'financing'>

// ── Malé pole s číselným vstupem a příponou (Kč, %, let…) ──
function Field({
  label, value, onChange, suffix, step = 1, wide = false, min,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  wide?: boolean
  min?: number
}) {
  return (
    <div className={`re-field${wide ? ' re-col-2' : ''}`}>
      <label>{label}</label>
      <div className="re-input-wrap">
        <input
          className="re-input"
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          onChange={(e) => {
            const v = e.target.value === '' ? 0 : Number(e.target.value)
            onChange(Number.isFinite(v) ? v : 0)
          }}
          onFocus={(e) => e.target.select()}
        />
        {suffix && <span className="re-suffix">{suffix}</span>}
      </div>
    </div>
  )
}

function Metric({
  label, value, sub, tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'pos' | 'neg' | 'gold'
}) {
  const cls = tone === 'pos' ? 're-pos' : tone === 'neg' ? 're-neg' : tone === 'gold' ? 're-gold' : ''
  return (
    <div className="re-metric">
      <div className="re-metric-label">{label}</div>
      <div className={`re-metric-value ${cls}`}>{value}</div>
      {sub && <div className="re-metric-sub">{sub}</div>}
    </div>
  )
}

export default function Calculator({ id, initialTitle, initialAddress, initialInputs }: Props) {
  const router = useRouter()
  const [inputs, setInputs] = useState<PropertyInputs>(initialInputs ?? DEFAULT_INPUTS)
  const [title, setTitle] = useState(initialTitle ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const result = useMemo(() => calculateInvestment(inputs), [inputs])
  const isMortgage = inputs.financing === 'mortgage'

  const set = (key: NumericKey) => (v: number) => setInputs((p) => ({ ...p, [key]: v }))
  const setFinancing = (f: Financing) => setInputs((p) => ({ ...p, financing: f }))

  async function save() {
    if (!title.trim()) { setError('Zadej název analýzy (např. „Byt 2+kk, Brno-Žabovřesky").'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(id ? `/api/reality/${id}` : '/api/reality', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), address: address.trim() || null, inputs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Uložení selhalo')
      if (id) {
        setSavedAt(Date.now())
        router.refresh()
      } else {
        router.push(`/reality/${data.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id || !confirm('Opravdu smazat tuto analýzu?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/reality/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Smazání selhalo')
      router.push('/reality')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Smazání selhalo')
      setDeleting(false)
    }
  }

  const cf = result.monthlyPreTaxCashFlow
  const czk0 = (n: number) => formatCZK(n)

  return (
    <div className="re-grid">
      {/* ══ FORMULÁŘ ══ */}
      <div className="fin-card">
        {/* Název + adresa */}
        <div className="re-section">
          <div className="re-fields">
            <div className="re-field re-col-2">
              <label>Název analýzy</label>
              <div className="re-input-wrap">
                <input
                  className="re-input re-text"
                  placeholder="Byt 2+kk, Brno-Žabovřesky"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="re-field re-col-2">
              <label>Adresa / poznámka <span style={{ opacity: 0.5 }}>(nepovinné)</span></label>
              <div className="re-input-wrap">
                <input
                  className="re-input re-text"
                  placeholder="Minská 12"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pořízení */}
        <div className="re-section">
          <h3 className="re-section-title">Pořízení</h3>
          <div className="re-fields">
            <Field label="Kupní cena" value={inputs.purchasePrice} onChange={set('purchasePrice')} suffix="Kč" step={50000} min={0} />
            <Field label="Vedlejší náklady" value={inputs.acquisitionCosts} onChange={set('acquisitionCosts')} suffix="Kč" step={10000} min={0} />
            <Field label="Rekonstrukce" value={inputs.renovationCosts} onChange={set('renovationCosts')} suffix="Kč" step={10000} min={0} />
          </div>
          <p className="re-note">Vedlejší náklady = provize RK, právník, kolky, případná daň z nabytí.</p>
        </div>

        {/* Financování */}
        <div className="re-section">
          <h3 className="re-section-title">Financování</h3>
          <div className="re-toggle" style={{ marginBottom: isMortgage ? 12 : 0 }}>
            <button className={isMortgage ? 'active' : ''} onClick={() => setFinancing('mortgage')} type="button">Hypotéka</button>
            <button className={!isMortgage ? 'active' : ''} onClick={() => setFinancing('cash')} type="button">Za hotové</button>
          </div>
          {isMortgage && (
            <div className="re-fields">
              <Field label="Akontace" value={inputs.downPaymentPct} onChange={set('downPaymentPct')} suffix="%" step={5} min={0} />
              <Field label="Úroková sazba" value={inputs.interestRate} onChange={set('interestRate')} suffix="% p.a." step={0.1} min={0} />
              <Field label="Splatnost" value={inputs.loanTermYears} onChange={set('loanTermYears')} suffix="let" step={1} min={1} />
            </div>
          )}
        </div>

        {/* Příjmy */}
        <div className="re-section">
          <h3 className="re-section-title">Příjmy</h3>
          <div className="re-fields">
            <Field label="Měsíční nájem" value={inputs.monthlyRent} onChange={set('monthlyRent')} suffix="Kč" step={500} min={0} />
            <Field label="Ostatní příjmy" value={inputs.otherMonthlyIncome} onChange={set('otherMonthlyIncome')} suffix="Kč/měs" step={500} min={0} />
            <Field label="Neobsazenost" value={inputs.vacancyPct} onChange={set('vacancyPct')} suffix="%" step={1} min={0} />
          </div>
        </div>

        {/* Provozní náklady */}
        <div className="re-section">
          <h3 className="re-section-title">Provozní náklady</h3>
          <div className="re-fields">
            <Field label="SVJ / fond oprav" value={inputs.hoaMonthly} onChange={set('hoaMonthly')} suffix="Kč/měs" step={100} min={0} />
            <Field label="Daň z nemovitosti" value={inputs.propertyTaxYearly} onChange={set('propertyTaxYearly')} suffix="Kč/rok" step={100} min={0} />
            <Field label="Pojištění" value={inputs.insuranceYearly} onChange={set('insuranceYearly')} suffix="Kč/rok" step={100} min={0} />
            <Field label="Správa" value={inputs.managementPct} onChange={set('managementPct')} suffix="% z nájmu" step={1} min={0} />
            <Field label="Údržba / rezerva" value={inputs.maintenancePct} onChange={set('maintenancePct')} suffix="% z nájmu" step={1} min={0} />
          </div>
          <p className="re-note">Energie a služby obvykle platí nájemník, proto zde nejsou. Údržba je roční rezerva na opravy.</p>
        </div>

        {/* Předpoklady vývoje */}
        <div className="re-section">
          <h3 className="re-section-title">Předpoklady vývoje</h3>
          <div className="re-fields">
            <Field label="Zhodnocení nemovitosti" value={inputs.appreciationPct} onChange={set('appreciationPct')} suffix="% / rok" step={0.5} />
            <Field label="Růst nájmu a nákladů" value={inputs.rentGrowthPct} onChange={set('rentGrowthPct')} suffix="% / rok" step={0.5} />
            <Field label="Daň z příjmu z nájmu" value={inputs.incomeTaxPct} onChange={set('incomeTaxPct')} suffix="%" step={1} min={0} />
            <Field label="Horizont" value={inputs.horizonYears} onChange={set('horizonYears')} suffix="let" step={1} min={1} />
          </div>
        </div>
      </div>

      {/* ══ VÝSLEDKY ══ */}
      <div className="re-results">
        {/* Verdikt */}
        <div className={`re-verdict ${result.verdict.rating}`}>
          <p className="re-verdict-label">{result.verdict.label}</p>
          <p className="re-verdict-summary">{result.verdict.summary}</p>
          <ul className="re-reasons">
            {result.verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* Klíčové ukazatele */}
        <div className="fin-card" style={{ padding: 18 }}>
          <div className="re-metrics">
            <Metric
              label="Měsíční cash flow"
              value={czk0(cf)}
              sub="před zdaněním, po splátce"
              tone={cf >= 0 ? 'pos' : 'neg'}
            />
            <Metric label="Čistý výnos (cap rate)" value={formatPct(result.netYield)} sub="NOI / pořizovací cena" tone="gold" />
            <Metric label="Cash-on-cash" value={formatPct(result.cashOnCash)} sub="výnos vloženého kapitálu" tone={result.cashOnCash >= 0 ? undefined : 'neg'} />
            <Metric label="Hrubý výnos" value={formatPct(result.grossYield)} sub="roční nájem / cena" />
            <Metric label="Celkový výnos p.a." value={formatPct(result.annualizedReturnPct)} sub={`IRR za ${inputs.horizonYears} let vč. prodeje`} tone={result.annualizedReturnPct >= 0 ? 'pos' : 'neg'} />
            {isMortgage
              ? <Metric label="DSCR" value={result.dscr !== null ? result.dscr.toFixed(2) : '—'} sub="krytí dluhové služby" tone={result.dscr !== null && result.dscr >= 1 ? 'pos' : 'neg'} />
              : <Metric label="Návratnost" value={result.paybackYears !== null ? `${result.paybackYears.toFixed(1)} let` : '—'} sub="z cash flow po zdanění" />}
          </div>
        </div>

        {/* Pořízení + rozpad */}
        <div className="fin-card" style={{ padding: 18 }}>
          <div className="re-breakdown">
            <div className="re-row"><span className="re-k">Celkové pořizovací náklady</span><span className="re-v">{czk0(result.totalAcquisitionCost)}</span></div>
            <div className="re-row"><span className="re-k">Vlastní kapitál (vloženo)</span><span className="re-v re-gold">{czk0(result.totalCashInvested)}</span></div>
            {isMortgage && <div className="re-row"><span className="re-k">Výše úvěru · LTV</span><span className="re-v">{czk0(result.loanAmount)} · {formatPct(result.ltv, 0)}</span></div>}
            {isMortgage && <div className="re-row"><span className="re-k">Měsíční splátka hypotéky</span><span className="re-v">{czk0(result.monthlyMortgage)}</span></div>}
          </div>

          <div style={{ height: 14 }} />
          <div className="re-section-title" style={{ margin: '0 0 4px' }}>Roční cash flow (1. rok)</div>
          <div className="re-breakdown">
            <div className="re-row"><span className="re-k">Efektivní nájem (po neobsazenosti)</span><span className="re-v">{czk0(result.effectiveAnnualRent)}</span></div>
            <div className="re-row"><span className="re-k">− Provozní náklady</span><span className="re-v">−{czk0(result.annualOperatingExpenses)}</span></div>
            <div className="re-row"><span className="re-k">= NOI (provozní zisk)</span><span className="re-v">{czk0(result.noi)}</span></div>
            {isMortgage && <div className="re-row"><span className="re-k">− Splátky úvěru</span><span className="re-v">−{czk0(result.annualDebtService)}</span></div>}
            <div className="re-row re-total"><span className="re-k">Cash flow před zdaněním</span><span className={`re-v ${result.annualPreTaxCashFlow >= 0 ? 're-pos' : 're-neg'}`}>{czk0(result.annualPreTaxCashFlow)}</span></div>
            <div className="re-row"><span className="re-k">Po zdanění příjmu z nájmu</span><span className={`re-v ${result.annualAfterTaxCashFlow >= 0 ? 're-pos' : 're-neg'}`}>{czk0(result.annualAfterTaxCashFlow)}</span></div>
          </div>
          <p className="re-note">Break-even nájem (nulový cash flow): <strong style={{ color: 'var(--fin-text-2)' }}>{czk0(result.breakEvenRent)}/měs</strong>.</p>
        </div>

        {/* Graf projekce */}
        <div className="fin-card" style={{ padding: 18 }}>
          <div className="re-section-title" style={{ margin: '0 0 10px' }}>Vývoj za {inputs.horizonYears} let</div>
          <ProjectionChart projection={result.projection} />

          <details className="re-details" style={{ marginTop: 12 }}>
            <summary>Zobrazit tabulku po letech</summary>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table className="re-proj-table">
                <thead>
                  <tr>
                    <th>Rok</th>
                    <th>Hodnota</th>
                    <th>Úvěr</th>
                    <th>Kapitál</th>
                    <th>Cash flow</th>
                    <th>Kum. CF</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projection.map((p) => (
                    <tr key={p.year}>
                      <td>{p.year}.</td>
                      <td>{formatCZK(p.propertyValue)}</td>
                      <td>{formatCZK(p.loanBalance)}</td>
                      <td>{formatCZK(p.equity)}</td>
                      <td style={{ color: p.afterTaxCashFlow >= 0 ? 'var(--mint-text)' : 'var(--red-text)' }}>{formatCZK(p.afterTaxCashFlow)}</td>
                      <td>{formatCZK(p.cumulativeCashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {/* Akce */}
        <div className="fin-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div className="fin-warn" style={{ fontSize: 13 }}>{error}</div>}
          {savedAt && !error && <div style={{ fontSize: 13, color: 'var(--mint-text)' }}>Uloženo ✓</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="fin-btn fin-btn-primary" onClick={save} disabled={saving} type="button">
              {saving ? 'Ukládám…' : id ? 'Uložit změny' : 'Uložit analýzu'}
            </button>
            {id && (
              <button className="fin-btn" onClick={remove} disabled={deleting} type="button" style={{ color: 'var(--red-text)' }}>
                {deleting ? 'Mažu…' : 'Smazat'}
              </button>
            )}
          </div>
          <p className="re-note" style={{ margin: 0 }}>
            Orientační propočet, ne investiční doporučení. Předpoklady (růst, neobsazenost, daně) si ověř podle konkrétní situace.
          </p>
        </div>
      </div>
    </div>
  )
}
