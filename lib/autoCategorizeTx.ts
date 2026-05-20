import { CATEGORIES, FinanceCategory } from './excel'

interface Rule {
  merchantPattern: string
  category: string
  subCategory?: string | null
}

export interface CategorizeResult {
  category: FinanceCategory | null
  subCategory: string | null
  confidence: 'high' | 'medium' | 'low'
}

// Built-in heuristic rules
const HEURISTICS: { pattern: RegExp; category: FinanceCategory; sub?: string }[] = [
  { pattern: /salary|mzda|plat|payroll|výplata/i, category: 'incomes', sub: 'salary' },
  { pattern: /rent|nájem|nájemné/i, category: 'bills', sub: 'rent' },
  { pattern: /electricity|plyn|gas|internet|telefon|phone|water|voda|elektřina|energie/i, category: 'bills', sub: 'utilities' },
  { pattern: /netflix|spotify|youtube|disney|apple|amazon prime|subscription/i, category: 'subscriptions' },
  { pattern: /grocery|potraviny|albert|billa|lidl|kaufland|tesco|penny|globus|supermarket/i, category: 'expenses', sub: 'groceries' },
  { pattern: /restaurant|café|cafe|bistro|pizza|sushi|mcdonald|kfc|burger|restaurac|stravovani/i, category: 'expenses', sub: 'dining' },
  { pattern: /pharmacy|lékárna|dr\.|doctor|hospital|zdravi/i, category: 'expenses', sub: 'health' },
  { pattern: /transport|metro|bus|taxi|uber|bolt|train|vlak|jízdné/i, category: 'expenses', sub: 'transport' },
  { pattern: /sport|gym|fitness|pool|bazén/i, category: 'expenses', sub: 'sports' },
  { pattern: /savings|spoření|spořeni|investic|investment|fond/i, category: 'savings & investments' },
  { pattern: /loan|půjčka|credit|úvěr|mortgage|hypotéka|splátka|splatka/i, category: 'debt' },
]

export function categorizeTx(
  description: string,
  amount: number,
  rules: Rule[]
): CategorizeResult {
  const lowerDesc = description.toLowerCase()

  // 1. Check user-learned rules first (highest confidence)
  for (const rule of rules) {
    if (lowerDesc.includes(rule.merchantPattern.toLowerCase())) {
      return {
        category: rule.category as FinanceCategory,
        subCategory: rule.subCategory ?? null,
        confidence: 'high',
      }
    }
  }

  // 2. Amount-based quick check: large positive = likely income
  if (amount > 0 && amount > 10000) {
    return { category: 'incomes', subCategory: null, confidence: 'medium' }
  }

  // 3. Heuristic pattern matching
  for (const h of HEURISTICS) {
    if (h.pattern.test(lowerDesc)) {
      return {
        category: h.category,
        subCategory: h.sub ?? null,
        confidence: 'medium',
      }
    }
  }

  // 4. Fallback: negative = expenses, positive = incomes
  if (amount !== 0) {
    return {
      category: amount > 0 ? 'incomes' : 'expenses',
      subCategory: null,
      confidence: 'low',
    }
  }

  return { category: null, subCategory: null, confidence: 'low' }
}

// re-export for external use
export { CATEGORIES }
