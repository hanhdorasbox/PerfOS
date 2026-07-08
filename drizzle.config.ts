import { defineConfig } from 'drizzle-kit'

// Finance OS tables live in the `finance_os` Postgres schema (see
// lib/invest/db/schema.ts); the Prisma-managed app keeps using `public`.
export default defineConfig({
  schema: './lib/invest/db/schema.ts',
  out: './drizzle/invest',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.FINANCE_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
})
