'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'
import { Utensils } from 'lucide-react'

interface Props {
  userId: string
  weekStart: string
}

export default function MealPlanStarter({ userId, weekStart }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/meals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, weekStart }),
      })
      if (!res.ok) throw new Error('Failed')
      router.refresh()
    } catch {
      setError('Failed to generate meal plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card animate-entrance" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ marginBottom: 16, color: '#6E6E73', display: 'flex', justifyContent: 'center' }}><Utensils size={40} /></div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F7', marginBottom: 8 }}>No meal plan for this week</h2>
      <p style={{ fontSize: 14, color: '#A1A1A6', marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
        Generate a personalized meal plan based on your fitness goals, food preferences, and protein targets.
      </p>
      {error && <div style={{ fontSize: 12, color: '#ff8168', marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Spinner size={24} color="#a085ff" strokeWidth={2.5} />
          <span style={{ fontSize: 13, color: '#a085ff', fontWeight: 600 }}>Generating your meal plan…</span>
          <span style={{ fontSize: 12, color: '#6E6E73' }}>Building recipes, macros & shopping list</span>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="btn-motion"
          style={{
            background: 'rgba(160, 133, 255,0.15)',
            border: '1px solid rgba(160, 133, 255,0.3)',
            color: '#a085ff', borderRadius: 8, padding: '12px 28px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Generate Meal Plan
        </button>
      )}
    </div>
  )
}
