# SVG AI Institute

A free, cohort-based online school that trains Vincentian youth (18–30) to build and deploy real AI automations, WhatsApp bots, and voice agents for actual local businesses. This repo is the platform: React + TypeScript + Vite frontend, Supabase backend (Postgres, magic-link auth, Row Level Security).

## Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) account (free tier is fine)

## 1. Supabase setup

1. Create a new Supabase project at [database.new](https://database.new).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public key**.
3. In **Authentication → Sign In / Up → Email**, make sure the **Email** provider is enabled, and **disable password-based sign-in** (this platform uses magic links only).
4. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production domain (the Vercel URL once deployed).
   - Add `http://localhost:5173/**` to the **Redirect URLs** allow-list (needed for local magic-link sign-in).
5. Apply the database migration: open **SQL Editor**, paste the contents of `supabase/migrations/0000_foundation.sql`, and run it. (If you use the Supabase CLI instead: `supabase link --project-ref <your-ref>` then `supabase db push`.)

## 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your project URL, e.g. `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your anon public key |

`.env.local` is gitignored — never commit it. In Vercel, set the same two variables in Project Settings → Environment Variables.

## 3. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:5173. You should see the bright SVG-colors home page. Go to **Sign In**, enter your email, and click the magic link that arrives to land on your dashboard.

## 4. Create the three test users

1. In the Supabase dashboard go to **Authentication → Users → Add user → Create new user** and create:
   - `admin@test.local`
   - `instructor@test.local`
   - `student@test.local`
2. Each new user automatically gets a `profiles` row with role `student` (via the `on_auth_user_created` trigger).
3. Run the seed to assign their real roles: open **SQL Editor**, paste the contents of `supabase/seed.sql`, and run it. This sets `admin@test.local` → admin, `instructor@test.local` → instructor, `student@test.local` → student.

## Migrations

Every schema change is a numbered SQL file in `supabase/migrations/` (starting with `0000_foundation.sql`), committed to the repo. Apply them in order via the SQL Editor or `supabase db push`.

## Project structure

```
src/
  components/
    ui/            Button, Card, Input, Badge, Spinner, EmptyState, PageHeader, DiamondMotif
    layout/        PublicLayout, AppLayout, Navbar, Sidebar, Footer
  features/
    auth/          SignInPage, AuthCallback, useAuth hook, ProtectedRoute
    dashboard/     DashboardPage
  lib/
    supabase.ts    Supabase client singleton
    types.ts       Shared TS types (Profile, Role, Database)
  styles/
    index.css      Tailwind directives + fonts + CSS variables
supabase/
  migrations/      Numbered SQL migrations
  seed.sql         Test-user role seed
```

## Design law

The interface is **bright** — white and light-blue pages carrying the SVG national colors (blue `#0072C6`, gold `#FCD116`, green `#009639`). No dark backgrounds, ever. All colors come from the Tailwind theme tokens in `tailwind.config.ts`; components never use raw hex values.
