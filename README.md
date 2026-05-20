# PerfOS — Personal Performance Operating System

PerfOS is a connected personal intelligence layer — one app that synchronises your quarterly goals, weekly tasks, daily priorities, fitness strategy, nutrition tracking, meal planning, career capital, finances, and AI advisory into a single operational dashboard.

---

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Daily Intelligence briefing, day ring, priorities, calendar preview, fitness snapshot |
| **Quarterly Planning** | Goal setting, milestone tracking, progress updates, quarter overview |
| **Weekly Planning** | Weekly task breakdown linked to quarterly goals |
| **AI Chief of Staff** | Chat-based AI advisor with full context of your goals and metrics |
| **Fitness** | Active strategy, body metrics log, workout tracker, protein tracker |
| **Fitness Strategy** | AI-generated quarterly fitness plan with workout detail, schedule, nutrition |
| **Meals** | AI meal planner with batch cooking, shopping list, food preferences |
| **Career Capital** | Skills, proof of work, career capital items, trajectory planning |
| **Learning** | Capability goals with AI roadmaps |
| **Ideas** | Idea inbox with AI evaluation |
| **Finance** | Excel workbook integration, bank statement import, financial reports |
| **Reports** | Weekly Chief of Staff executive reports |
| **Operating Manual** | AI-detected behavioral patterns and trajectory forecasting |
| **Anti-Drift** | Work item logging, time-use analysis, drift detection |
| **Calendar** | ICS URL or Google OAuth calendar integration |

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/perfos.git
cd perfos
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at minimum:
```
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Get your Anthropic API key at https://console.anthropic.com/

### 3. Set up the database

```bash
npm run db:push    # creates/migrates the SQLite database
npm run db:seed    # seeds with sample user, goals, and data
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

See `.env.example` for the full list with descriptions. Required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | SQLite: `file:./prisma/dev.db` |
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API key — all AI features depend on this |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | App URL for OAuth redirects (`http://localhost:3000` for dev) |
| `GOOGLE_CLIENT_ID` | Optional | Google Calendar OAuth (ICS URL is simpler alternative) |
| `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar OAuth |
| `FINANCE_EXCEL_PATH` | Optional | Custom path to Excel workbook (default: `data/finance-tracker.xlsx`) |

---

## Deploying to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/perfos.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub — select your `perfos` repository
3. Framework: **Next.js** (auto-detected)
4. Leave build settings as default

### Step 3 — Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

```
DATABASE_URL        = (see database section below)
ANTHROPIC_API_KEY   = sk-ant-...
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
GOOGLE_CLIENT_ID    = (if using Google Calendar)
GOOGLE_CLIENT_SECRET= (if using Google Calendar)
```

### Step 4 — Deploy

Click Deploy. Vercel will build and deploy automatically.

---

## Database on Vercel

SQLite (`file:./prisma/dev.db`) **does not persist on Vercel** — the filesystem is read-only except `/tmp`. For production use one of these:

### Option A — Turso (recommended, SQLite-compatible)

Turso provides hosted SQLite with full Prisma support:

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create perfos

# Get connection URL
turso db show perfos --url
turso db tokens create perfos
```

Set environment variable:
```
DATABASE_URL="libsql://perfos-xxxxx.turso.io?authToken=TOKEN"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Option B — Neon (Postgres)

If you prefer Postgres, use [neon.tech](https://neon.tech):
1. Create a project, copy the connection string
2. Set `DATABASE_URL` to the Neon URL
3. Change `provider = "postgresql"` in schema.prisma
4. Run `npx prisma migrate deploy` instead of `db push`

### After changing the database

```bash
npx prisma db push      # or: npx prisma migrate deploy
npx prisma db seed      # seed initial data
```

---

## Finance Module — Excel Workbook

The Finance module reads and writes an Excel file for budget tracking.

**Local development:**
1. Place your `Finance Tracker.xlsx` file in the `data/` folder at project root
2. The app will auto-detect it — no env var needed
3. Or set `FINANCE_EXCEL_PATH` to a custom absolute path

**Vercel deployment:**
The Vercel filesystem is ephemeral — each serverless invocation gets a fresh `/tmp`. For persistent Excel on Vercel:

- **Option A (Vercel Blob):** Upload workbook to [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob), download to `/tmp` at runtime
- **Option B (skip):** Disable Excel write-back; transactions are always stored in the database and reports are generated from DB data

The Finance module will gracefully show a setup guide if the workbook file is not found.

---

## Google Calendar Setup

**Recommended: ICS URL (no OAuth needed)**
1. Dashboard → Calendar card → "Connect via ICS URL"
2. Paste your Google Calendar or Outlook ICS URL
3. Done — no OAuth credentials required

**Alternative: Google OAuth**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create/select project → APIs & Services → Enable Google Calendar API
3. Create OAuth 2.0 Client ID (Web application type)
4. Add Authorized redirect URI: `https://your-app.vercel.app/api/calendar/callback`
5. Copy Client ID and Secret to environment variables

---

## Database Commands Reference

```bash
npm run db:push    # Apply schema changes to database
npm run db:seed    # Seed with sample data (resets existing data)
npm run db:studio  # Open Prisma Studio (visual DB browser)
```

---

## Architecture Notes

- **Framework:** Next.js 16 App Router (React Server Components + Client Components)
- **Database:** Prisma ORM with SQLite (dev) / Turso or Postgres (prod)
- **AI:** Anthropic Claude (claude-sonnet-4-5) via `@anthropic-ai/sdk`
- **Charts:** Recharts
- **Excel:** xlsx library (server-side only)
- **Calendar:** Custom ICS parser + Google Calendar API
- **Styling:** CSS-in-JS inline styles + global CSS animations (no Tailwind at runtime)

---

## Known Limitations

| Feature | Limitation | Workaround |
|---------|-----------|-----------|
| Finance Excel | Requires local file; not auto-persisted on Vercel | Use `data/` folder locally; plan Vercel Blob for production |
| Google Calendar OAuth | Requires Google Cloud project setup | Use ICS URL instead (simpler) |
| Database | SQLite not supported on Vercel out of the box | Use Turso or Neon (see above) |
| AI features | Require valid `ANTHROPIC_API_KEY` | Add key to environment |
| Multi-user | App is single-user (no auth system) | Auth can be added later — schema is ready |

---

## Contributing / Development

```bash
npm run dev    # development server with hot reload (Turbopack)
npm run build  # production build
npm run lint   # ESLint
```
