import Decimal from 'decimal.js'

// Pure portfolio math — no DB access, fully unit-testable.
// All money passes through Decimal; numbers are only accepted at the edges.

export type TxLike = {
  type: 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal' | 'fee'
  quantity: string | number | null
  price: string | number | null
  amount: string | number
  executedAt: Date | string
}

export interface Holding {
  /** Current share count */
  quantity: Decimal
  /** Average cost per share (average-cost method), 0 when flat */
  avgCost: Decimal
  /** Cost basis of the currently held shares */
  costBasis: Decimal
  /** Realized P/L from sells (proceeds − cost of sold shares) */
  realizedPnl: Decimal
  /** Dividends received (in transaction currency) */
  dividends: Decimal
  /** Fees paid */
  fees: Decimal
}

function dec(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  return new Decimal(value)
}

function sortByExecutedAt<T extends TxLike>(txs: T[]): T[] {
  return [...txs].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  )
}

/**
 * Reconstructs a holding from its transactions (average-cost method).
 * Buys increase quantity and cost basis; sells realize P/L against the
 * average cost and reduce the basis proportionally.
 */
export function computeHolding(transactions: TxLike[]): Holding {
  let quantity = new Decimal(0)
  let costBasis = new Decimal(0)
  let realizedPnl = new Decimal(0)
  let dividends = new Decimal(0)
  let fees = new Decimal(0)

  for (const tx of sortByExecutedAt(transactions)) {
    const qty = dec(tx.quantity).abs()
    const amount = dec(tx.amount).abs()

    switch (tx.type) {
      case 'buy': {
        quantity = quantity.plus(qty)
        costBasis = costBasis.plus(amount)
        break
      }
      case 'sell': {
        const avg = quantity.gt(0) ? costBasis.div(quantity) : new Decimal(0)
        const soldQty = Decimal.min(qty, quantity)
        const costOfSold = avg.times(soldQty)
        realizedPnl = realizedPnl.plus(amount.minus(costOfSold))
        quantity = quantity.minus(soldQty)
        costBasis = costBasis.minus(costOfSold)
        break
      }
      case 'dividend': {
        dividends = dividends.plus(amount)
        break
      }
      case 'fee': {
        fees = fees.plus(amount)
        break
      }
      // deposit/withdrawal touch cash, not the holding
    }
  }

  const avgCost = quantity.gt(0) ? costBasis.div(quantity) : new Decimal(0)
  return { quantity, avgCost, costBasis, realizedPnl, dividends, fees }
}

export interface PositionValuation {
  marketValue: Decimal
  unrealizedPnl: Decimal
  unrealizedPnlPct: Decimal | null
}

export function valuePosition(holding: Holding, currentPrice: string | number): PositionValuation {
  const price = dec(currentPrice)
  const marketValue = holding.quantity.times(price)
  const unrealizedPnl = marketValue.minus(holding.costBasis)
  const unrealizedPnlPct = holding.costBasis.gt(0)
    ? unrealizedPnl.div(holding.costBasis)
    : null
  return { marketValue, unrealizedPnl, unrealizedPnlPct }
}

/** value × rate; rate is CZK per 1 unit of the currency (CZK itself = 1). */
export function toCzk(value: Decimal, currency: string, rates: Record<string, string | number>): Decimal | null {
  if (currency === 'CZK') return value
  const rate = rates[currency]
  if (rate === undefined) return null
  return value.times(dec(rate))
}

/** Portfolio weights as fractions of the total market value. */
export function computeWeights(valuesCzk: Array<{ id: string; valueCzk: Decimal }>): Map<string, Decimal> {
  const total = valuesCzk.reduce((sum, v) => sum.plus(v.valueCzk), new Decimal(0))
  const weights = new Map<string, Decimal>()
  for (const v of valuesCzk) {
    weights.set(v.id, total.gt(0) ? v.valueCzk.div(total) : new Decimal(0))
  }
  return weights
}
