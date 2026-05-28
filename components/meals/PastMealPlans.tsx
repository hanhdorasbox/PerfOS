'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PastPlan {
  id: string
  weekStart: string
  targetCalories: number | null
  targetProtein: number | null
  mealCount: number
}

export default function PastMealPlans({ plans: initPlans }: { plans: PastPlan[] }) {
  const router = useRouter()
  const [plans, setPlans] = useState<PastPlan[]>(initPlans)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (plans.length === 0) return null

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this meal plan? This cannot be undone.')) return
    setDeleting(id)
    setError('')
    try {
      const res = await fetch(`/api/meals/plans/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error || 'Delete failed')
      }
      setPlans(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setTimeout(() => setError(''), 4000)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#A1A1A6', marginBottom: 12 }}>
        Past Approved Plans
      </div>

      {error && (
        <div style={{ background: 'rgba(255,180,168,0.1)', border: '1px solid rgba(255,180,168,0.2)', color: '#FFB4A8', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plans.map(plan => (
          <div
            key={plan.id}
            className="card"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: deleting === plan.id ? 0.4 : 1, transition: 'opacity 0.15s ease',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F7', marginBottom: 4 }}>
                Week of {new Date(plan.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: '#A1A1A6' }}>
                {plan.mealCount} meals
                {plan.targetCalories ? ` · ${plan.targetCalories} kcal` : ''}
                {plan.targetProtein ? ` · ${plan.targetProtein}g protein` : ''}
              </div>
            </div>
            <button
              onClick={() => deletePlan(plan.id)}
              disabled={deleting === plan.id}
              style={{
                background: 'none',
                border: '1px solid rgba(255,180,168,0.2)',
                color: '#FFB4A8',
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {deleting === plan.id ? '…' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
