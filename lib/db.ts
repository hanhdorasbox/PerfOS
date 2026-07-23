import { Prisma, PrismaClient } from '@prisma/client'

// NOTE: for serverless, DATABASE_URL should point at Neon's pooled endpoint
// (the "-pooler" host) so connections survive cold starts and rotation.
//
// Neon (serverless Postgres) scales its compute to zero after inactivity. The
// first query after a cold start can fail with P1001 "Can't reach database
// server" while the compute wakes back up. Such init/connection errors mean the
// query never reached the database, so retrying them is safe — even for writes.
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])

function isTransientConnectionError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true
  if (e instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_CODES.has(e.code)
  const msg = e instanceof Error ? e.message : ''
  return msg.includes("Can't reach database server")
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function createPrisma() {
  return new PrismaClient({ log: ['error'] }).$extends({
    query: {
      // Wrap every operation so a cold-start blip retries instead of 500ing.
      async $allOperations({ args, query }) {
        const maxAttempts = 4
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args)
          } catch (e) {
            if (attempt >= maxAttempts || !isTransientConnectionError(e)) throw e
            await sleep(150 * 2 ** (attempt - 1)) // 150ms, 300ms, 600ms
          }
        }
      },
    },
  })
}

type ExtendedPrisma = ReturnType<typeof createPrisma>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrisma | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
