'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PlannedMeal {
  id: string
  mealPlanId: string
  dayOfWeek: number
  mealType: string
  title: string
  description?: string | null
  calories?: number | null
  protein?: number | null
  isRepeated: boolean
  isFavorite: boolean
  notes?: string | null
}

interface MealFeedback {
  id: string
  mealTitle: string
  liked: boolean
  notes?: string | null
  createdAt: string
}

interface MealPlan {
  id: string
  userId: string
  weekStart: string
  status: string
  targetCalories?: number | null
  targetProtein?: number | null
  shoppingList?: string | null
  batchCooking?: string | null
  aiNotes?: string | null
  meals: PlannedMeal[]
  feedback: MealFeedback[]
}

interface Props {
  plan: MealPlan
  userId: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BREAKFAST_DAYS = new Set([1, 3, 5, 6]) // Tue, Thu, Sat, Sun

export default function MealPlanView({ plan, userId }: Props) {
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showShopping, setShowShopping] = useState(false)
  const [error, setError] = useState('')

  const shoppingList = (() => { try { return JSON.parse(plan.shoppingList || '[]') } catch { return [] } })()
  const batchCooking = (() => { try { return JSON.parse(plan.batchCooking || '[]') } catch { return [] } })()

  async function approve() {
    setApproving(true)
    try {
      await fetch(`/api/meals/plans/${plan.id}/approve`, { method: 'PATCH' })
      router.refresh()
    } finally {
      setApproving(false)
    }
  }

  async function regenerate(dayOfWeek?: number) {
    setRegenerating(true)
    setError('')
    try {
      const res = await fetch('/api/meals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, weekStart: plan.weekStart, constraints: dayOfWeek != null ? { dayOfWeek } : undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      router.refresh()
    } catch {
      setError('Failed to regenerate.')
    } finally {
      setRegenerating(false)
    }
  }

  async function sendFeedback(mealTitle: string, liked: boolean) {
    await fetch('/api/meals/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealPlanId: plan.id, mealTitle, liked }),
    })
    router.refresh()
  }

  function getMeal(day: number, type: string) {
    return plan.meals.find(m => m.dayOfWeek === day && m.mealType === type)
  }

  function getMealFeedback(title: string) {
    return plan.feedback.find(f => f.mealTitle === title)
  }

  return (
    <div>
      {/* Header actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA' }}>
              Week of {new Date(plan.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 12, color: '#B8B6B0', marginTop: 4 }}>
              {plan.targetCalories && `${plan.targetCalories} kcal target`}
              {plan.targetProtein && ` · ${plan.targetProtein}g protein`}
              {' · '}
              <span style={{
                textTransform: 'capitalize',
                color: plan.status === 'approved' ? '#6BE3A4' : '#F2C063',
              }}>
                {plan.status}
              </span>
            </div>
            {plan.aiNotes && <div style={{ fontSize: 12, color: '#B8B6B0', marginTop: 6, fontStyle: 'italic' }}>{plan.aiNotes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {plan.status === 'draft' && (
              <>
                <button
                  onClick={approve}
                  disabled={approving}
                  style={{ background: 'rgba(107,227,164,0.15)', border: '1px solid rgba(107,227,164,0.3)', color: '#6BE3A4', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {approving ? 'Approving...' : 'Approve Plan'}
                </button>
                <button
                  onClick={() => regenerate()}
                  disabled={regenerating}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#B8B6B0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </>
            )}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#FF6B6B', marginTop: 8 }}>{error}</div>}
      </div>

      {/* 7-day meal grid */}
      <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 16 }}>This Week&apos;s Meals</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 8 }}>
          {DAYS.map((day, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B8B6B0', marginBottom: 8, textAlign: 'center' }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {BREAKFAST_DAYS.has(i) && (
                  <MealCard meal={getMeal(i, 'breakfast')} type="breakfast" feedback={getMeal(i, 'breakfast') ? getMealFeedback(getMeal(i, 'breakfast')!.title) : undefined} onFeedback={sendFeedback} />
                )}
                <MealCard meal={getMeal(i, 'lunch')} type="lunch" feedback={getMeal(i, 'lunch') ? getMealFeedback(getMeal(i, 'lunch')!.title) : undefined} onFeedback={sendFeedback} />
                <MealCard meal={getMeal(i, 'dinner')} type="dinner" feedback={getMeal(i, 'dinner') ? getMealFeedback(getMeal(i, 'dinner')!.title) : undefined} onFeedback={sendFeedback} />
              </div>
              {plan.status === 'draft' && (
                <button
                  onClick={() => regenerate(i)}
                  style={{ width: '100%', marginTop: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px', fontSize: 11, color: '#B8B6B0', cursor: 'pointer' }}
                >
                  ↻ redo day
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Batch Cooking */}
      {batchCooking.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA', marginBottom: 12 }}>Batch Cooking</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {batchCooking.map((batch: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#FAFAFA' }}>{batch.meal}</span>
                  <span style={{ fontSize: 11, color: '#60A5FA' }}>{batch.portions}x · Cook {batch.cookDay}</span>
                </div>
                {batch.instructions && (() => {
                  // Parse "1. Step one. 2. Step two." into individual numbered steps
                  const steps: string[] = []
                  const raw: string = batch.instructions
                  // Try splitting on "N. " patterns
                  const parts = raw.split(/(?=\b\d+\.\s)/).map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
                  if (parts.length > 1) {
                    steps.push(...parts)
                  } else {
                    // Fallback: split on ". " sentences
                    raw.split(/\.\s+/).forEach((s: string) => { if (s.trim()) steps.push(s.trim().replace(/\.$/, '')) })
                  }
                  return steps.length > 1 ? (
                    <ol style={{ margin: '6px 0 0', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {steps.map((step, si) => (
                        <li key={si} style={{ fontSize: 12, color: '#B8B6B0', lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <div style={{ fontSize: 12, color: '#B8B6B0', marginTop: 4 }}>{raw}</div>
                  )
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {shoppingList.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowShopping(!showShopping)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: 0 }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FAFAFA' }}>Shopping List</h2>
            <span style={{ fontSize: 12, color: '#B8B6B0' }}>{showShopping ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {showShopping && (
            <div style={{ marginTop: 12 }}>
              {/* Detect format: grouped (has buyDay) vs flat (has item at root) */}
              {shoppingList[0]?.buyDay ? (
                // New grouped format
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(shoppingList as Array<{ buyDay: string; reason?: string; items: Array<{ item: string; quantity?: string; unit?: string }> }>).map((group, gi) => (
                    <div key={gi}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#B4A7E5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Buy {group.buyDay}</span>
                        {group.reason && <span style={{ fontSize: 11, color: '#76746E', marginLeft: 8 }}>— {group.reason}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {(group.items || []).map((item, ii) => (
                          <div key={ii} style={{ fontSize: 13, color: '#B8B6B0', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ color: '#6BE3A4', flexShrink: 0 }}>□</span>
                            <span>{item.item}{item.quantity ? ` — ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Old flat format fallback
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(shoppingList as Array<{ item: string; quantity?: string; unit?: string }>).map((item, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#B8B6B0', padding: '4px 0', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#6BE3A4', flexShrink: 0 }}>□</span>
                      <span>{item.item}</span>
                      {item.quantity && <span style={{ color: '#B8B6B0' }}>— {item.quantity} {item.unit}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MealCard({ meal, type, feedback, onFeedback }: {
  meal?: PlannedMeal
  type: string
  feedback?: MealFeedback
  onFeedback: (title: string, liked: boolean) => void
}) {
  const typeColors: Record<string, string> = { breakfast: '#B4A7E5', lunch: '#60A5FA', dinner: '#6BE3A4' }
  const color = typeColors[type] || '#B8B6B0'

  if (!meal) {
    return (
      <div style={{
        padding: '8px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: '1px dashed rgba(255,255,255,0.06)',
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>{type}</span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 8,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>{type}</div>
      <div style={{ fontSize: 12, color: '#FAFAFA', fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{meal.title}</div>
      <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#B8B6B0', flexWrap: 'wrap' }}>
        {meal.calories && <span>{meal.calories}kcal</span>}
        {meal.protein && <span>{meal.protein}g pro</span>}
        {meal.isRepeated && <span style={{ color: '#60A5FA' }}>batch</span>}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button
          onClick={() => onFeedback(meal.title, true)}
          style={{
            background: feedback?.liked === true ? 'rgba(107,227,164,0.2)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#6BE3A4',
          }}
        >
          ↑
        </button>
        <button
          onClick={() => onFeedback(meal.title, false)}
          style={{
            background: feedback?.liked === false ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#FF6B6B',
          }}
        >
          ↓
        </button>
      </div>
    </div>
  )
}
