import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — single recipe
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
    },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(recipe)
}

// PATCH — update recipe
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const {
    name, mealType, description, prepMinutes, cookMinutes, portions,
    difficulty, tags, notes, liked, storageDays, isMealPrep, status,
    ingredients, steps,
  } = body

  // Recalculate totals if ingredients provided
  let totals: Record<string, number | null> = {}
  if (ingredients) {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0
    for (const ing of ingredients) {
      totalCalories += ing.calories ?? 0
      totalProtein += ing.protein ?? 0
      totalCarbs += ing.carbs ?? 0
      totalFat += ing.fat ?? 0
      totalFiber += ing.fiber ?? 0
    }
    totals = { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber }
  }

  // Build update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = { updatedAt: new Date() }
  if (name !== undefined) data.name = name
  if (mealType !== undefined) data.mealType = mealType
  if (description !== undefined) data.description = description
  if (prepMinutes !== undefined) data.prepMinutes = prepMinutes
  if (cookMinutes !== undefined) data.cookMinutes = cookMinutes
  if (portions !== undefined) data.portions = portions
  if (difficulty !== undefined) data.difficulty = difficulty
  if (tags !== undefined) data.tags = JSON.stringify(tags)
  if (notes !== undefined) data.notes = notes
  if (liked !== undefined) data.liked = liked
  if (storageDays !== undefined) data.storageDays = storageDays
  if (isMealPrep !== undefined) data.isMealPrep = isMealPrep
  if (status !== undefined) data.status = status
  Object.assign(data, totals)

  // If ingredients/steps supplied, replace them
  if (ingredients) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } })
    data.ingredients = {
      create: ingredients.map((ing: Record<string, unknown>, idx: number) => ({
        name: ing.name as string,
        amount: ing.amount as number,
        unit: (ing.unit as string) ?? 'g',
        calories: (ing.calories as number) ?? null,
        protein: (ing.protein as number) ?? null,
        carbs: (ing.carbs as number) ?? null,
        fat: (ing.fat as number) ?? null,
        fiber: (ing.fiber as number) ?? null,
        order: idx,
      })),
    }
  }
  if (steps) {
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } })
    data.steps = {
      create: steps.map((s: Record<string, unknown>, idx: number) => ({
        instruction: s.instruction as string,
        order: idx,
      })),
    }
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data,
    include: {
      ingredients: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
    },
  })
  return NextResponse.json(recipe)
}

// DELETE — archive (soft delete) or hard delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const hard = searchParams.get('hard') === '1'

  if (hard) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } })
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } })
    await prisma.recipe.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  }

  // Soft delete — archive
  await prisma.recipe.update({ where: { id }, data: { status: 'archived' } })
  return NextResponse.json({ archived: true })
}
