import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import {
  getInvestDb,
  alertEvents,
  alertRules,
  analyses,
  assets,
  fundamentalsSnapshots,
  priceSnapshots,
  watchlistItems,
  type AlertRule,
  type InvestDb,
} from '@/lib/invest/db'
import { loadPortfolioOverview, type PortfolioOverview } from '@/lib/invest/portfolio/overview'
import { drawdownFromPeak, isInCooldown, monthsBetween, percentile } from './calc'
import { formatMoney, formatPercent, formatPercentSigned } from '@/lib/invest/format'
import { sendEmail } from '@/lib/invest/email/send'
import { AlertEmail, type AlertEmailEvent } from '@/lib/invest/email/templates'

export const ALERT_TYPE_LABELS: Record<AlertRule['type'], string> = {
  price_vs_fair_value: 'Price vs. fair value',
  position_weight: 'Position weight',
  drawdown_from_peak: 'Drawdown from peak',
  pe_percentile: 'P/E percentile',
  cash_below: 'Low cash reserve',
  analysis_stale: 'Stale analysis',
}

interface Trigger {
  payload: Record<string, unknown>
  lines: string[]
}

type Params = Record<string, unknown>

function num(params: Params, key: string, fallback?: number): number | null {
  const v = params[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return fallback ?? null
}

function str(params: Params, key: string): string | null {
  const v = params[key]
  return typeof v === 'string' && v !== '' ? v : null
}

interface EngineContext {
  db: InvestDb
  overview: PortfolioOverview
  activeAnalyses: Array<{
    id: string
    assetId: string
    ticker: string
    currency: string
    title: string
    fairValue: string | null
    marginOfSafety: string | null
    updatedAt: Date
    targetMos: string | null
    currentPrice: string | null
  }>
}

async function buildContext(db: InvestDb): Promise<EngineContext> {
  const overview = await loadPortfolioOverview()

  const rows = await db
    .select({
      id: analyses.id,
      assetId: analyses.assetId,
      title: analyses.title,
      fairValue: analyses.fairValue,
      marginOfSafety: analyses.marginOfSafety,
      updatedAt: analyses.updatedAt,
      ticker: assets.ticker,
      currency: assets.currency,
      targetMos: watchlistItems.targetMos,
    })
    .from(analyses)
    .innerJoin(assets, eq(analyses.assetId, assets.id))
    .leftJoin(watchlistItems, eq(watchlistItems.assetId, assets.id))
    .where(eq(analyses.status, 'active'))
    .orderBy(desc(analyses.updatedAt))

  const assetIds = [...new Set(rows.map((r) => r.assetId))]
  const priceMap = new Map<string, string>()
  if (assetIds.length > 0) {
    const prices = await db
      .select({ assetId: priceSnapshots.assetId, price: priceSnapshots.price, date: priceSnapshots.date })
      .from(priceSnapshots)
      .where(inArray(priceSnapshots.assetId, assetIds))
      .orderBy(desc(priceSnapshots.date))
    for (const p of prices) {
      if (!priceMap.has(p.assetId)) priceMap.set(p.assetId, p.price)
    }
  }

  const seen = new Set<string>()
  const activeAnalyses = rows
    .filter((r) => (seen.has(r.assetId) ? false : (seen.add(r.assetId), true)))
    .map((r) => ({ ...r, currentPrice: priceMap.get(r.assetId) ?? null }))

  return { db, overview, activeAnalyses }
}

// ─── Evaluators (rules are data; this is the interpreter per type) ──────────

function evalPriceVsFairValue(params: Params, ctx: EngineContext): Trigger | null {
  const threshold = num(params, 'thresholdPct', 0.1)!
  const onlyAsset = str(params, 'assetId')
  const lines: string[] = []
  const hits: Record<string, unknown>[] = []

  for (const a of ctx.activeAnalyses) {
    if (onlyAsset && a.assetId !== onlyAsset) continue
    if (!a.fairValue || !a.currentPrice) continue
    const fv = Number(a.fairValue)
    const price = Number(a.currentPrice)
    const mos = a.marginOfSafety !== null ? Number(a.marginOfSafety) : null

    if (fv > 0 && price >= fv * (1 + threshold)) {
      lines.push(
        `${a.ticker}: price ${formatMoney(price, a.currency)} is ${formatPercent((price - fv) / fv)} above fair value ${formatMoney(fv, a.currency)} (“${a.title}”).`,
      )
      hits.push({ ticker: a.ticker, kind: 'above_fair_value', price, fairValue: fv })
    }
    if (mos !== null && a.targetMos !== null && mos >= Number(a.targetMos)) {
      lines.push(
        `${a.ticker}: margin of safety ${formatPercentSigned(mos)} reached the target ${formatPercent(Number(a.targetMos))} — price ${formatMoney(price, a.currency)}, fair value ${formatMoney(fv, a.currency)}.`,
      )
      hits.push({ ticker: a.ticker, kind: 'mos_target_reached', mos, targetMos: Number(a.targetMos) })
    }
  }
  return hits.length > 0 ? { payload: { hits }, lines } : null
}

function evalPositionWeight(params: Params, ctx: EngineContext): Trigger | null {
  const threshold = num(params, 'thresholdPct')
  if (threshold === null) return null
  const onlyAsset = str(params, 'assetId')
  const lines: string[] = []
  const hits: Record<string, unknown>[] = []
  for (const p of ctx.overview.positions) {
    if (onlyAsset && p.assetId !== onlyAsset) continue
    const weight = p.weight !== null ? Number(p.weight) : null
    if (weight !== null && weight > threshold) {
      lines.push(`${p.ticker}: portfolio weight ${formatPercent(weight)} exceeded the threshold ${formatPercent(threshold)}.`)
      hits.push({ ticker: p.ticker, weight, threshold })
    }
  }
  return hits.length > 0 ? { payload: { hits }, lines } : null
}

async function evalDrawdown(params: Params, ctx: EngineContext): Promise<Trigger | null> {
  const threshold = num(params, 'thresholdPct')
  if (threshold === null) return null
  const periodDays = num(params, 'periodDays', 180)!
  const onlyAsset = str(params, 'assetId')

  const targets = ctx.overview.positions.filter((p) => !onlyAsset || p.assetId === onlyAsset)
  if (targets.length === 0) return null

  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString().slice(0, 10)
  const rows = await ctx.db
    .select({ assetId: priceSnapshots.assetId, price: priceSnapshots.price, date: priceSnapshots.date })
    .from(priceSnapshots)
    .where(
      and(
        inArray(priceSnapshots.assetId, targets.map((t) => t.assetId)),
        gte(priceSnapshots.date, since),
      ),
    )
    .orderBy(priceSnapshots.date)

  const lines: string[] = []
  const hits: Record<string, unknown>[] = []
  for (const t of targets) {
    const series = rows.filter((r) => r.assetId === t.assetId).map((r) => Number(r.price))
    const dd = drawdownFromPeak(series)
    if (dd && dd.drawdown >= threshold) {
      lines.push(
        `${t.ticker}: drawdown ${formatPercent(dd.drawdown)} from the peak ${formatMoney(dd.peak, t.currency)} over the last ${periodDays} days.`,
      )
      hits.push({ ticker: t.ticker, drawdown: dd.drawdown, peak: dd.peak, periodDays })
    }
  }
  return hits.length > 0 ? { payload: { hits }, lines } : null
}

async function evalPePercentile(params: Params, ctx: EngineContext): Promise<Trigger | null> {
  const assetId = str(params, 'assetId')
  const p = num(params, 'percentile', 0.9)!
  if (!assetId) return null

  const snapshots = await ctx.db
    .select({ data: fundamentalsSnapshots.data, fetchedAt: fundamentalsSnapshots.fetchedAt })
    .from(fundamentalsSnapshots)
    .where(eq(fundamentalsSnapshots.assetId, assetId))
    .orderBy(fundamentalsSnapshots.fetchedAt)

  const series = snapshots
    .map((s) => (s.data as { peRatio?: number | null }).peRatio)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (series.length < 4) return null // too little history to be meaningful

  const current = series[series.length - 1]
  const cut = percentile(series, p)
  if (cut === null || current <= cut) return null

  const [asset] = await ctx.db.select({ ticker: assets.ticker }).from(assets).where(eq(assets.id, assetId)).limit(1)
  const ticker = asset?.ticker ?? assetId
  return {
    payload: { ticker, currentPe: current, percentile: p, cutoff: cut, samples: series.length },
    lines: [
      `${ticker}: current P/E ${current.toFixed(1)} is above the ${Math.round(p * 100)}th percentile of its own history (${cut.toFixed(1)}, ${series.length} snapshots).`,
    ],
  }
}

function evalCashBelow(params: Params, ctx: EngineContext): Trigger | null {
  const threshold = num(params, 'thresholdCzk')
  if (threshold === null || ctx.overview.cashTotalCzk === null) return null
  const total = Number(ctx.overview.cashTotalCzk)
  if (total >= threshold) return null
  return {
    payload: { totalCzk: total, thresholdCzk: threshold },
    lines: [
      `Cash rezerva ${formatMoney(total, 'CZK', 0)} je pod prahem ${formatMoney(threshold, 'CZK', 0)}.`,
    ],
  }
}

function evalAnalysisStale(params: Params, ctx: EngineContext): Trigger | null {
  const months = num(params, 'months', 6)!
  const now = new Date()
  const stale = ctx.activeAnalyses.filter((a) => monthsBetween(a.updatedAt, now) >= months)
  if (stale.length === 0) return null
  return {
    payload: { analyses: stale.map((a) => ({ ticker: a.ticker, updatedAt: a.updatedAt })) },
    lines: stale.map(
      (a) =>
        `${a.ticker}: active analysis “${a.title}” hasn't been updated in ${Math.floor(monthsBetween(a.updatedAt, now))} months.`,
    ),
  }
}

// ─── Runner ─────────────────────────────────────────────────────────────────

export interface AlertRunResult {
  evaluated: number
  triggered: number
  notified: number
  errors: string[]
}

export async function evaluateAlertRules(): Promise<AlertRunResult> {
  const db = getInvestDb()
  const result: AlertRunResult = { evaluated: 0, triggered: 0, notified: 0, errors: [] }

  const rules = await db.select().from(alertRules).where(eq(alertRules.isActive, true))
  if (rules.length === 0) return result

  const ctx = await buildContext(db)
  const emailEvents: Array<AlertEmailEvent & { eventId: string }> = []

  for (const rule of rules) {
    result.evaluated += 1
    try {
      const [lastEvent] = await db
        .select({ triggeredAt: alertEvents.triggeredAt })
        .from(alertEvents)
        .where(eq(alertEvents.ruleId, rule.id))
        .orderBy(desc(alertEvents.triggeredAt))
        .limit(1)
      if (isInCooldown(lastEvent?.triggeredAt ?? null, rule.cooldownHours)) continue

      const params = (rule.params ?? {}) as Params
      let trigger: Trigger | null = null
      switch (rule.type) {
        case 'price_vs_fair_value':
          trigger = evalPriceVsFairValue(params, ctx)
          break
        case 'position_weight':
          trigger = evalPositionWeight(params, ctx)
          break
        case 'drawdown_from_peak':
          trigger = await evalDrawdown(params, ctx)
          break
        case 'pe_percentile':
          trigger = await evalPePercentile(params, ctx)
          break
        case 'cash_below':
          trigger = evalCashBelow(params, ctx)
          break
        case 'analysis_stale':
          trigger = evalAnalysisStale(params, ctx)
          break
      }
      if (!trigger) continue

      result.triggered += 1
      const [event] = await db
        .insert(alertEvents)
        .values({ ruleId: rule.id, payload: { ...trigger.payload, lines: trigger.lines } })
        .returning({ id: alertEvents.id, triggeredAt: alertEvents.triggeredAt })

      emailEvents.push({
        eventId: event.id,
        ruleName: rule.name,
        typeLabel: ALERT_TYPE_LABELS[rule.type],
        triggeredAt: event.triggeredAt.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }),
        lines: trigger.lines,
      })
    } catch (e) {
      result.errors.push(`${rule.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (emailEvents.length > 0) {
    try {
      const sent = await sendEmail(
        emailEvents.length === 1
          ? `Finance OS alert: ${emailEvents[0].ruleName}`
          : `Finance OS: ${emailEvents.length} alerts`,
        AlertEmail({ events: emailEvents }),
      )
      if (sent) {
        await db
          .update(alertEvents)
          .set({ notified: true })
          .where(inArray(alertEvents.id, emailEvents.map((e) => e.eventId)))
        result.notified = emailEvents.length
      }
    } catch (e) {
      result.errors.push(`email: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return result
}
