# PRD 02 — Admissions System

## Overview

This PRD builds the complete admissions pipeline for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses. Admission is by application, not payment; scarcity comes from selection.

Delivered here: the real application form (replacing the `/apply` placeholder page), an application reference-code system so applicants can check their status without an account, the admin review queue with scoring and decisions (accept / waitlist / decline), cohort creation and management, automatic account invitation and enrollment on acceptance, and full database schema with Row Level Security.

Flow in one line: visitor applies (no account) → admin reviews and scores → on accept, the system invites them by email (Supabase magic invite), creates their account, and enrolls them in a cohort → they sign in and land on the student dashboard.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, Auth (magic link / invite emails via Supabase built-in), one Edge Function (Deno) using the service-role key for acceptance
- **Fonts:** Sora (headings), Inter (body)
- **Existing foundation this PRD builds on:** app shell and layouts, Button/Card/Input/Badge/Spinner/EmptyState/PageHeader/DiamondMotif components, `profiles` table with roles (student, instructor, admin, business_partner), `current_user_role()` SQL helper, ProtectedRoute with `allowedRoles`, Supabase client at `src/lib/supabase.ts`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

Status color mapping for this PRD: submitted = blue Badge, under_review = gold Badge, accepted = green Badge, waitlisted = warning Badge, declined = neutral Badge.

## What to Build

### 1. Application form — replaces `/apply`

Public route, no auth. Multi-step form (3 steps, progress bar in svgblue-500, step circles gold when complete). Card layout, max-w-xl, DiamondMotif background at low opacity.

**Step 1 — About you:** First name*, Last name*, Email*, WhatsApp number*, Date of birth* (date input; compute age; must be 18-30 inclusive at submission — show inline error "This program is for ages 18-30" otherwise and block submit), Community/Town*, Country* (select, default "Saint Vincent and the Grenadines"; if another country chosen show info note "Cohort 1 prioritizes SVG residents; diaspora applications are waitlisted by default").

**Step 2 — Readiness:** Device access* (radio: Laptop / Desktop / Phone only / Shared computer), Internet reliability* (radio: Reliable / Sometimes drops / Unreliable), Weekly hours you can commit* (radio: Under 5 / 5-8 / 8-10 / 10+; the program needs 8-10), Current situation* (select: Student, Employed, Self-employed, Unemployed, Other).

**Step 3 — Motivation:** "Why do you want to join?"* (textarea, min 200 chars, live counter), "Tell us about something you finished that you're proud of"* (textarea, min 100 chars — this is the finisher signal), "How did you hear about us?" (select: WhatsApp, Facebook, Instagram, Friend/Family, News, Other), Commitment checkbox*: "I understand this is an 8-week program requiring 8-10 hours per week and a real deployed project to graduate."

Validation: client-side per step; cannot advance with errors; email format validated; trim/lowercase email. On submit, insert into `applications`. Handle duplicate email (unique violation 23505) with a friendly Card: "You've already applied. Check your status below" linking to the status page.

**Success screen:** green Card with check icon, "Application received." Display the reference code (`ref_code`, e.g. SVG-4F7K2) in large Sora type with a copy button, and the line "Save this code. Use it with your email to check your status." Link to `/apply/status`.

### 2. Status check page — `/apply/status`

Public, no auth. Small Card: Email* + Reference code* inputs, primary button "Check Status". Calls the `check_application_status` RPC (defined in schema; security definer so the table stays unreadable to the public). Renders result states:
- **submitted / under_review:** blue/gold Badge + "Your application is in review. We'll email you when there's a decision."
- **accepted:** green celebration Card: "You're in. Check your email for your sign-in invitation." (gold confetti moment allowed)
- **waitlisted:** warning Badge + "You're on the waitlist for this cohort. If a seat opens, we'll email you."
- **declined:** neutral, kind copy: "We couldn't offer you a seat this cohort. You're welcome to apply again next cohort."
- **not found:** EmptyState "No application matches that email and code."

### 3. Admin — Cohorts management `/admin/cohorts`

ProtectedRoute `allowedRoles: ['admin']`. PageHeader "Cohorts" with right-side action "New Cohort".
- **Create/edit cohort modal:** Name* (e.g. "Cohort 1 — 2026"), Start date*, End date*, Capacity* (number, default 30), Status (select: draft, open, running, completed).
- **Cohort list:** Cards showing name, dates, status Badge, and enrollment count vs capacity as a progress bar (green fill; turns gold at 90%+ full).
- Only admins see this page.

### 4. Admin — Applications review queue `/admin/applications`

ProtectedRoute `allowedRoles: ['admin', 'instructor']` (instructors can review/score; only admins can decide).

- **Queue table/list:** columns Name, Age, Community, Hours committed, Device, Status Badge, Score, Submitted date. Filters: status (all/submitted/under_review/accepted/waitlisted/declined), search by name/email. Sort by submitted date (default oldest first) and score. Mobile: rows collapse to Cards.
- **Detail drawer/page** on row click, showing every application field cleanly grouped (About / Readiness / Motivation), plus:
  - **Review panel:** Score (1-5 star or segmented control), Notes (textarea). Saving writes to review fields and flips status `submitted → under_review` if untouched. Show reviewer name + time of last review.
  - **Red-flag chips** auto-computed and displayed (not blocking, just signal): hours committed "Under 5" or "5-8" → chip "Low hours"; internet "Unreliable" → chip "Connectivity risk"; device "Phone only" → chip "Device risk"; country ≠ SVG → chip "Diaspora".
  - **Decision buttons (admins only):** Accept (opens cohort picker: select an open cohort with remaining capacity, confirm) · Waitlist · Decline. Waitlist/Decline set status immediately with a confirm dialog. Decline requires a one-line internal reason (stored, never shown to applicant).
- **Accept action** calls the Edge Function `accept-applicant` (section 5). On success, show green toast "Accepted, invited, and enrolled." The applicant row updates to accepted with the cohort name shown.
- Capacity guard: cohorts at capacity are disabled in the picker with label "(full)".

### 5. Edge Function — `accept-applicant`

Supabase Edge Function (Deno, service-role key from env; never shipped to client).

Input: `{ application_id, cohort_id }` with the caller's JWT forwarded.
Steps, in order, transactional in spirit (verify each before proceeding, and make the function idempotent):
1. Verify the caller's JWT resolves to a profile with role `admin`; otherwise 403.
2. Load the application; must exist and not already be `accepted`; load the cohort; must be status `open` or `draft` and have `enrolled_count < capacity` (count from enrollments).
3. Check whether an auth user already exists for the applicant email (admin listUsers by email). If not, call `auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL + '/auth/callback' })` — Supabase sends the invitation email with a magic sign-in link. The existing profile-creation trigger from the foundation gives them a `profiles` row with role `student`.
4. Upsert `first_name`/`last_name` onto the profile from the application.
5. Insert `enrollments` row (`cohort_id`, `user_id`, status `active`); unique constraint makes re-runs safe.
6. Update the application: status `accepted`, `decided_at`, `decided_by`, `cohort_id`.
7. Return `{ ok: true }`; the client refreshes the queue.

Failure handling: every step returns a specific error message surfaced in an admin toast (danger). If invite succeeded but a later step failed, re-running the function must repair state, not duplicate it.

### 6. Student dashboard update

On `/dashboard`, if the signed-in user has an `active` enrollment, replace the "Your Program" placeholder Card content with: cohort name, start date, days-until-start countdown (or "In progress — Week N" once started, computed from start date), and a green Badge "Enrolled". If no enrollment exists (e.g. staff, or a stray account), keep the existing EmptyState.

### 7. Waitlist promotion

In the applications queue, filter status = waitlisted. The Accept button works identically from waitlisted state (same Edge Function). No separate mechanism needed; document in the admin UI with a hint line: "To promote from the waitlist, open the application and Accept."

## Data / Schema

Full SQL, migration `supabase/migrations/0002_admissions.sql`. Existing objects from the foundation (`profiles`, `user_role` enum, `current_user_role()`, `set_updated_at()`) are used, not modified. `current_user_role()` returns the signed-in user's role.

```sql
-- ============================================
-- PRD 02: Admissions — cohorts, applications, enrollments
-- ============================================

create type public.application_status as enum
  ('submitted', 'under_review', 'accepted', 'waitlisted', 'declined');

create type public.cohort_status as enum
  ('draft', 'open', 'running', 'completed');

create type public.enrollment_status as enum
  ('active', 'withdrawn', 'graduated');

-- Cohorts (room linkage arrives in the Rooms PRD via ALTER TABLE)
create table public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  capacity    int  not null default 30 check (capacity > 0),
  status      public.cohort_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger cohorts_updated_at before update on public.cohorts
  for each row execute function public.set_updated_at();

-- Applications (submitted anonymously; no auth account required)
create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  ref_code         text not null unique,
  status           public.application_status not null default 'submitted',
  -- Step 1
  first_name       text not null,
  last_name        text not null,
  email            text not null unique,
  whatsapp         text not null,
  date_of_birth    date not null,
  community        text not null,
  country          text not null default 'Saint Vincent and the Grenadines',
  -- Step 2
  device_access    text not null,   -- 'laptop' | 'desktop' | 'phone_only' | 'shared'
  internet         text not null,   -- 'reliable' | 'sometimes' | 'unreliable'
  weekly_hours     text not null,   -- 'under_5' | '5_8' | '8_10' | '10_plus'
  situation        text not null,
  -- Step 3
  motivation       text not null,
  finisher_story   text not null,
  heard_from       text,
  committed        boolean not null default false,
  -- Review & decision
  score            int check (score between 1 and 5),
  review_notes     text,
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  decline_reason   text,
  decided_by       uuid references public.profiles(id),
  decided_at       timestamptz,
  cohort_id        uuid references public.cohorts(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Reference code generator: SVG- + 5 unambiguous chars
create or replace function public.generate_ref_code()
returns trigger language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text := '';
  i int;
begin
  loop
    code := 'SVG-';
    for i in 1..5 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.applications where ref_code = code);
  end loop;
  new.ref_code := code;
  return new;
end;
$$;
create trigger applications_ref_code before insert on public.applications
  for each row execute function public.generate_ref_code();

-- Enrollments
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      public.enrollment_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (cohort_id, user_id)
);

-- Public status check without exposing the table
create or replace function public.check_application_status(p_email text, p_ref_code text)
returns table (status public.application_status, first_name text)
language sql stable security definer set search_path = public
as $$
  select a.status, a.first_name
  from public.applications a
  where lower(a.email) = lower(trim(p_email))
    and upper(a.ref_code) = upper(trim(p_ref_code));
$$;
grant execute on function public.check_application_status(text, text) to anon, authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.cohorts enable row level security;
alter table public.applications enable row level security;
alter table public.enrollments enable row level security;

-- Cohorts: staff read; admin write; enrolled students may read their own cohort
create policy "cohorts_select_staff" on public.cohorts for select
  using (public.current_user_role() in ('admin','instructor'));
create policy "cohorts_select_enrolled" on public.cohorts for select
  using (exists (select 1 from public.enrollments e
                 where e.cohort_id = cohorts.id and e.user_id = auth.uid()));
create policy "cohorts_insert_admin" on public.cohorts for insert
  with check (public.current_user_role() = 'admin');
create policy "cohorts_update_admin" on public.cohorts for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Applications: anonymous insert only; staff read; staff update (review);
-- decisions to accepted happen via the service-role Edge Function
create policy "applications_insert_public" on public.applications for insert
  to anon, authenticated with check (true);
create policy "applications_select_staff" on public.applications for select
  using (public.current_user_role() in ('admin','instructor'));
create policy "applications_update_staff" on public.applications for update
  using (public.current_user_role() in ('admin','instructor'))
  with check (public.current_user_role() in ('admin','instructor'));
-- No public select (status flows through the RPC only). No deletes.

-- Enrollments: students read their own; staff read all; writes via Edge Function
-- (service role bypasses RLS) and admin client-side for corrections
create policy "enrollments_select_own" on public.enrollments for select
  using (user_id = auth.uid());
create policy "enrollments_select_staff" on public.enrollments for select
  using (public.current_user_role() in ('admin','instructor'));
create policy "enrollments_insert_admin" on public.enrollments for insert
  with check (public.current_user_role() = 'admin');
create policy "enrollments_update_admin" on public.enrollments for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
```

Security notes:
- The public can insert applications and nothing else; the table is unreadable to anon (status checks go through the security-definer RPC requiring email + ref code together).
- Instructors can review and score but the accepted decision path requires the admin-gated Edge Function.
- The RPC returns only status and first name, never the full row.

## Acceptance Criteria

Verify by hand in the running app, including at 375px.

- [ ] `/apply` shows the 3-step form; each step blocks advance on invalid input; age outside 18-30 blocks submission with the inline message
- [ ] Successful submit stores the row, shows the success screen with a copyable SVG-XXXXX code
- [ ] Duplicate email application shows the friendly already-applied Card, not an error
- [ ] `/apply/status` returns correct states for all five statuses and not-found; wrong code with right email returns not-found
- [ ] Anonymous client cannot select from `applications` directly (RLS verified in console)
- [ ] Admin can create a cohort; capacity progress bar renders; instructor cannot see `/admin/cohorts`
- [ ] Queue lists applications with working filters, search, and sort; red-flag chips appear per the rules
- [ ] Instructor can score and note (status flips to under_review); instructor does NOT see decision buttons
- [ ] Admin Accept flow: cohort picker excludes full cohorts; on confirm the Edge Function invites the email, creates the profile (role student), inserts the enrollment, and marks the application accepted — verify all four effects in the dashboard/table editor
- [ ] The invited applicant receives the email, signs in via the link, and `/dashboard` shows their cohort Card with countdown and Enrolled badge
- [ ] Re-running Accept on the same application does not create duplicates (idempotency verified)
- [ ] Waitlist and Decline set statuses; declined requires an internal reason; the status page reflects each within one refresh
- [ ] A non-admin calling the Edge Function directly gets a 403
- [ ] Accepting into a full cohort is blocked with a clear error
- [ ] Every admissions screen is bright (white/svgblue-50), status Badges use the mapped colors, all flows usable at 375px

## Hand-off Note

PRD 02 completes the front door: applications in, reviewed, decided, invited, enrolled. Cohorts exist but are not yet linked to rooms; the next PRD (Rooms & Course Engine) adds that linkage with an ALTER TABLE and restates the cohorts schema in full.

Run this PRD, verify the whole accept path end-to-end with a real email you control, and confirm the idempotency and 403 checks before moving on. Next in sequence: PRD 03 — Rooms & Course Engine.
