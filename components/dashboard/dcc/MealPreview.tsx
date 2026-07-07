'use client'
import Link from 'next/link'
import SideCard from '@/components/ui/SideCard'
import { sortMeals } from './helpers'
import type { PlannedMeal } from './types'

function getNextMealTime(meal: PlannedMeal): { minutesUntil: number; timeStr: string } | null {
  const now = new Date()
  const mealHour = meal.mealType.toLowerCase() === 'breakfast' ? 7
    : meal.mealType.toLowerCase() === 'lunch' ? 12
    : meal.mealType.toLowerCase() === 'dinner' ? 18
    : meal.mealType.toLowerCase() === 'snack' ? 15
    : null

  if (!mealHour) return null

  const today = new Date()
  today.setHours(mealHour, 0, 0, 0)
  const nextMeal = today > now ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const diff = nextMeal.getTime() - now.getTime()
  const minutesUntil = Math.round(diff / (60 * 1000))

  if (minutesUntil < 0) return null
  const h = Math.floor(minutesUntil / 60)
  const m = minutesUntil % 60
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`

  return { minutesUntil, timeStr }
}

export default function MealPreview({ meals, label, href, isTomorrow = false, todayProtein = 0, proteinTarget = null }: { meals: PlannedMeal[]; label: string; href?: string; isTomorrow?: boolean; todayProtein?: number; proteinTarget?: number | null }) {
  const sorted = sortMeals(meals)
  const showProtein = !isTomorrow && proteinTarget && proteinTarget > 0
  const proteinPct = showProtein ? Math.min(100, Math.round((todayProtein / proteinTarget!) * 100)) : 0
  const proteinColor = proteinPct >= 100 ? '#7FD5AA' : proteinPct >= 70 ? '#DDB96A' : '#E8907A'

  return (
    <SideCard label={label} action={href ? { href, label: 'Full plan →' } : undefined}>

      {showProtein && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6E6E76' }}>Protein today</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: proteinColor, fontVariantNumeric: 'tabular-nums' }}>
              {todayProtein}g
              <span style={{ fontSize: 10, fontWeight: 400, color: '#52525A' }}> / {proteinTarget}g</span>
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div className="progress-fill" style={{
              height: '100%', width: `${proteinPct}%`, borderRadius: 999,
              background: proteinColor,
            }} />
          </div>
        </div>
      )}

      {sorted.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sorted.map(meal => {
            const timing = !isTomorrow ? getNextMealTime(meal) : null
            const isOverdue = timing && timing.minutesUntil < 0
            const isDueSoon = timing && timing.minutesUntil >= 0 && timing.minutesUntil < 30
            const mealColor = isOverdue ? '#E8907A' : isDueSoon ? '#DDB96A' : '#6E6E76'

            return (
              <div key={meal.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: mealColor, minWidth: 60, paddingTop: 1 }}>
                  {meal.mealType}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#EEEEF2', fontWeight: 500 }}>{meal.title}</div>
                  <div style={{ fontSize: 10, color: '#6E6E76', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {meal.calories ? `${meal.calories} kcal` : ''}
                    {meal.calories && meal.protein ? ' · ' : ''}
                    {meal.protein ? `${meal.protein}g protein` : ''}
                    {timing && timing.minutesUntil >= 0 && (
                      <>
                        <span style={{ color: '#3E3E44' }}>·</span>
                        <span style={{ color: isDueSoon ? '#DDB96A' : '#6E6E76', fontWeight: isDueSoon ? 600 : 400 }}>
                          {isDueSoon ? `in ${timing.timeStr}` : `in ${timing.timeStr}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6E6E76' }}>
          {isTomorrow ? 'No meals scheduled.' : 'No meal plan.'} {!isTomorrow && (
            <Link href="/meals" style={{ color: '#B8A4FF', textDecoration: 'none' }}>Generate →</Link>
          )}
        </div>
      )}
    </SideCard>
  )
}
