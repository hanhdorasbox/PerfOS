import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

async function ensureRecipeTables() {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS "Recipe" (
       "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
       "mealType" TEXT NOT NULL, "description" TEXT, "prepMinutes" INTEGER,
       "cookMinutes" INTEGER, "portions" INTEGER NOT NULL DEFAULT 1,
       "difficulty" TEXT, "tags" TEXT, "notes" TEXT, "liked" BOOLEAN,
       "storageDays" INTEGER, "isMealPrep" BOOLEAN NOT NULL DEFAULT false,
       "status" TEXT NOT NULL DEFAULT 'active',
       "totalCalories" DOUBLE PRECISION, "totalProtein" DOUBLE PRECISION,
       "totalCarbs" DOUBLE PRECISION, "totalFat" DOUBLE PRECISION, "totalFiber" DOUBLE PRECISION,
       "lastUsedAt" TIMESTAMP(3), "usageCount" INTEGER NOT NULL DEFAULT 0,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
     )`,
    `CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
       "id" TEXT NOT NULL, "recipeId" TEXT NOT NULL, "name" TEXT NOT NULL,
       "amount" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL DEFAULT 'g',
       "calories" DOUBLE PRECISION, "protein" DOUBLE PRECISION, "carbs" DOUBLE PRECISION,
       "fat" DOUBLE PRECISION, "fiber" DOUBLE PRECISION, "brand" TEXT, "order" INTEGER NOT NULL DEFAULT 0,
       CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
     )`,
    `CREATE TABLE IF NOT EXISTS "RecipeStep" (
       "id" TEXT NOT NULL, "recipeId" TEXT NOT NULL, "instruction" TEXT NOT NULL,
       "order" INTEGER NOT NULL DEFAULT 0,
       CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
     )`,
  ]
  for (const sql of sqls) {
    try { await prisma.$executeRawUnsafe(sql) } catch { /* already exists */ }
  }
}

// GET — list recipes for user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const mealType = searchParams.get('mealType')
  const status = searchParams.get('status') ?? 'active'

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  await ensureRecipeTables()

  const where: Record<string, unknown> = { userId, status }
  if (mealType) where.mealType = mealType

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      ingredients: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(recipes)
}

// POST — create recipe
export async function POST(req: NextRequest) {
  await ensureRecipeTables()
  const body = await req.json()
  const {
    userId, name, mealType, description, prepMinutes, cookMinutes,
    portions, difficulty, tags, notes, liked, storageDays, isMealPrep,
    ingredients = [], steps = [],
  } = body

  if (!userId || !name || !mealType) {
    return NextResponse.json({ error: 'Missing required fields: userId, name, mealType' }, { status: 400 })
  }

  // Calculate totals from ingredients
  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0
  for (const ing of ingredients) {
    totalCalories += ing.calories ?? 0
    totalProtein += ing.protein ?? 0
    totalCarbs += ing.carbs ?? 0
    totalFat += ing.fat ?? 0
    totalFiber += ing.fiber ?? 0
  }

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name,
      mealType,
      description: description ?? null,
      prepMinutes: prepMinutes ?? null,
      cookMinutes: cookMinutes ?? null,
      portions: portions ?? 1,
      difficulty: difficulty ?? null,
      tags: tags ? JSON.stringify(tags) : null,
      notes: notes ?? null,
      liked: liked ?? null,
      storageDays: storageDays ?? null,
      isMealPrep: isMealPrep ?? false,
      totalCalories: ingredients.length > 0 ? totalCalories : null,
      totalProtein: ingredients.length > 0 ? totalProtein : null,
      totalCarbs: ingredients.length > 0 ? totalCarbs : null,
      totalFat: ingredients.length > 0 ? totalFat : null,
      totalFiber: ingredients.length > 0 ? totalFiber : null,
      ingredients: {
        create: ingredients.map((ing: Record<string, unknown>, idx: number) => ({
          name: ing.name as string,
          amount: ing.amount as number,
          unit: (ing.unit as string) ?? 'g',
          calories: (ing.calories as number) ?? null,
          protein: (ing.protein as number) ?? null,
          carbs: (ing.carbs as number) ?? null,
          fat: (ing.fat as number) ?? null,
          fiber: (ing.fiber as number) ?? null,
          brand: (ing.brand as string) ?? null,
          order: idx,
        })),
      },
      steps: {
        create: steps.map((s: Record<string, unknown>, idx: number) => ({
          instruction: s.instruction as string,
          order: idx,
        })),
      },
    },
    include: {
      ingredients: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
    },
  })

  return NextResponse.json(recipe)
}
