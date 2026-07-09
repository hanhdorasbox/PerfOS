import {
  pgSchema,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'

// All Finance OS tables live in a dedicated Postgres schema so they never
// collide with the Prisma-managed tables in `public` (the existing build
// runs `prisma db push`, which only manages the public schema).
export const financeOs = pgSchema('finance_os')

// ─── Enums ───────────────────────────────────────────────────────────────────

export const positionStatus = financeOs.enum('position_status', ['open', 'closed'])

export const transactionType = financeOs.enum('transaction_type', [
  'buy',
  'sell',
  'dividend',
  'deposit',
  'withdrawal',
  'fee',
])

export const dataSource = financeOs.enum('data_source', ['manual', 't212'])

export const analysisStatus = financeOs.enum('analysis_status', ['draft', 'active', 'archived'])

export const alertType = financeOs.enum('alert_type', [
  'price_vs_fair_value',
  'position_weight',
  'drawdown_from_peak',
  'pe_percentile',
  'cash_below',
  'analysis_stale',
])

// ─── Core tables ─────────────────────────────────────────────────────────────

export const assets = financeOs.table('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticker: text('ticker').notNull().unique(), // standard ticker, e.g. AAPL, CEZ.PR
  name: text('name').notNull(),
  currency: text('currency').notNull(), // USD, CZK, EUR
  exchange: text('exchange'),
  sector: text('sector'),
  // Assets unknown to the market-data provider (e.g. Prague exchange):
  // prices are entered manually instead of fetched.
  manualPricing: boolean('manual_pricing').notNull().default(false),
  // Trading212 instrument code, e.g. AAPL_US_EQ
  t212Ticker: text('t212_ticker').unique(),
  // Set when a T212 instrument couldn't be mapped to a standard ticker;
  // surfaced in settings for manual pairing.
  needsMapping: boolean('needs_mapping').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const priceSnapshots = financeOs.table(
  'price_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    price: numeric('price').notNull(),
    date: date('date').notNull(),
  },
  (t) => [unique('price_snapshots_asset_date_unique').on(t.assetId, t.date)],
)

export const fundamentalsSnapshots = financeOs.table('fundamentals_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  // revenue, ebitda, netIncome, eps, fcf, totalDebt, cash, sharesOutstanding,
  // beta, peRatio, evEbitda, revenueGrowth3y
  data: jsonb('data').notNull(),
})

// ─── Portfolio ───────────────────────────────────────────────────────────────

export const positions = financeOs.table('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  status: positionStatus('status').notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
})

export const transactions = financeOs.table('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // null for deposits/withdrawals that aren't tied to a position
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'cascade' }),
  type: transactionType('type').notNull(),
  quantity: numeric('quantity'), // null for deposit/withdrawal
  price: numeric('price'),
  amount: numeric('amount').notNull(), // total amount in the asset currency
  currency: text('currency').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull(),
  note: text('note'),
  // Trading212 order/dividend id — makes the T212 sync idempotent
  externalId: text('external_id').unique(),
  source: dataSource('source').notNull().default('manual'),
})

export const cashBalances = financeOs.table('cash_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  currency: text('currency').notNull(),
  amount: numeric('amount').notNull(),
  // 'manual' = hand-kept reserve outside the broker, 't212' = synced from broker
  source: dataSource('source').notNull().default('manual'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Valuation ───────────────────────────────────────────────────────────────

export const analyses = financeOs.table('analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), // e.g. "AAPL — base case, 03/2026"
  status: analysisStatus('status').notNull().default('draft'),
  fairValue: numeric('fair_value'), // computed output
  marginOfSafety: numeric('margin_of_safety'), // % vs. current price, recomputed daily
  qualitativeNotes: text('qualitative_notes').notNull().default(''), // moat, management, risks (markdown)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Key table: every DCF input keeps both the API-fetched value and an optional
// manual override. Effective value = COALESCE(manual_value, fetched_value).
// A fetch must NEVER overwrite manual_value.
export const analysisInputs = financeOs.table(
  'analysis_inputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    field: text('field').notNull(), // e.g. "revenueGrowthY1", "terminalGrowth", "discountRate"
    fetchedValue: numeric('fetched_value'), // what the API returned (null = API doesn't have it)
    manualValue: numeric('manual_value'), // manual override (null = not overridden)
    source: text('source').notNull(), // "finnhub" | "manual" | "computed"
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('analysis_inputs_analysis_field_unique').on(t.analysisId, t.field)],
)

export const watchlistItems = financeOs.table('watchlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .unique()
    .references(() => assets.id, { onDelete: 'cascade' }),
  targetMos: numeric('target_mos').notNull(), // margin-of-safety buy threshold, e.g. 0.25
  note: text('note'),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertRules = financeOs.table('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: alertType('type').notNull(),
  params: jsonb('params').notNull(), // e.g. {assetId, thresholdPct} — depends on type
  isActive: boolean('is_active').notNull().default(true),
  cooldownHours: integer('cooldown_hours').notNull().default(72),
})

export const alertEvents = financeOs.table('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => alertRules.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').notNull(), // values at trigger time
  notified: boolean('notified').notNull().default(false),
})

// ─── FX, sync & cron bookkeeping ─────────────────────────────────────────────

export const fxRates = financeOs.table(
  'fx_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    currency: text('currency').notNull(), // e.g. USD, EUR
    rateToCzk: numeric('rate_to_czk').notNull(),
    date: date('date').notNull(),
  },
  (t) => [unique('fx_rates_currency_date_unique').on(t.currency, t.date)],
)

export const syncRuns = financeOs.table('sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), // running | success | error
  ordersImported: integer('orders_imported').notNull().default(0),
  dividendsImported: integer('dividends_imported').notNull().default(0),
  error: text('error'),
  // Reconciliation differences (computed position vs. T212 /portfolio) —
  // a mismatch means a bug or a missing transaction, surfaced on the dashboard
  warnings: jsonb('warnings'),
})

// Cached T212 instrument metadata (the list is huge and changes rarely)
export const t212Instruments = financeOs.table('t212_instruments', {
  id: uuid('id').primaryKey().defaultRandom(),
  t212Ticker: text('t212_ticker').notNull().unique(), // e.g. AAPL_US_EQ
  name: text('name'),
  shortName: text('short_name'), // usually the standard ticker, e.g. AAPL
  isin: text('isin'),
  currency: text('currency'),
  type: text('type'), // STOCK | ETF | ...
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cronRuns = financeOs.table('cron_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job: text('job').notNull(), // daily | weekly | digest
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), // running | success | error
  error: text('error'),
})

// ─── Row types ───────────────────────────────────────────────────────────────

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type PriceSnapshot = typeof priceSnapshots.$inferSelect
export type FundamentalsSnapshot = typeof fundamentalsSnapshots.$inferSelect
export type Position = typeof positions.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type CashBalance = typeof cashBalances.$inferSelect
export type Analysis = typeof analyses.$inferSelect
export type AnalysisInput = typeof analysisInputs.$inferSelect
export type WatchlistItem = typeof watchlistItems.$inferSelect
export type AlertRule = typeof alertRules.$inferSelect
export type AlertEvent = typeof alertEvents.$inferSelect
export type FxRate = typeof fxRates.$inferSelect
export type SyncRun = typeof syncRuns.$inferSelect
export type CronRun = typeof cronRuns.$inferSelect
export type T212Instrument = typeof t212Instruments.$inferSelect
