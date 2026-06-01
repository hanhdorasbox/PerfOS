'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CareerCapitalEval = {
  id: string
  goalId: string
  increasesCapital: boolean
  howExactly?: string | null
  newAsset?: string | null
  reusabilityScore: number
  leveragePotential?: string | null
  proofAttached: boolean
}

type Goal = {
  id: string
  title: string
  category: string
  careerCapitalEval: CareerCapitalEval | null
}

function ReusabilityDots({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: i <= value ? '#B8A4FF' : 'rgba(184,164,255,0.2)',
          }}
        />
      ))}
    </div>
  )
}

function EvalForm({
  goalId,
  initial,
  onDone,
}: {
  goalId: string
  initial?: Partial<CareerCapitalEval>
  onDone: () => void
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    increasesCapital: initial?.increasesCapital ?? true,
    howExactly: initial?.howExactly ?? '',
    newAsset: initial?.newAsset ?? '',
    reusabilityScore: initial?.reusabilityScore ?? 3,
    leveragePotential: initial?.leveragePotential ?? '',
    proofAttached: initial?.proofAttached ?? false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/career/eval/${goalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onDone()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 14,
        marginTop: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A1A1A6', fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.increasesCapital}
          onChange={e => setForm(f => ({ ...f, increasesCapital: e.target.checked }))}
          style={{ accentColor: '#7FD5AA' }}
        />
        Increases Career Capital
      </label>
      <textarea
        placeholder="How exactly does this build capital?"
        value={form.howExactly}
        onChange={e => setForm(f => ({ ...f, howExactly: e.target.value }))}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      <input
        placeholder="New asset created (optional)"
        value={form.newAsset}
        onChange={e => setForm(f => ({ ...f, newAsset: e.target.value }))}
        style={inputStyle}
      />
      <div>
        <label style={{ color: '#A1A1A6', fontSize: 12, display: 'block', marginBottom: 4 }}>
          Reusability Score: {form.reusabilityScore}/5
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={form.reusabilityScore}
          onChange={e => setForm(f => ({ ...f, reusabilityScore: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: '#B8A4FF' }}
        />
      </div>
      <input
        placeholder="Leverage potential (optional)"
        value={form.leveragePotential}
        onChange={e => setForm(f => ({ ...f, leveragePotential: e.target.value }))}
        style={inputStyle}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A1A1A6', fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.proofAttached}
          onChange={e => setForm(f => ({ ...f, proofAttached: e.target.checked }))}
          style={{ accentColor: '#7FD5AA' }}
        />
        Proof of Work attached
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: '#B8A4FF',
            border: 'none',
            borderRadius: 7,
            color: '#1A1916',
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Saving…' : 'Save Eval'}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            color: '#6E6E73',
            padding: '7px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function GoalEvalCard({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false)
  const ev = goal.careerCapitalEval

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ color: '#F5F5F7', fontSize: 14, fontWeight: 600 }}>{goal.title}</div>
          <div style={{ color: '#6E6E73', fontSize: 11, marginTop: 2 }}>{goal.category}</div>
        </div>
        {ev ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ev.increasesCapital ? (
              <span
                style={{
                  background: 'rgba(127,213,170,0.15)',
                  border: '1px solid rgba(127,213,170,0.3)',
                  color: '#7FD5AA',
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Builds Capital ✓
              </span>
            ) : (
              <span
                style={{
                  background: 'rgba(236,198,102,0.12)',
                  border: '1px solid rgba(236,198,102,0.3)',
                  color: '#ECC666',
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Low Capital Impact
              </span>
            )}
            <button
              onClick={() => setEditing(v => !v)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#A1A1A6',
                padding: '3px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(v => !v)}
            style={{
              background: 'rgba(184,164,255,0.12)',
              border: '1px solid rgba(184,164,255,0.3)',
              borderRadius: 6,
              color: '#B8A4FF',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Eval
          </button>
        )}
      </div>

      {ev && !editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ev.howExactly && (
            <div style={{ color: '#A1A1A6', fontSize: 12 }}>{ev.howExactly}</div>
          )}
          {ev.newAsset && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#6E6E73', fontSize: 11, flexShrink: 0, marginTop: 1 }}>New asset:</span>
              <span style={{ color: '#A1A1A6', fontSize: 12 }}>{ev.newAsset}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6E6E73', fontSize: 11 }}>Reusability:</span>
            <ReusabilityDots value={ev.reusabilityScore} />
          </div>
          {ev.leveragePotential && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#6E6E73', fontSize: 11, flexShrink: 0, marginTop: 1 }}>Leverage:</span>
              <span style={{ color: '#A1A1A6', fontSize: 12 }}>{ev.leveragePotential}</span>
            </div>
          )}
          {!ev.proofAttached && ev.increasesCapital && (
            <div
              style={{
                background: 'rgba(236,198,102,0.10)',
                border: '1px solid rgba(236,198,102,0.25)',
                borderRadius: 7,
                padding: '7px 12px',
                color: '#ECC666',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              No proof-of-work attached — add a deliverable or this goal&apos;s value remains weak
            </div>
          )}
        </div>
      )}

      {!ev && !editing && (
        <div style={{ color: '#6E6E73', fontSize: 12, fontStyle: 'italic' }}>Not evaluated yet.</div>
      )}

      {editing && (
        <EvalForm
          goalId={goal.id}
          initial={ev ?? undefined}
          onDone={() => setEditing(false)}
        />
      )}
    </div>
  )
}

export default function GoalCapitalEvals({ goals }: { goals: Goal[] }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', margin: '0 0 16px 0' }}>
        Goal Capital Evaluations
      </h2>
      {goals.length === 0 ? (
        <div style={{ color: '#6E6E73', fontSize: 13 }}>No goals in the active quarter.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map(goal => (
            <GoalEvalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  color: '#F5F5F7',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}
