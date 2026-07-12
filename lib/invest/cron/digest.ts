import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import Decimal from 'decimal.js'
import {
  getInvestDb,
  alertEvents,
  alertRules,
  analyses,
  assets,
  cronRuns,
  fundamentalsSnapshots,
  priceSnapshots,
  watchlistItems,
} from '@/lib/invest/db'
import { loadPortfolioOverview } from '@/lib/invest/portfolio/overview'
import { toCzk } from '@/lib/invest/portfolio/calc'
import { formatDate, formatMoney, formatPercent, formatPercentSigned } from '@/lib/invest/format'
import { monthsBetween } from '@/lib/invest/alerts/calc'
import { sendEmail, emailConfigured } from '@/lib/invest/email/send'
import { DigestEmail, type DigestData } from '@/lib/invest/email/templates'
import type { FundamentalsData } from '@/lib/invest/market-data/types'

export interface DigestRunResult {
  sent: boolean
  reason?: string
}

/** Sunday digest e-mail (spec §9) — one dark-themed summary of the week. */
export async function runDigestCron(): Promise<DigestRunResult> {
  const db = getInvestDb()
  const [run] = await db
    .insert(cronRuns)
    .values({ job: 'digest', status: 'running' })
    .returning({ id: cronRuns.id })

  try {
    if (!emailConfigured()) {
      await db
        .update(cronRuns)
        .set({ finishedAt: new Date(), status: 'error', error: 'RESEND_API_KEY / ALERT_EMAIL_TO not configured' })
        .where(eq(cronRuns.id, run.id))
      return { sent: false, reason: 'email is not configured' }
    }

    const overview = await loadPortfolioOverview()
    const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

    // ── 1. Weekly change + top movers (price a week ago vs. now) ─────────
    const assetIds = overview.positions.map((p) => p.assetId)
    const oldPriceMap = new Map<string, string>()
    if (assetIds.length > 0) {
      const oldRows = await db
        .select({ assetId: priceSnapshots.assetId, price: priceSnapshots.price, date: priceSnapshots.date })
        .from(priceSnapshots)
        .where(and(inArray(priceSnapshots.assetId, assetIds), lte(priceSnapshots.date, weekAgoIso)))
        .orderBy(desc(priceSnapshots.date))
      for (const row of oldRows) {
        if (!oldPriceMap.has(row.assetId)) oldPriceMap.set(row.assetId, row.price)
      }
    }

    let weeklyChangeCzk = new Decimal(0)
    let anyChange = false
    const movers: Array<{ ticker: string; pct: number; line: string }> = []
    for (const p of overview.positions) {
      const oldPrice = oldPriceMap.get(p.assetId)
      if (!oldPrice || !p.currentPrice || Number(oldPrice) === 0) continue
      const delta = new Decimal(p.currentPrice).minus(oldPrice)
      const pct = delta.div(oldPrice).toNumber()
      const changeValue = delta.times(p.quantity)
      const czk = toCzk(changeValue, p.currency, {})
      // FX conversion needs rates; approximate portfolio change via CZK values
      if (p.marketValueCzk !== null) {
        const nowCzk = new Decimal(p.marketValueCzk)
        const weekAgoCzk = nowCzk.div(new Decimal(1).plus(pct))
        weeklyChangeCzk = weeklyChangeCzk.plus(nowCzk.minus(weekAgoCzk))
        anyChange = true
      }
      void czk
      movers.push({
        ticker: p.ticker,
        pct,
        line: `${p.ticker}: ${formatPercentSigned(pct)} (${formatMoney(oldPrice, p.currency)} → ${formatMoney(p.currentPrice, p.currency)})`,
      })
    }
    movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))

    // ── 2. Alerts of the week ─────────────────────────────────────────────
    const weekAgo = new Date(Date.now() - 7 * 86_400_000)
    const events = await db
      .select({ triggeredAt: alertEvents.triggeredAt, name: alertRules.name, payload: alertEvents.payload })
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
      .where(gte(alertEvents.triggeredAt, weekAgo))
      .orderBy(desc(alertEvents.triggeredAt))
    const alertLines = events.map((e) => {
      const lines = (e.payload as { lines?: string[] })?.lines
      const detail = Array.isArray(lines) && lines.length > 0 ? ` — ${lines[0]}` : ''
      return `${formatDate(e.triggeredAt)} · ${e.name}${detail}`
    })

    // ── 3. Watchlist top 3 by distance to target MoS ─────────────────────
    const watch = await db
      .select({
        assetId: watchlistItems.assetId,
        targetMos: watchlistItems.targetMos,
        ticker: assets.ticker,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
    const activeRows = await db
      .select({ assetId: analyses.assetId, marginOfSafety: analyses.marginOfSafety, updatedAt: analyses.updatedAt })
      .from(analyses)
      .where(eq(analyses.status, 'active'))
      .orderBy(desc(analyses.updatedAt))
    const mosByAsset = new Map<string, number>()
    for (const row of activeRows) {
      if (!mosByAsset.has(row.assetId) && row.marginOfSafety !== null) {
        mosByAsset.set(row.assetId, Number(row.marginOfSafety))
      }
    }
    const watchlistTop = watch
      .map((w) => {
        const current = mosByAsset.get(w.assetId)
        if (current === undefined) return null
        const target = Number(w.targetMos)
        return {
          distance: current - target,
          line: `${w.ticker}: MoS ${formatPercentSigned(current)} vs. target ${formatPercent(target)} (${formatPercentSigned(current - target)} to target)`,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 3)
      .map((x) => x.line)

    // ── 4. Stale analyses (4+ months) with price & fundamentals drift ────
    const staleLines: string[] = []
    const staleRows = await db
      .select({
        id: analyses.id,
        assetId: analyses.assetId,
        title: analyses.title,
        updatedAt: analyses.updatedAt,
        ticker: assets.ticker,
        currency: assets.currency,
      })
      .from(analyses)
      .innerJoin(assets, eq(analyses.assetId, assets.id))
      .where(eq(analyses.status, 'active'))
    for (const row of staleRows) {
      const ageMonths = monthsBetween(row.updatedAt, new Date())
      if (ageMonths < 4) continue

      const sinceIso = row.updatedAt.toISOString().slice(0, 10)
      const [priceThen] = await db
        .select({ price: priceSnapshots.price })
        .from(priceSnapshots)
        .where(and(eq(priceSnapshots.assetId, row.assetId), lte(priceSnapshots.date, sinceIso)))
        .orderBy(desc(priceSnapshots.date))
        .limit(1)
      const [priceNow] = await db
        .select({ price: priceSnapshots.price })
        .from(priceSnapshots)
        .where(eq(priceSnapshots.assetId, row.assetId))
        .orderBy(desc(priceSnapshots.date))
        .limit(1)

      let drift = ''
      if (priceThen && priceNow && Number(priceThen.price) !== 0) {
        const pct = (Number(priceNow.price) - Number(priceThen.price)) / Number(priceThen.price)
        drift = `, price since then ${formatPercentSigned(pct)}`
      }

      const fundamentals = await db
        .select({ data: fundamentalsSnapshots.data, fetchedAt: fundamentalsSnapshots.fetchedAt })
        .from(fundamentalsSnapshots)
        .where(eq(fundamentalsSnapshots.assetId, row.assetId))
        .orderBy(desc(fundamentalsSnapshots.fetchedAt))
        .limit(10)
      const latest = fundamentals[0]?.data as FundamentalsData | undefined
      const then = fundamentals.find((f) => f.fetchedAt <= row.updatedAt)?.data as
        | FundamentalsData
        | undefined
      if (latest?.eps != null && then?.eps != null && then.eps !== 0) {
        drift += `, EPS ${formatPercentSigned((latest.eps - then.eps) / Math.abs(then.eps))}`
      }

      staleLines.push(
        `${row.ticker}: “${row.title}” is ${Math.floor(ageMonths)} months old${drift}.`,
      )
    }

    // ── 5. Cash ───────────────────────────────────────────────────────────
    const cashLines = overview.cash.map(
      (c) =>
        `${c.currency} (${c.source === 't212' ? 'Trading212' : 'manual reserve'}): ${formatMoney(c.amount, c.currency, 0)}`,
    )
    if (overview.cashTotalCzk !== null) {
      cashLines.push(`Total ≈ ${formatMoney(overview.cashTotalCzk, 'CZK', 0)}`)
    }

    const totalValue = overview.totalValueCzk
    const weeklyPct =
      anyChange && totalValue && Number(totalValue) !== 0
        ? weeklyChangeCzk.div(new Decimal(totalValue).minus(weeklyChangeCzk)).toNumber()
        : null

    const data: DigestData = {
      weekLabel: new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Prague' }),
      totalValueCzk: totalValue ? formatMoney(totalValue, 'CZK', 0) : null,
      weeklyChangeLine: anyChange
        ? `Weekly change: ${formatMoney(weeklyChangeCzk.toFixed(0), 'CZK', 0)}${weeklyPct !== null ? ` (${formatPercentSigned(weeklyPct)})` : ''}`
        : null,
      topMovers: movers.slice(0, 3).map((m) => m.line),
      alerts: alertLines,
      watchlistTop,
      staleAnalyses: staleLines,
      cashLines,
    }

    await sendEmail(
      `Finance OS — Sunday digest (${data.weekLabel})`,
      DigestEmail({ data }),
    )

    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), status: 'success' })
      .where(eq(cronRuns.id, run.id))
    return { sent: true }
  } catch (e) {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: 'error',
        error: (e instanceof Error ? e.message : String(e)).slice(0, 2000),
      })
      .where(eq(cronRuns.id, run.id))
    throw e
  }
}
