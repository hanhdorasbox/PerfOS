import { prisma } from '@/lib/db'
import RecipeLibrary from '@/components/meals/RecipeLibrary'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF9B87', padding: 40 }}>No user found.</div>

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <a href="/meals" style={{ fontSize: 12, color: '#6E6E73', textDecoration: 'none', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
          ← Meal Plan
        </a>
        <span style={{ fontSize: 12, color: '#4A8A6E', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(127,213,170,0.2)', background: 'rgba(127,213,170,0.06)', fontWeight: 700 }}>
          <BookOpen size={12} style={{ marginRight: 5 }} /> Recipes
        </span>
      </div>

      <RecipeLibrary userId={user.id} />
    </main>
  )
}
