# Chargewise

Tells EV drivers which charging badge (eMSP subscription) gives them the cheapest rate at any nearby charger. Next.js 14 + Supabase + Vercel. The MVP v1.0 tech spec is the single source of truth.

## Stack

- **Next.js 14** (App Router, TypeScript) — web app + API routes
- **Supabase** (PostgreSQL, eu-central-1) — auth, DB, RLS
- **Tailwind CSS** — UI
- **PostHog EU** — analytics (consent-gated), **Sentry EU** — errors
- **Upstash Redis** — rate limiting, **web-push** — notifications
- **Vercel** — hosting + cron

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

## Supabase setup

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push            # applies supabase/migrations/ in order
npx tsx scripts/import-stations.ts   # seed ~30 FR stations
npx tsx scripts/import-tariffs.ts    # seed 200+ tariffs from data/tariffs-seed.csv
```

Dashboard checklist (spec §4.1, §13):
- Region **eu-central-1** (Frankfurt)
- Auth providers: Email/password + Google OAuth
- Extensions: uuid-ossp, pgcrypto, cube, earthdistance, pg_cron (auto via migration), pg_audit (dashboard only)
- RLS check: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;` → 0 rows

## Environment variables

See `.env.example`. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `INTERNAL_API_SECRET`) are Vercel **server** env vars — never `NEXT_PUBLIC_`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npx tsx scripts/import-tariffs.ts [csv]` | validate + upsert tariff CSV (spec §7.1 format) |
| `npx tsx scripts/import-stations.ts` | upsert station seed |

## Architecture notes

- Auth guard lives in `middleware.ts` (JWT via `supabase.auth.getUser()` — never `getSession()` server-side).
- Recommendation engine: `lib/recommendation-engine.ts`, tariff precedence in `lib/tariff-resolver.ts` (station+connector+power > station+connector > station > CPO+connector > CPO).
- GPS coordinates are **never** stored in DB or logs (GDPR) — sessionStorage only.
- Waitlist inserts go through the `waitlist_join` SECURITY DEFINER function; the service role key is used only in the cron sync and internal push route (spec §8.1).
- Nightly tariff sync: Vercel cron → `/api/cron/sync-tariffs` (Bearer `CRON_SECRET`).
