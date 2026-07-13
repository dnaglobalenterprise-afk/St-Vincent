# PRD 00 — Foundation & Design System

## Overview

This PRD creates the foundation every other PRD builds on: the project scaffold, the complete bright SVG-colors design system as working code, Supabase with magic-link authentication, the role system, the profiles table with Row Level Security, the app shell (public layout + authenticated layout), and protected routing.

This is for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Nothing in this PRD depends on any other PRD. When this PRD is complete, a user can visit the site, request a magic link, sign in, land on a role-appropriate dashboard shell, and sign out. The design system is fully implemented as Tailwind theme tokens and base UI components that all future PRDs consume.

**Design law for this entire platform:** the interface is BRIGHT. White and light-blue backgrounds carrying the national colors of Saint Vincent and the Grenadines (blue, gold, green). No dark backgrounds, no dark mode, no gray-900 pages. Text is deep navy, never pure black. If any screen renders on a dark background, that is a bug.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict mode) + Vite
- **Styling:** Tailwind CSS v3, tokens defined in `tailwind.config.ts` only. No raw hex values inside components.
- **Fonts:** Sora (headings, weights 600/700) and Inter (body, weights 400/500/600) via Google Fonts
- **Backend / DB / Auth:** Supabase (Postgres, Auth with email magic link / OTP, Row Level Security)
- **Routing:** react-router-dom v6
- **Icons:** lucide-react
- **Hosting target:** Vercel (SPA build)
- **Email delivery for magic links:** Supabase built-in auth email (Resend integration arrives in PRD 11)

## What to Build

### 1. Project scaffold

1. Create a Vite project: `npm create vite@latest svg-ai-institute -- --template react-ts`.
2. Install dependencies: `tailwindcss postcss autoprefixer`, `@supabase/supabase-js`, `react-router-dom`, `lucide-react`.
3. Enable TypeScript strict mode in `tsconfig.json` (`"strict": true`). No `any` without a `// reason:` comment.
4. Create this exact folder structure:

```
src/
  components/
    ui/            (Button, Card, Input, Badge, Spinner, EmptyState, PageHeader)
    layout/        (PublicLayout, AppLayout, Navbar, Sidebar, Footer)
  features/
    auth/          (SignInPage, AuthCallback, useAuth hook, ProtectedRoute)
    dashboard/     (DashboardPage placeholder)
  lib/
    supabase.ts    (client singleton)
    types.ts       (shared TS types: Profile, Role)
  styles/
    index.css      (Tailwind directives + font imports + CSS variables)
  App.tsx
  main.tsx
```

5. Create `.env.local` (gitignored) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Create `.env.example` with placeholder values, committed.

### 2. Design system — Tailwind theme

Implement the full token set in `tailwind.config.ts` under `theme.extend.colors`:

```ts
colors: {
  svgblue: {
    50:  '#F0F8FF',
    100: '#D6EBFA',
    500: '#0072C6',   // PRIMARY: buttons, links, active states
    700: '#0059A8',   // hover state of primary
    900: '#0B2540',   // deep navy: TEXT ONLY, never backgrounds
  },
  svggold: {
    100: '#FEF6D0',
    500: '#FCD116',   // accent: badges, streaks, highlights, celebration
    600: '#E0B500',
  },
  svggreen: {
    100: '#D9F2E2',
    500: '#009639',   // success, completion, deployed states
    700: '#007A2F',
  },
  surface: {
    page: '#FFFFFF',
    alt:  '#F5F9FC',
  },
  line: '#E2ECF4',
  ink: {
    DEFAULT: '#0B2540',
    muted:   '#5A7184',
  },
  danger:  '#D64545',
  warning: '#E8890C',
}
```

Also extend:

```ts
fontFamily: {
  heading: ['Sora', 'sans-serif'],
  body: ['Inter', 'sans-serif'],
},
borderRadius: { xl: '12px' },
boxShadow: { card: '0 2px 8px rgba(11,37,64,0.06)' },
```

In `styles/index.css`: import both Google Fonts, set `body { @apply bg-surface-page text-ink font-body; }`, set headings to `font-heading`.

**Usage rules (enforce in every component):**
- Page backgrounds alternate `surface-page` (white) and `svgblue-50`.
- Primary button: `bg-svgblue-500 text-white hover:bg-svgblue-700`.
- Success states: `svggreen-500`. Gamification/reward states: `svggold-500`.
- Body text `text-ink`, secondary text `text-ink-muted`. Never `text-black`, never gray-on-white below WCAG AA 4.5:1.
- Cards: `rounded-xl border border-line shadow-card`, white cards on `svgblue-50` sections and vice versa.
- All layouts mobile-first; verify at 375px width before desktop.

### 3. Brand motif — the V-diamond

The SVG flag carries green diamonds forming a V. Build one reusable component `DiamondMotif.tsx` in `components/ui/`: an SVG pattern of 3 rotated squares (diamonds) in `svggreen-500`, arranged in a V, rendered at low opacity (8-12%) as an absolutely-positioned decorative background element. It will be used in heroes and section dividers by later PRDs. Include a `size` and `opacity` prop.

### 4. Base UI components

Build these in `components/ui/`, each typed, each using only theme tokens:

1. **Button** — variants: `primary` (blue), `secondary` (white with blue border and blue text), `success` (green), `ghost`. Sizes `sm/md/lg`. Loading state with inline spinner. `rounded-xl`.
2. **Card** — white card with `border-line`, `shadow-card`, `rounded-xl`, optional `header` slot.
3. **Input** — label, input, error message slot. Focus ring `svgblue-500`. Error state uses `danger`.
4. **Badge** — variants: `blue`, `gold`, `green`, `neutral`. Pill shape.
5. **Spinner** — blue, three sizes.
6. **EmptyState** — icon (lucide), one-line message, optional action button. Every future empty screen uses this. No blank voids.
7. **PageHeader** — h1 (Sora 32px) + optional description + optional right-side action slot.

### 5. Supabase setup and auth

1. Create the Supabase project (manual step for Dom; document it in the README: create project, copy URL + anon key into `.env.local`, enable Email provider with magic link, disable password auth, set Site URL to the Vercel domain and `http://localhost:5173` in redirect allow-list).
2. `lib/supabase.ts`: export a single typed client created from the env vars. Throw a clear startup error if env vars are missing.
3. **Auth flow (magic link only, no passwords):**
   - `SignInPage` (`/signin`): centered Card on `svgblue-50` page with DiamondMotif background. One email Input + primary Button "Send me a sign-in link". On submit call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback' } })`. Show success state: "Check your email" with the address shown, and a resend link disabled for 30 seconds.
   - `AuthCallback` (`/auth/callback`): handles the session from the URL, then redirects to `/dashboard`. Show Spinner while processing; on failure show error with a link back to `/signin`.
   - `useAuth` hook: exposes `{ session, profile, role, loading, signOut }`. Subscribes to `supabase.auth.onAuthStateChange`. Fetches the profile row after session resolves.
4. **Profile auto-creation:** a Postgres trigger (schema below) inserts a `profiles` row on new auth user signup with default role `student`.

### 6. Routing and layouts

1. **PublicLayout:** top Navbar (logo text "SVG AI Institute" in Sora 700 svgblue-500, links: Home, Sign In) + Footer (white on svgblue-50, flag-colors accent bar: three thin stacked bars blue/gold/green, copyright line). Routes: `/` (placeholder home: PageHeader "Saint Vincent AI & Innovation Institute" + one-paragraph mission + primary Button "Apply — Coming Soon" disabled; full site arrives in PRD 01), `/signin`, `/auth/callback`.
2. **AppLayout (authenticated):** left Sidebar on desktop (collapses to bottom nav or hamburger at mobile widths) with nav items Dashboard and Sign Out, plus the user's name and a Badge showing their role. Main content area on `surface-page`.
3. **ProtectedRoute component:** wraps authenticated routes. While `loading`, render full-page Spinner. If no session, redirect to `/signin`. Accepts optional `allowedRoles: Role[]` prop; if the user's role is not allowed, render an EmptyState "You don't have access to this page" with a button to Dashboard.
4. **DashboardPage** (`/dashboard`): placeholder. PageHeader "Welcome, {first_name}" + three placeholder Cards ("Your Program", "Community", "Your Progress") each containing an EmptyState with copy "Coming soon in your program". Role badge visible. This page is replaced progressively by later PRDs.
5. 404 route: EmptyState with a button home.

### 7. Seed script

Create `supabase/seed.sql` inserting three test users' profiles (requires the users to exist in auth; document in README that Dom creates three auth users via the Supabase dashboard with emails `admin@test.local`, `instructor@test.local`, `student@test.local`, then runs the seed to set their roles to admin, instructor, student respectively via UPDATE on profiles).

### 8. README

Write `README.md`: project one-liner, prerequisites, Supabase setup steps (from 5.1), env vars, `npm install && npm run dev`, how to create the three test users, how to run migrations and seed. A new developer must be able to go zero-to-running from the README alone.

## Data / Schema

Full SQL, delivered as migration file `supabase/migrations/0000_foundation.sql`:

```sql
-- ============================================
-- PRD 00: Foundation — roles enum, profiles, RLS
-- ============================================

-- Role enum
create type public.user_role as enum ('student', 'instructor', 'admin', 'business_partner');

-- Profiles: one row per auth user
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  first_name  text,
  last_name   text,
  role        public.user_role not null default 'student',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helper: read the current user's role (used by all future RLS policies)
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins and instructors can read all profiles
create policy "profiles_select_staff"
  on public.profiles for select
  using (public.current_user_role() in ('admin', 'instructor'));

-- Users can update their own profile BUT NOT their role
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Only admins can update any profile including role changes
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- No client-side inserts (trigger handles creation) and no deletes from client
-- (intentionally no insert/delete policies)
```

Notes:
- `current_user_role()` is `security definer` so future RLS policies on other tables can call it without recursive policy problems. Every later PRD's policies use this helper; it is part of the platform's security foundation.
- The `profiles_update_own` policy explicitly prevents privilege escalation: a user cannot change their own role.

## Acceptance Criteria

Test every item by actually running the app. Do not mark this PRD complete on code review alone.

- [ ] `npm run dev` starts clean with zero TypeScript errors in strict mode
- [ ] Visiting `/` shows the placeholder home on a WHITE background with navy text, Sora headings, and the blue/gold/green footer bar. Nothing anywhere renders on a dark background
- [ ] All 7 base UI components exist, typed, and use only theme tokens (search the codebase: zero raw hex values inside `src/components` and `src/features`)
- [ ] DiamondMotif renders the green V-diamond pattern and accepts size/opacity props
- [ ] `/signin` sends a real magic link email; clicking it lands on `/auth/callback` then `/dashboard` with a live session
- [ ] Refreshing `/dashboard` keeps the session; Sign Out clears it and redirects to `/signin`
- [ ] Visiting `/dashboard` signed out redirects to `/signin`
- [ ] A new signup automatically gets a `profiles` row with role `student` (verify in Supabase table editor)
- [ ] The three seeded test users sign in and each sees their correct role Badge (admin, instructor, student)
- [ ] A signed-in student CANNOT update their own `role` via a direct Supabase update call (RLS blocks it); an admin CAN update another user's role
- [ ] A student cannot select other users' profile rows via the client; an instructor can
- [ ] Whole flow verified at 375px viewport width: sign in, dashboard, sidebar/nav collapse all usable
- [ ] README taken from a clean machine reaches a running app without outside help

## Hand-off Note

PRD 00 delivers the running skeleton: bright SVG design system as code, magic-link auth, roles with RLS, layouts, and protected routing. Everything is intentionally placeholder beyond that; the home page and dashboard get their real content in later PRDs.

Run this PRD first and verify every Acceptance Criteria checkbox by hand, especially the two RLS security checks. When it all passes, come back and request PRD 01 (Public Website). One PRD at a time, never in parallel.
