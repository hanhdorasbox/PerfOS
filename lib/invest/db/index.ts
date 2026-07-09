import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type InvestDb = NeonHttpDatabase<typeof schema>

const globalForInvestDb = globalThis as unknown as { investDb: InvestDb | undefined }

// Lazy so that importing this module never throws at build time —
// the connection string is only required once a query actually runs.
export function getInvestDb(): InvestDb {
  if (globalForInvestDb.investDb) return globalForInvestDb.investDb

  const url = process.env.FINANCE_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error('Missing FINANCE_DATABASE_URL or DATABASE_URL environment variable')
  }

  const db = drizzle(neon(url), { schema })
  if (process.env.NODE_ENV !== 'production') globalForInvestDb.investDb = db
  return db
}

export * from './schema'
