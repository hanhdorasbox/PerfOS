import { NextRequest, NextResponse } from 'next/server'

// Built-in macro database: macros per 100g (or 100ml for liquids)
export const COMMON_INGREDIENTS = [
  // Protein sources
  { name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Turkey breast', kcal: 135, protein: 30, carbs: 0, fat: 1, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Salmon', kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Tuna (canned in water)', kcal: 116, protein: 26, carbs: 0, fat: 1, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Beef (lean ground)', kcal: 215, protein: 26, carbs: 0, fat: 12, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Pork tenderloin', kcal: 143, protein: 26, carbs: 0, fat: 3.5, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Shrimp', kcal: 99, protein: 24, carbs: 0, fat: 0.3, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Eggs (whole)', kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Egg whites', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, unit: 'g', category: 'protein' },
  { name: 'Greek yogurt (0%)', kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, unit: 'g', category: 'dairy' },
  { name: 'Cottage cheese (low fat)', kcal: 72, protein: 12, carbs: 3, fat: 1, fiber: 0, unit: 'g', category: 'dairy' },
  { name: 'Whey protein powder', kcal: 400, protein: 80, carbs: 8, fat: 4, fiber: 0, unit: 'g', category: 'supplement' },
  { name: 'Tofu (firm)', kcal: 76, protein: 8, carbs: 2, fat: 4, fiber: 0.3, unit: 'g', category: 'protein' },
  // Dairy
  { name: 'Milk (full fat)', kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, unit: 'ml', category: 'dairy' },
  { name: 'Milk (skimmed)', kcal: 35, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0, unit: 'ml', category: 'dairy' },
  { name: 'Cheese (cheddar)', kcal: 403, protein: 25, carbs: 1.3, fat: 33, fiber: 0, unit: 'g', category: 'dairy' },
  { name: 'Mozzarella', kcal: 280, protein: 28, carbs: 2.2, fat: 17, fiber: 0, unit: 'g', category: 'dairy' },
  // Carbs / grains
  { name: 'Rice (white, cooked)', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, unit: 'g', category: 'carbs' },
  { name: 'Rice (brown, cooked)', kcal: 112, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, unit: 'g', category: 'carbs' },
  { name: 'Oats (dry)', kcal: 389, protein: 17, carbs: 66, fat: 7, fiber: 10, unit: 'g', category: 'carbs' },
  { name: 'Pasta (cooked)', kcal: 158, protein: 6, carbs: 31, fat: 0.9, fiber: 1.8, unit: 'g', category: 'carbs' },
  { name: 'Potatoes', kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, unit: 'g', category: 'carbs' },
  { name: 'Sweet potato', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, unit: 'g', category: 'carbs' },
  { name: 'Bread (whole grain)', kcal: 247, protein: 13, carbs: 41, fat: 4, fiber: 7, unit: 'g', category: 'carbs' },
  { name: 'Quinoa (cooked)', kcal: 120, protein: 4.4, carbs: 22, fat: 1.9, fiber: 2.8, unit: 'g', category: 'carbs' },
  { name: 'Tortilla (whole wheat)', kcal: 218, protein: 8, carbs: 36, fat: 5, fiber: 3, unit: 'g', category: 'carbs' },
  // Vegetables
  { name: 'Broccoli', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, unit: 'g', category: 'vegetable' },
  { name: 'Spinach', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, unit: 'g', category: 'vegetable' },
  { name: 'Mixed greens', kcal: 20, protein: 2, carbs: 3, fat: 0.3, fiber: 1.5, unit: 'g', category: 'vegetable' },
  { name: 'Tomatoes', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, unit: 'g', category: 'vegetable' },
  { name: 'Bell peppers', kcal: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, unit: 'g', category: 'vegetable' },
  { name: 'Cucumber', kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, unit: 'g', category: 'vegetable' },
  { name: 'Onion', kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, unit: 'g', category: 'vegetable' },
  { name: 'Garlic', kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, unit: 'g', category: 'vegetable' },
  // Fats
  { name: 'Olive oil', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, unit: 'ml', category: 'fat' },
  { name: 'Avocado', kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, unit: 'g', category: 'fat' },
  { name: 'Almonds', kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12, unit: 'g', category: 'nut' },
  { name: 'Peanut butter (natural)', kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, unit: 'g', category: 'fat' },
  { name: 'Walnuts', kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 7, unit: 'g', category: 'nut' },
  // Fruit
  { name: 'Banana', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, unit: 'g', category: 'fruit' },
  { name: 'Blueberries', kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, unit: 'g', category: 'fruit' },
  { name: 'Apple', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, unit: 'g', category: 'fruit' },
  { name: 'Orange', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, unit: 'g', category: 'fruit' },
  // Sauces / condiments
  { name: 'Soy sauce', kcal: 53, protein: 8, carbs: 5, fat: 0.1, fiber: 0.4, unit: 'ml', category: 'condiment' },
  { name: 'Tomato sauce', kcal: 29, protein: 1.3, carbs: 6, fat: 0.2, fiber: 1.5, unit: 'g', category: 'condiment' },
  { name: 'Honey', kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, unit: 'g', category: 'condiment' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').toLowerCase().trim()

  if (!q) return NextResponse.json(COMMON_INGREDIENTS)

  const results = COMMON_INGREDIENTS.filter(i =>
    i.name.toLowerCase().includes(q)
  ).slice(0, 10)

  return NextResponse.json(results)
}
