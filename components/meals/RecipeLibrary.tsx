'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ThumbsUp, ThumbsDown, Utensils, Archive } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  id?: string
  name: string; amount: number; unit: string
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null
  brand?: string | null
}
interface Step { id?: string; instruction: string }
interface Recipe {
  id: string; name: string; mealType: string; description: string | null
  prepMinutes: number | null; cookMinutes: number | null; portions: number
  difficulty: string | null; tags: string | null; notes: string | null
  liked: boolean | null; storageDays: number | null; isMealPrep: boolean; status: string
  totalCalories: number | null; totalProtein: number | null
  totalCarbs: number | null; totalFat: number | null; totalFiber: number | null
  usageCount: number; createdAt: string
  ingredients: Ingredient[]; steps: Step[]
}
interface DbIngredient { name: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; unit: string; category: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  { value: 'breakfast',   label: 'Breakfast' },
  { value: 'lunch',       label: 'Lunch' },
  { value: 'dinner',      label: 'Dinner' },
  { value: 'snack',       label: 'Snack' },
  { value: 'pre_workout', label: 'Pre-workout' },
  { value: 'post_workout',label: 'Post-workout' },
  { value: 'meal_prep',   label: 'Meal prep' },
  { value: 'other',       label: 'Other' },
]

const UNITS = ['g', 'ml', 'piece', 'tbsp', 'tsp', 'cup', 'handful', 'slice', 'scoop']

const emptyIngredient = (): Ingredient => ({ name: '', amount: 100, unit: 'g', calories: null, protein: null, carbs: null, fat: null, fiber: null })
const emptyStep = (): Step => ({ instruction: '' })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTotals(ingredients: Ingredient[]) {
  return ingredients.reduce((acc, ing) => ({
    kcal: acc.kcal + (ing.calories ?? 0),
    protein: acc.protein + (ing.protein ?? 0),
    carbs: acc.carbs + (ing.carbs ?? 0),
    fat: acc.fat + (ing.fat ?? 0),
    fiber: acc.fiber + (ing.fiber ?? 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
}

function perPortion(total: number, portions: number) {
  return portions > 0 ? Math.round((total / portions) * 10) / 10 : total
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try { return JSON.parse(tags) } catch { return [] }
}

function getMealTypeLabel(type: string) { return MEAL_TYPES.find(t => t.value === type)?.label ?? type }

// ─── Macro pill ───────────────────────────────────────────────────────────────
function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99, background: `${color}14`, border: `1px solid ${color}30`, fontSize: 11, color }}>
      <strong>{Math.round(value)}</strong>
      <span style={{ opacity: 0.7, fontSize: 10 }}>{label}</span>
    </span>
  )
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onView, onEdit, onDelete }: {
  recipe: Recipe
  onView: () => void; onEdit: () => void; onDelete: () => void
}) {
  const tags = parseTags(recipe.tags)
  const totalMin = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
  const kcalPP = recipe.totalCalories != null ? perPortion(recipe.totalCalories, recipe.portions) : null
  const protPP = recipe.totalProtein != null ? perPortion(recipe.totalProtein, recipe.portions) : null
  const carbPP = recipe.totalCarbs != null ? perPortion(recipe.totalCarbs, recipe.portions) : null
  const fatPP = recipe.totalFat != null ? perPortion(recipe.totalFat, recipe.portions) : null

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F7', marginBottom: 2, lineHeight: 1.3 }}>{recipe.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#6E6E73' }}>{getMealTypeLabel(recipe.mealType)}</span>
            {recipe.isMealPrep && <span style={{ fontSize: 10, color: '#B8A4FF', background: 'rgba(184,164,255,0.1)', border: '1px solid rgba(184,164,255,0.2)', borderRadius: 4, padding: '1px 6px' }}>Meal prep</span>}
            {totalMin > 0 && <span style={{ fontSize: 10, color: '#6E6E73' }}>• {totalMin} min</span>}
            {recipe.portions > 1 && <span style={{ fontSize: 10, color: '#6E6E73' }}>• {recipe.portions} portions</span>}
          </div>
        </div>
        {recipe.liked === true && <ThumbsUp size={13} color="#7FD5AA" />}
        {recipe.liked === false && <ThumbsDown size={13} color="#FF9B87" />}
      </div>

      {/* Macros per portion */}
      {kcalPP != null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <MacroPill label="kcal" value={kcalPP} color="#ECC666" />
          {protPP != null && <MacroPill label="P" value={protPP} color="#7FD5AA" />}
          {carbPP != null && <MacroPill label="C" value={carbPP} color="#80BDFF" />}
          {fatPP != null && <MacroPill label="F" value={fatPP} color="#F5A56A" />}
          {recipe.portions > 1 && <span style={{ fontSize: 10, color: '#6E6E73', alignSelf: 'center' }}>per portion</span>}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 10, color: '#6E6E73', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 6px' }}>{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={onView} style={btnStyle('#A1A1A6')}>View</button>
        <button onClick={onEdit} style={btnStyle('#80BDFF')}>Edit</button>
        <button onClick={onDelete} style={{ ...btnStyle('#FF9B87'), marginLeft: 'auto' }}>Archive</button>
      </div>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return { fontSize: 11, color, background: 'none', border: `1px solid ${color}30`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }
}

// ─── Ingredient Row ───────────────────────────────────────────────────────────
function IngredientRow({ ing, index, onChange, onRemove }: {
  ing: Ingredient; index: number
  onChange: (idx: number, field: keyof Ingredient, value: string | number | null) => void
  onRemove: (idx: number) => void
}) {
  const [suggestions, setSuggestions] = useState<DbIngredient[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNameChange = (val: string) => {
    onChange(index, 'name', val)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (val.length < 2) { setSuggestions([]); return }
      const res = await fetch(`/api/meals/ingredients?q=${encodeURIComponent(val)}`)
      const data = await res.json() as DbIngredient[]
      setSuggestions(data)
      setShowSuggestions(true)
    }, 250)
  }

  const applyIngredient = (db: DbIngredient) => {
    const factor = (ing.amount || 100) / 100
    onChange(index, 'name', db.name)
    onChange(index, 'unit', db.unit)
    onChange(index, 'calories', Math.round(db.kcal * factor * 10) / 10)
    onChange(index, 'protein', Math.round(db.protein * factor * 10) / 10)
    onChange(index, 'carbs', Math.round(db.carbs * factor * 10) / 10)
    onChange(index, 'fat', Math.round(db.fat * factor * 10) / 10)
    onChange(index, 'fiber', Math.round(db.fiber * factor * 10) / 10)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleAmountChange = (val: number) => {
    onChange(index, 'amount', val)
    // Recalculate macros if they were auto-populated (using ratio from current per-100g)
    // We don't store the per-100g values, so just scale if current amount was set
    // This is a simple proportional update
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    color: '#F5F5F7', fontSize: 12, padding: '5px 8px', outline: 'none', width: '100%',
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 60px 60px 60px 60px 60px 28px', gap: 4, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <input
            value={ing.name}
            onChange={e => handleNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Ingredient name"
            style={inputStyle}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1A1916', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: 200, overflowY: 'auto' }}>
              {suggestions.map(s => (
                <div key={s.name} onClick={() => applyIngredient(s)} style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: '#A1A1A6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(127,213,170,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ color: '#F5F5F7' }}>{s.name}</span>
                  <span style={{ color: '#6E6E73', marginLeft: 8, fontSize: 11 }}>{s.kcal} kcal · {s.protein}g P / 100{s.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <input type="number" value={ing.amount} onChange={e => handleAmountChange(parseFloat(e.target.value) || 0)} style={inputStyle} min={0} step={0.5} />
        <select value={ing.unit} onChange={e => onChange(index, 'unit', e.target.value)} style={{ ...inputStyle, padding: '5px 4px' }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <input type="number" value={ing.calories ?? ''} onChange={e => onChange(index, 'calories', e.target.value ? parseFloat(e.target.value) : null)} placeholder="kcal" style={inputStyle} min={0} />
        <input type="number" value={ing.protein ?? ''} onChange={e => onChange(index, 'protein', e.target.value ? parseFloat(e.target.value) : null)} placeholder="P" style={inputStyle} min={0} />
        <input type="number" value={ing.carbs ?? ''} onChange={e => onChange(index, 'carbs', e.target.value ? parseFloat(e.target.value) : null)} placeholder="C" style={inputStyle} min={0} />
        <input type="number" value={ing.fat ?? ''} onChange={e => onChange(index, 'fat', e.target.value ? parseFloat(e.target.value) : null)} placeholder="F" style={inputStyle} min={0} />
        <button onClick={() => onRemove(index)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,155,135,0.1)', border: '1px solid rgba(255,155,135,0.2)', color: '#FF9B87', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
      </div>
    </div>
  )
}

// ─── Recipe Form ──────────────────────────────────────────────────────────────
function RecipeForm({ initial, userId, onSave, onCancel }: {
  initial?: Recipe
  userId: string
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [mealType, setMealType] = useState(initial?.mealType ?? 'lunch')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes?.toString() ?? '')
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes?.toString() ?? '')
  const [portions, setPortions] = useState(initial?.portions?.toString() ?? '1')
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(parseTags(initial?.tags ?? null))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [liked, setLiked] = useState<boolean | null>(initial?.liked ?? null)
  const [storageDays, setStorageDays] = useState(initial?.storageDays?.toString() ?? '')
  const [isMealPrep, setIsMealPrep] = useState(initial?.isMealPrep ?? false)
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial?.ingredients.length ? initial.ingredients : [emptyIngredient()])
  const [steps, setSteps] = useState<Step[]>(initial?.steps.length ? initial.steps : [emptyStep()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totals = calcTotals(ingredients)
  const p = parseInt(portions) || 1

  const updateIngredient = useCallback((idx: number, field: keyof Ingredient, value: string | number | null) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing))
  }, [])
  const removeIngredient = useCallback((idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx)), [])
  const addIngredient = () => setIngredients(prev => [...prev, emptyIngredient()])
  const updateStep = (idx: number, val: string) => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, instruction: val } : s))
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx))
  const addStep = () => setSteps(prev => [...prev, emptyStep()])
  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const handleSave = async () => {
    if (!name.trim() || !mealType) { setError('Name and meal type are required'); return }
    setSaving(true); setError('')
    try {
      const body = {
        userId, name, mealType, description: description || null,
        prepMinutes: prepMinutes ? parseInt(prepMinutes) : null,
        cookMinutes: cookMinutes ? parseInt(cookMinutes) : null,
        portions: parseInt(portions) || 1,
        difficulty: difficulty || null, tags, notes: notes || null, liked,
        storageDays: storageDays ? parseInt(storageDays) : null, isMealPrep,
        ingredients: ingredients.filter(i => i.name.trim()),
        steps: steps.filter(s => s.instruction.trim()),
      }
      let res
      if (initial) {
        res = await fetch(`/api/meals/recipes/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/meals/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? 'Save failed') }
      const saved = await res.json() as Recipe
      onSave(saved)
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F5F5F7', fontSize: 13, padding: '8px 12px', width: '100%', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F7', margin: 0 }}>{initial ? 'Edit Recipe' : 'New Recipe'}</h3>
        <button onClick={onCancel} style={{ fontSize: 12, color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Cancel</button>
      </div>

      {error && <div style={{ background: 'rgba(255,155,135,0.1)', border: '1px solid rgba(255,155,135,0.3)', borderRadius: 8, padding: '8px 12px', color: '#FF9B87', fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {/* Basic info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Recipe name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Rice Bowl" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Meal type *</label>
          <select value={mealType} onChange={e => setMealType(e.target.value)} style={{ ...inputStyle }}>
            {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={{ ...inputStyle }}>
            <option value="">Not set</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Portions</label>
          <input type="number" value={portions} onChange={e => setPortions(e.target.value)} min={1} style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={labelStyle}>Prep (min)</label><input type="number" value={prepMinutes} onChange={e => setPrepMinutes(e.target.value)} placeholder="15" min={0} style={inputStyle} /></div>
          <div><label style={labelStyle}>Cook (min)</label><input type="number" value={cookMinutes} onChange={e => setCookMinutes(e.target.value)} placeholder="20" min={0} style={inputStyle} /></div>
        </div>
        <div>
          <label style={labelStyle}>Storage (days)</label>
          <input type="number" value={storageDays} onChange={e => setStorageDays(e.target.value)} placeholder="3" min={0} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {/* Flags */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#A1A1A6' }}>
          <input type="checkbox" checked={isMealPrep} onChange={e => setIsMealPrep(e.target.checked)} />
          Good for meal prep
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#A1A1A6' }}>
          <span>Like?</span>
          <button onClick={() => setLiked(liked === true ? null : true)} style={{ background: liked === true ? 'rgba(127,213,170,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${liked === true ? 'rgba(127,213,170,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}><ThumbsUp size={12} /></button>
          <button onClick={() => setLiked(liked === false ? null : false)} style={{ background: liked === false ? 'rgba(255,155,135,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${liked === false ? 'rgba(255,155,135,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}><ThumbsDown size={12} /></button>
        </div>
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Tags</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {tags.map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)', borderRadius: 99, padding: '2px 8px', fontSize: 12, color: '#7FD5AA' }}>
              {t} <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#7FD5AA', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 10 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag (press Enter)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addTag} style={{ padding: '8px 14px', background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.25)', borderRadius: 8, color: '#7FD5AA', cursor: 'pointer', fontSize: 12 }}>Add</button>
        </div>
      </div>

      {/* Ingredients */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={labelStyle}>Ingredients</label>
          {totals.kcal > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <MacroPill label="kcal" value={perPortion(totals.kcal, p)} color="#ECC666" />
              <MacroPill label="P" value={perPortion(totals.protein, p)} color="#7FD5AA" />
              <MacroPill label="C" value={perPortion(totals.carbs, p)} color="#80BDFF" />
              <MacroPill label="F" value={perPortion(totals.fat, p)} color="#F5A56A" />
              {p > 1 && <span style={{ fontSize: 10, color: '#6E6E73', alignSelf: 'center' }}>/ portion</span>}
            </div>
          )}
        </div>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 60px 60px 60px 60px 60px 28px', gap: 4, marginBottom: 6 }}>
          {['Ingredient', 'Amount', 'Unit', 'kcal', 'P (g)', 'C (g)', 'F (g)', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: '#6E6E73', fontWeight: 700, textAlign: i > 2 ? 'center' as const : 'left' as const }}>{h}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ingredients.map((ing, i) => (
            <IngredientRow key={i} ing={ing} index={i} onChange={updateIngredient} onRemove={removeIngredient} />
          ))}
        </div>
        <button onClick={addIngredient} style={{ marginTop: 8, fontSize: 12, color: '#7FD5AA', background: 'rgba(127,213,170,0.06)', border: '1px dashed rgba(127,213,170,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', width: '100%' }}>
          + Add ingredient
        </button>
      </div>

      {/* Steps */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Preparation steps</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', minWidth: 18, paddingTop: 9 }}>{i + 1}.</span>
              <textarea
                value={s.instruction}
                onChange={e => updateStep(i, e.target.value)}
                placeholder={`Step ${i + 1}…`}
                rows={1}
                style={{ ...inputStyle, flex: 1, resize: 'vertical', minHeight: 36 }}
              />
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)} style={{ marginTop: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,155,135,0.08)', border: '1px solid rgba(255,155,135,0.15)', color: '#FF9B87', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addStep} style={{ marginTop: 8, fontSize: 12, color: '#B8A4FF', background: 'rgba(184,164,255,0.06)', border: '1px dashed rgba(184,164,255,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', width: '100%' }}>
          + Add step
        </button>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Notes / Meal prep notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Storage tips, substitutions, meal prep instructions…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#6E6E73', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px 20px', background: saving ? 'rgba(127,213,170,0.1)' : 'rgba(127,213,170,0.15)', border: '1px solid rgba(127,213,170,0.3)', borderRadius: 8, color: '#7FD5AA', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create recipe'}
        </button>
      </div>
    </div>
  )
}

// ─── Recipe Detail ────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onEdit, onBack }: { recipe: Recipe; onEdit: () => void; onBack: () => void }) {
  const totals = calcTotals(recipe.ingredients)
  const p = recipe.portions
  const tags = parseTags(recipe.tags)
  const totalMin = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <button onClick={onBack} style={{ fontSize: 12, color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>← Back</button>
        <button onClick={onEdit} style={{ fontSize: 12, color: '#80BDFF', background: 'rgba(125,200,247,0.08)', border: '1px solid rgba(125,200,247,0.2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Edit</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F5F5F7', margin: '0 0 6px' }}>{recipe.name}</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6E6E73' }}>{getMealTypeLabel(recipe.mealType)}</span>
          {totalMin > 0 && <span style={{ fontSize: 12, color: '#6E6E73' }}>{totalMin} min</span>}
          {p > 1 && <span style={{ fontSize: 12, color: '#6E6E73', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Utensils size={11} />{p} portions</span>}
          {recipe.difficulty && <span style={{ fontSize: 11, color: '#B8A4FF', background: 'rgba(184,164,255,0.08)', border: '1px solid rgba(184,164,255,0.15)', borderRadius: 4, padding: '1px 7px' }}>{recipe.difficulty}</span>}
          {recipe.isMealPrep && <span style={{ fontSize: 11, color: '#7FD5AA', background: 'rgba(127,213,170,0.08)', border: '1px solid rgba(127,213,170,0.2)', borderRadius: 4, padding: '1px 7px' }}>Meal prep ✓</span>}
          {recipe.storageDays && <span style={{ fontSize: 11, color: '#6E6E73' }}>Stores {recipe.storageDays}d</span>}
        </div>
      </div>

      {recipe.description && <p style={{ fontSize: 13, color: '#A1A1A6', marginBottom: 14, lineHeight: 1.6 }}>{recipe.description}</p>}

      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
          {tags.map(t => <span key={t} style={{ fontSize: 11, color: '#6E6E73', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '2px 7px' }}>{t}</span>)}
        </div>
      )}

      {/* Nutrition */}
      {totals.kcal > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Nutrition{p > 1 ? ' per portion' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { label: 'Calories', value: perPortion(totals.kcal, p), unit: 'kcal', color: '#ECC666' },
              { label: 'Protein', value: perPortion(totals.protein, p), unit: 'g', color: '#7FD5AA' },
              { label: 'Carbs', value: perPortion(totals.carbs, p), unit: 'g', color: '#80BDFF' },
              { label: 'Fat', value: perPortion(totals.fat, p), unit: 'g', color: '#F5A56A' },
              { label: 'Fiber', value: perPortion(totals.fiber, p), unit: 'g', color: '#B8A4FF' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{Math.round(m.value)}<span style={{ fontSize: 10, opacity: 0.7 }}>{m.unit}</span></div>
                <div style={{ fontSize: 10, color: '#6E6E73' }}>{m.label}</div>
              </div>
            ))}
          </div>
          {p > 1 && <div style={{ marginTop: 8, fontSize: 11, color: '#6E6E73', textAlign: 'center' }}>Total: {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g protein for {p} portions</div>}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Ingredients</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ fontSize: 13, color: '#A1A1A6' }}>{ing.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#F5F5F7', fontWeight: 600 }}>{ing.amount} {ing.unit}</span>
                  {ing.calories != null && <span style={{ fontSize: 11, color: '#6E6E73' }}>{Math.round(ing.calories)} kcal</span>}
                  {ing.protein != null && <span style={{ fontSize: 11, color: '#7FD5AA' }}>{Math.round(ing.protein)}g P</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Preparation</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recipe.steps.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{s.instruction}</li>
            ))}
          </ol>
        </div>
      )}

      {recipe.notes && (
        <div style={{ background: 'rgba(184,164,255,0.06)', border: '1px solid rgba(184,164,255,0.15)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#B8A4FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Notes</div>
          <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, lineHeight: 1.6 }}>{recipe.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main RecipeLibrary component ─────────────────────────────────────────────
type View = 'list' | 'create' | 'edit' | 'detail'

export default function RecipeLibrary({ userId }: { userId: string }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPrep, setFilterPrep] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meals/recipes?userId=${userId}`)
      const data = await res.json() as Recipe[]
      setRecipes(Array.isArray(data) ? data : [])
    } catch { setRecipes([]) }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  const handleSave = (recipe: Recipe) => {
    setRecipes(prev => {
      const exists = prev.find(r => r.id === recipe.id)
      if (exists) return prev.map(r => r.id === recipe.id ? recipe : r)
      return [recipe, ...prev]
    })
    setView('list')
    setActiveRecipe(null)
  }

  const handleArchive = async (recipe: Recipe) => {
    if (!confirm(`Archive "${recipe.name}"?`)) return
    await fetch(`/api/meals/recipes/${recipe.id}`, { method: 'DELETE' })
    setRecipes(prev => prev.filter(r => r.id !== recipe.id))
  }

  const filtered = recipes.filter(r => {
    if (filterType !== 'all' && r.mealType !== filterType) return false
    if (filterPrep && !r.isMealPrep) return false
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // ── Render ──
  if (view === 'create') {
    return <RecipeForm userId={userId} onSave={handleSave} onCancel={() => setView('list')} />
  }
  if (view === 'edit' && activeRecipe) {
    return <RecipeForm initial={activeRecipe} userId={userId} onSave={handleSave} onCancel={() => { setView('detail') }} />
  }
  if (view === 'detail' && activeRecipe) {
    return <RecipeDetail recipe={activeRecipe} onEdit={() => setView('edit')} onBack={() => setView('list')} />
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F7', margin: 0 }}>Recipe Library</h2>
          <p style={{ fontSize: 13, color: '#6E6E73', margin: '3px 0 0' }}>{recipes.length} saved recipe{recipes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setView('create')} style={{ padding: '8px 16px', background: 'rgba(127,213,170,0.12)', border: '1px solid rgba(127,213,170,0.3)', borderRadius: 8, color: '#7FD5AA', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + New recipe
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search recipes…"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#F5F5F7', fontSize: 12, padding: '6px 12px', outline: 'none', flex: '1 1 160px', minWidth: 160 }}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#A1A1A6', fontSize: 12, padding: '6px 10px', outline: 'none' }}>
          <option value="all">All types</option>
          {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={() => setFilterPrep(!filterPrep)} style={{ padding: '6px 12px', background: filterPrep ? 'rgba(184,164,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filterPrep ? 'rgba(184,164,255,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: filterPrep ? '#B8A4FF' : '#6E6E73', fontSize: 12, cursor: 'pointer', fontWeight: filterPrep ? 700 : 400 }}>
          <Archive size={12} style={{ marginRight: 5 }} /> Meal prep
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', height: 130 }}>
              {[60, 40, 80].map((w, j) => <div key={j} style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8, width: `${w}%`, animation: 'sk 1.4s ease-in-out infinite' }} />)}
            </div>
          ))}
          <style>{`@keyframes sk{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ marginBottom: 12, color: '#6E6E73', display: 'flex', justifyContent: 'center' }}><Utensils size={32} /></div>
          <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16 }}>
            {recipes.length === 0 ? 'No recipes yet. Add your first recipe to get started.' : 'No recipes match your filters.'}
          </div>
          {recipes.length === 0 && (
            <button onClick={() => setView('create')} style={{ padding: '9px 20px', background: 'rgba(127,213,170,0.1)', border: '1px solid rgba(127,213,170,0.25)', borderRadius: 8, color: '#7FD5AA', fontSize: 13, cursor: 'pointer' }}>
              Add first recipe
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onView={() => { setActiveRecipe(recipe); setView('detail') }}
              onEdit={() => { setActiveRecipe(recipe); setView('edit') }}
              onDelete={() => handleArchive(recipe)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
