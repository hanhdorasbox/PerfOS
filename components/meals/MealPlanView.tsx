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
  recipe?: string | null
}

interface RecipeIngredient { name: string; amount: number; unit: string }

interface MealRecipe {
  cuisine?: string
  flavorProfile?: string
  prepMinutes?: number
  cookMinutes?: number
  portions?: number
  ingredients: RecipeIngredient[]
  steps: string[]
}

function parseRecipe(raw: string | null | undefined): MealRecipe | null {
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as MealRecipe
    if (!Array.isArray(r.ingredients) || !Array.isArray(r.steps)) return null
    return r
  } catch { return null }
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
  const [recipeMeal, setRecipeMeal] = useState<PlannedMeal | null>(null)

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

  // Recipe for a meal — batch repeats carry recipe: null, so fall back to the
  // first occurrence of the same title that has one.
  function resolveRecipe(meal: PlannedMeal): MealRecipe | null {
    const own = parseRecipe(meal.recipe)
    if (own) return own
    const source = plan.meals.find(m => m.title === meal.title && m.recipe)
    return source ? parseRecipe(source.recipe) : null
  }

  const openRecipeData = recipeMeal ? resolveRecipe(recipeMeal) : null

  return (
    <div>
      {/* Recipe modal */}
      {recipeMeal && openRecipeData && (
        <RecipeModal
          meal={recipeMeal}
          recipe={openRecipeData}
          userId={userId}
          onClose={() => setRecipeMeal(null)}
        />
      )}

      {/* Header actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7' }}>
              Week of {new Date(plan.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 12, color: '#A1A1A6', marginTop: 4 }}>
              {plan.targetCalories && `${plan.targetCalories} kcal target`}
              {plan.targetProtein && ` · ${plan.targetProtein}g protein`}
              {' · '}
              <span style={{
                textTransform: 'capitalize',
                color: plan.status === 'approved' ? '#7FD5AA' : '#ECC666',
              }}>
                {plan.status}
              </span>
            </div>
            {plan.aiNotes && <div style={{ fontSize: 12, color: '#A1A1A6', marginTop: 6, fontStyle: 'italic' }}>{plan.aiNotes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {plan.status === 'draft' && (
              <>
                <button
                  onClick={approve}
                  disabled={approving}
                  style={{ background: 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.3)', color: '#7FD5AA', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {approving ? 'Approving...' : 'Approve Plan'}
                </button>
                <button
                  onClick={() => regenerate()}
                  disabled={regenerating}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A1A1A6', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </>
            )}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#FF9B87', marginTop: 8 }}>{error}</div>}
      </div>

      {/* 7-day meal grid */}
      <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', marginBottom: 16 }}>This Week&apos;s Meals</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 8 }}>
          {DAYS.map((day, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A1A1A6', marginBottom: 8, textAlign: 'center' }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {BREAKFAST_DAYS.has(i) && (
                  <MealCard meal={getMeal(i, 'breakfast')} type="breakfast" feedback={getMeal(i, 'breakfast') ? getMealFeedback(getMeal(i, 'breakfast')!.title) : undefined} onFeedback={sendFeedback} onOpenRecipe={(m) => resolveRecipe(m) && setRecipeMeal(m)} hasRecipe={(m) => resolveRecipe(m) != null} />
                )}
                <MealCard meal={getMeal(i, 'lunch')} type="lunch" feedback={getMeal(i, 'lunch') ? getMealFeedback(getMeal(i, 'lunch')!.title) : undefined} onFeedback={sendFeedback} onOpenRecipe={(m) => resolveRecipe(m) && setRecipeMeal(m)} hasRecipe={(m) => resolveRecipe(m) != null} />
                <MealCard meal={getMeal(i, 'dinner')} type="dinner" feedback={getMeal(i, 'dinner') ? getMealFeedback(getMeal(i, 'dinner')!.title) : undefined} onFeedback={sendFeedback} onOpenRecipe={(m) => resolveRecipe(m) && setRecipeMeal(m)} hasRecipe={(m) => resolveRecipe(m) != null} />
              </div>
              {plan.status === 'draft' && (
                <button
                  onClick={() => regenerate(i)}
                  style={{ width: '100%', marginTop: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px', fontSize: 11, color: '#A1A1A6', cursor: 'pointer' }}
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7', marginBottom: 12 }}>Batch Cooking</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {batchCooking.map((batch: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(128,189,255,0.08)', border: '1px solid rgba(128,189,255,0.15)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{batch.meal}</span>
                  <span style={{ fontSize: 11, color: '#80BDFF' }}>{batch.portions}x · Cook {batch.cookDay}</span>
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
                        <li key={si} style={{ fontSize: 12, color: '#A1A1A6', lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <div style={{ fontSize: 12, color: '#A1A1A6', marginTop: 4 }}>{raw}</div>
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
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7' }}>Shopping List</h2>
            <span style={{ fontSize: 12, color: '#A1A1A6' }}>{showShopping ? '▲ collapse' : '▼ expand'}</span>
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#B8A4FF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Buy {group.buyDay}</span>
                        {group.reason && <span style={{ fontSize: 11, color: '#6E6E73', marginLeft: 8 }}>— {group.reason}</span>}
                      </div>
                      <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {(group.items || []).map((item, ii) => (
                          <div key={ii} style={{ fontSize: 13, color: '#A1A1A6', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ color: '#7FD5AA', flexShrink: 0 }}>□</span>
                            <span>{item.item}{item.quantity ? ` — ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Old flat format fallback
                <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(shoppingList as Array<{ item: string; quantity?: string; unit?: string }>).map((item, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#A1A1A6', padding: '4px 0', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#7FD5AA', flexShrink: 0 }}>□</span>
                      <span>{item.item}</span>
                      {item.quantity && <span style={{ color: '#A1A1A6' }}>— {item.quantity} {item.unit}</span>}
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

function MealCard({ meal, type, feedback, onFeedback, onOpenRecipe, hasRecipe }: {
  meal?: PlannedMeal
  type: string
  feedback?: MealFeedback
  onFeedback: (title: string, liked: boolean) => void
  onOpenRecipe?: (meal: PlannedMeal) => void
  hasRecipe?: (meal: PlannedMeal) => boolean
}) {
  const typeColors: Record<string, string> = { breakfast: '#B8A4FF', lunch: '#80BDFF', dinner: '#7FD5AA' }
  const color = typeColors[type] || '#A1A1A6'

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
      <div style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{meal.title}</div>
      <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#A1A1A6', flexWrap: 'wrap' }}>
        {meal.calories && <span>{meal.calories}kcal</span>}
        {meal.protein && <span>{meal.protein}g pro</span>}
        {meal.isRepeated && <span style={{ color: '#80BDFF' }}>batch</span>}
      </div>
      {onOpenRecipe && hasRecipe?.(meal) && (
        <button
          onClick={() => onOpenRecipe(meal)}
          style={{
            marginTop: 5, width: '100%', textAlign: 'left',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 10, color: '#B8A4FF', fontWeight: 600,
          }}
        >
          Recipe →
        </button>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button
          onClick={() => onFeedback(meal.title, true)}
          style={{
            background: feedback?.liked === true ? 'rgba(127,213,170,0.2)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#7FD5AA',
          }}
        >
          ↑
        </button>
        <button
          onClick={() => onFeedback(meal.title, false)}
          style={{
            background: feedback?.liked === false ? 'rgba(255,155,135,0.2)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#FF9B87',
          }}
        >
          ↓
        </button>
      </div>
    </div>
  )
}

// ─── Recipe modal ─────────────────────────────────────────────────────────────

function RecipeModal({ meal, recipe, userId, onClose }: {
  meal: PlannedMeal
  recipe: MealRecipe
  userId: string
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveToLibrary() {
    setSaving(true)
    try {
      const res = await fetch('/api/meals/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: meal.title,
          mealType: meal.mealType,
          description: [recipe.cuisine, recipe.flavorProfile].filter(Boolean).join(' · ') || meal.description || null,
          prepMinutes: recipe.prepMinutes ?? null,
          cookMinutes: recipe.cookMinutes ?? null,
          portions: recipe.portions ?? 1,
          tags: recipe.cuisine ? [recipe.cuisine] : [],
          ingredients: recipe.ingredients.map(ing => ({ name: ing.name, amount: ing.amount, unit: ing.unit })),
          steps: recipe.steps.map(instruction => ({ instruction })),
        }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const meta = [
    recipe.cuisine,
    recipe.flavorProfile,
    recipe.prepMinutes != null ? `prep ${recipe.prepMinutes} min` : null,
    recipe.cookMinutes != null ? `cook ${recipe.cookMinutes} min` : null,
    recipe.portions != null ? `${recipe.portions} portions` : null,
  ].filter(Boolean)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,4,6,0.86)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: 28, maxWidth: 560, width: '100%', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#52525A', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>
              {meal.mealType}{meal.calories ? ` · ${meal.calories} kcal` : ''}{meal.protein ? ` · ${meal.protein}g protein` : ''}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#EEEEF2', letterSpacing: '-0.02em' }}>{meal.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#6E6E76', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '7px 10px', borderRadius: 10, flexShrink: 0 }}>✕</button>
        </div>

        {meta.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {meta.map((m, i) => (
              <span key={i} style={{ fontSize: 10, color: '#9E9EA6', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '3px 10px' }}>
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Ingredients */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 8 }}>
          Ingredients
        </div>
        <div style={{ marginBottom: 18, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px' }}>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: i < recipe.ingredients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 13, color: '#D4D4D8' }}>{ing.name}</span>
              <span style={{ fontSize: 12, color: '#9E9EA6', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {ing.amount} {ing.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E76', marginBottom: 8 }}>
          Method
        </div>
        <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {recipe.steps.map((step, i) => (
            <li key={i} style={{ fontSize: 13, color: '#9E9EA6', lineHeight: 1.6 }}>{step}</li>
          ))}
        </ol>

        <button
          onClick={saveToLibrary}
          disabled={saving || saved}
          style={{
            width: '100%', padding: '9px 16px', borderRadius: 10, cursor: saved ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600,
            background: saved ? 'rgba(127,213,170,0.10)' : 'rgba(184,164,255,0.10)',
            border: `1px solid ${saved ? 'rgba(127,213,170,0.25)' : 'rgba(184,164,255,0.25)'}`,
            color: saved ? '#7FD5AA' : '#B8A4FF',
          }}
        >
          {saved ? '✓ Saved to recipe library' : saving ? 'Saving…' : 'Save to recipe library'}
        </button>
      </div>
    </div>
  )
}
