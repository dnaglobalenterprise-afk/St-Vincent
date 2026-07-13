# PRD 07 — Outcomes Board & Certificates

## Overview

This PRD turns verified capstones into public proof for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Three things are delivered:

1. **The public Outcomes Board** (`/outcomes`): a live, public grid of deployed student projects with headline stats (graduates, systems deployed, businesses served). This is the school's proof engine: marketing for the next cohort, portfolio for every graduate, and the single most persuasive artifact for the Government of SVG. It is linked from the home page, and the home page's hardcoded stats become live numbers.
2. **Showcase pages** (`/outcomes/:slug`): one public page per published project — student name, project type, the business it runs at, the story of what it does, and the walkthrough video. A graduate can put this URL on a CV, a WhatsApp status, or an Upwork profile.
3. **Graduation and certificates:** graduation is computed server-side (every required lesson complete + a verified capstone), flips the enrollment to `graduated`, and issues a certificate with a unique verification code, a public verification page (`/verify`), and a print-ready certificate page carrying the SVG flag design (blue, gold, green, V-diamond motif).

**Consent is sacred here.** A project only goes public with BOTH the business's consent (collected at registration) and the student's explicit approval of their own showcase page. Nobody gets published by surprise, and published entries carry denormalized copies of the public fields so the public pages never query private tables.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. The Outcomes Board and certificate are the two most brand-saturated surfaces in the product: blue, gold, green, diamonds, celebration.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `react-markdown`
- **Styling:** Tailwind CSS with the platform theme tokens (restated below); print stylesheet for the certificate
- **Backend:** Supabase — Postgres with RLS, security-definer RPCs for consent, publishing, graduation, and public verification
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components including DiamondMotif; `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member()`, `set_updated_at()`; tables `enrollments` (status enum includes `graduated`), `cohorts`, `rooms`, `courses`, `modules`, `lessons`, `lesson_progress`, `capstone_projects` (status includes `verified`), `business_partners`; the public site with its stats band; the student capstone hub `/learn/capstone`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

This PRD's signature element: the green **DEPLOYED** Badge (svggreen-500, white text, check icon) on every showcase card and page.

## What to Build

### 1. Student — showcase approval (capstone hub extension)

When a student's capstone reaches `verified`, the capstone hub's celebration Card gains a **"Prepare your showcase page"** flow:
1. Preview step: the page as it will appear publicly — first name + last initial (e.g. "Keisha B."), project type Badge, business name and island, narrative (pre-filled from their evidence narrative, editable here, min 150 chars), video embed, DEPLOYED badge. Optional: a photo upload (their headshot or a photo of the system in action; reuse the submissions bucket pattern, 1 file, 10 MB, images only).
2. Consent step: checkbox "I approve this page appearing publicly on the SVG AI Institute Outcomes Board and understand I can request removal at any time." → **Approve my showcase** (primary).
3. Approved state: "Waiting for publication" note. Once staff publish: green state with the live URL, a copy button, and share buttons (WhatsApp share deep link `https://wa.me/?text=...` with the URL, and copy-for-LinkedIn).
A student may decline; nothing publishes, graduation is unaffected.

### 2. Staff — showcase curation `/admin/showcase`

ProtectedRoute `allowedRoles: ['admin','instructor']` (publish button admin-only).
- Queue tabs: Awaiting student approval / Ready to publish / Published / Declined.
- Entry detail: full preview exactly as public, edit controls for headline and narrative typo-fixes (edits before publish only), slug editor (auto-generated `keisha-b-whatsapp-bot-bequia`, editable, unique), and **Publish** (admin; confirm dialog listing the two consents it verified) / **Unpublish** (admin; immediate, for removal requests — honoring the student consent promise).
- Publishing denormalizes the public fields into the entry row (section: schema) so `/outcomes` reads exactly one table.

### 3. Public — Outcomes Board `/outcomes`

Public route on the marketing site nav ("Outcomes").
1. **Hero:** headline "Real systems. Real businesses. Real proof." + DiamondMotif; subline explaining every entry is instructor-verified and consent-published.
2. **Live stats band** (three Cards, Sora 700 numbers): Graduates (count of graduated enrollments), Systems deployed (published entries), Businesses served (distinct businesses among published entries). Served by the public stats RPC.
3. **Showcase grid:** Cards — photo (or a branded placeholder with the diamond motif), student display name, DEPLOYED badge, project type Badge (WhatsApp Bot / Automation / Voice Agent), business name + island, one-line headline. Filters: project type, island. Newest first. Empty state (pre-first-graduate): "Cohort 1 is building right now. The first deployed systems land here soon." with the application CTA — the board must look intentional even when empty.
4. Each card links to the showcase page.
5. **Home page integration:** replace the hardcoded stats band numbers with the live stats RPC (fall back to the static copy if the count is zero), and add an "Outcomes" section teasing the three newest published entries when any exist.

### 4. Public — showcase page `/outcomes/:slug`

- Header: student display name + DEPLOYED badge + project type Badge.
- Business line: "Built for {business name}, {island}".
- Video embed (YouTube/Loom URL → responsive embed; otherwise a prominent link button).
- Narrative (markdown), photo if provided.
- Footer CTA band (blue→green gradient): "Want to build things like this? Applications are open." → `/apply`; plus "Own a business? Get one built for you." → `/businesses`.
- SEO: unique title "{Student} built a {type} for {business} — SVG AI Institute", meta description from the headline, OG image = photo or brand default.

### 5. Graduation

1. **Server-side requirement check** (single source of truth, function `is_graduation_eligible(user_id)`): the student has an `active` enrollment AND every required published lesson in their room's published course is complete AND they have at least one `verified` capstone.
2. **Staff roster** `/teach/cohorts/:id/roster` (staff): table of the cohort's students — name, progress % (required lessons), capstone status Badge, eligibility check icon, and a **Graduate** button per eligible row (admin and instructor allowed). Bulk "Graduate all eligible" with confirm.
3. **`graduate_student` RPC:** validates eligibility server-side (never trusts the UI), flips the enrollment to `graduated`, and issues the certificate (unique 10-char code, same unambiguous alphabet as application ref codes). Idempotent: re-calls return the existing certificate.
4. **Student experience:** on graduation, the dashboard gains a gold-bordered Card: "You graduated 🎓" with certificate + showcase links; the `/learn` header shows a green Graduate Badge. Gold confetti on first render.

### 6. Certificate

1. **Certificate page** `/certificates/:code` (public): an A4-landscape-proportioned rendered certificate — white background; triple border in blue/gold/green; DiamondMotif watermark; "Saint Vincent AI & Innovation Institute"; "Certificate of Completion"; student full name (Sora 700, large); program name ("School of AI Automation — 8-Week Program"); cohort name and completion date; the verification code and short URL (`/verify`) printed at the foot; signature line "Dom Cortez, Founder". Print stylesheet: `@media print` strips nav/footer/buttons, locks A4 landscape margins. On-screen: a "Download / Print" primary button triggering `window.print()`.
2. **Verification page** `/verify` (public): single input for the code → `verify_certificate` RPC → success Card (green): "Valid certificate" with holder name, program, cohort, issue date; or neutral "No certificate found for that code." This is the anti-fraud answer for any employer.

### 7. Seed additions

Seed: mark the test student's seeded capstone `verified`; create an approved+published showcase entry for it (consented, denormalized, slug set) and complete their required lessons so one graduated enrollment with a certificate exists. The Outcomes Board, showcase page, certificate, and verify flow all render with real data immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0007_outcomes_certificates.sql`. Existing objects used, not modified: `profiles`, roles, helpers, `enrollments` (its `enrollment_status` enum already contains `graduated`), `capstone_projects`, `business_partners`, `lesson_progress`, `lessons`, `modules`, `courses`, `cohorts`.

```sql
-- ============================================
-- PRD 07: Showcase entries, certificates, graduation
-- ============================================

create type public.showcase_status as enum
  ('awaiting_student', 'approved', 'published', 'declined');

create table public.showcase_entries (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null unique references public.capstone_projects(id),
  status          public.showcase_status not null default 'awaiting_student',
  slug            text unique,
  headline        text,
  narrative       text,
  photo_path      text,
  student_consent boolean not null default false,
  consented_at    timestamptz,
  -- Denormalized PUBLIC fields (filled at publish; public pages read ONLY these)
  display_name    text,   -- "Keisha B."
  project_type    public.capstone_type,
  business_name   text,
  island          text,
  video_url       text,
  published_at    timestamptz,
  published_by    uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger showcase_entries_updated_at before update on public.showcase_entries
  for each row execute function public.set_updated_at();

create table public.certificates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id),
  code        text not null unique,
  issued_at   timestamptz not null default now(),
  issued_by   uuid not null references public.profiles(id),
  unique (user_id, cohort_id)
);

-- ============================================
-- Functions
-- ============================================

-- Auto-create the showcase shell when a capstone is verified
create or replace function public.handle_capstone_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    insert into public.showcase_entries (project_id, narrative, video_url)
      values (new.id, new.narrative, new.video_url)
      on conflict (project_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger capstone_verified_showcase
  after update on public.capstone_projects
  for each row execute function public.handle_capstone_verified();

-- Student approves their showcase (consent + editable narrative/photo)
create or replace function public.approve_showcase(
  p_entry_id uuid, p_narrative text, p_photo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select se.*, cp.user_id as student_id into e
    from public.showcase_entries se
    join public.capstone_projects cp on cp.id = se.project_id
    where se.id = p_entry_id for update;
  if e is null or e.student_id <> auth.uid() then raise exception 'forbidden'; end if;
  if e.status not in ('awaiting_student','declined') then raise exception 'invalid_state'; end if;
  if coalesce(length(trim(p_narrative)),0) < 150 then raise exception 'narrative_too_short'; end if;
  update public.showcase_entries
    set status='approved', student_consent=true, consented_at=now(),
        narrative=trim(p_narrative), photo_path=nullif(p_photo_path,'')
    where id = p_entry_id;
end;
$$;
grant execute on function public.approve_showcase(uuid, text, text) to authenticated;

create or replace function public.decline_showcase(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select se.*, cp.user_id as student_id into e
    from public.showcase_entries se
    join public.capstone_projects cp on cp.id = se.project_id
    where se.id = p_entry_id for update;
  if e is null or e.student_id <> auth.uid() then raise exception 'forbidden'; end if;
  if e.status = 'published' then raise exception 'contact_staff_to_unpublish'; end if;
  update public.showcase_entries
    set status='declined', student_consent=false where id = p_entry_id;
end;
$$;
grant execute on function public.decline_showcase(uuid) to authenticated;

-- Admin publishes: verifies both consents, denormalizes public fields
create or replace function public.publish_showcase(p_entry_id uuid, p_slug text, p_headline text)
returns void language plpgsql security definer set search_path = public as $$
declare e record; pr record; b record; stu record;
begin
  if public.current_user_role() <> 'admin' then raise exception 'forbidden'; end if;
  select * into e from public.showcase_entries where id = p_entry_id for update;
  if e is null or e.status <> 'approved' or not e.student_consent then
    raise exception 'invalid_state';
  end if;
  select * into pr from public.capstone_projects where id = e.project_id;
  if pr.status <> 'verified' then raise exception 'capstone_not_verified'; end if;
  select * into b from public.business_partners where id = pr.business_id;
  if not b.consent then raise exception 'business_consent_missing'; end if;
  select * into stu from public.profiles where id = pr.user_id;
  if p_slug !~ '^[a-z0-9-]{5,80}$' then raise exception 'bad_slug'; end if;
  update public.showcase_entries set
    status='published', slug=p_slug,
    headline=coalesce(nullif(trim(p_headline),''), headline),
    display_name = stu.first_name || ' ' || left(coalesce(stu.last_name,''),1) || '.',
    project_type = pr.type,
    business_name = b.name,
    island = b.island,
    video_url = pr.video_url,
    published_at = now(), published_by = auth.uid()
    where id = p_entry_id;
end;
$$;
grant execute on function public.publish_showcase(uuid, text, text) to authenticated;

create or replace function public.unpublish_showcase(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'admin' then raise exception 'forbidden'; end if;
  update public.showcase_entries set status='approved', published_at=null
    where id = p_entry_id and status='published';
end;
$$;
grant execute on function public.unpublish_showcase(uuid) to authenticated;

-- Graduation eligibility: single source of truth
create or replace function public.is_graduation_eligible(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.enrollments e where e.user_id = p_user_id and e.status = 'active')
    and exists (select 1 from public.capstone_projects cp
                where cp.user_id = p_user_id and cp.status = 'verified')
    and not exists (
      select 1
      from public.enrollments e
      join public.cohorts co on co.id = e.cohort_id
      join public.courses c on c.room_id = co.room_id and c.status = 'published'
      join public.modules m on m.course_id = c.id
      join public.lessons l on l.module_id = m.id and l.required and l.published
      where e.user_id = p_user_id and e.status = 'active'
        and not exists (select 1 from public.lesson_progress lp
                        where lp.lesson_id = l.id and lp.user_id = p_user_id)
    );
$$;

-- Certificate code generator
create or replace function public.generate_cert_code()
returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := '';
    for i in 1..10 loop
      code := code || substr(chars, 1 + floor(random()*length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.certificates where code = code);
  end loop;
  return code;
end;
$$;

-- Graduate: validates, flips enrollment, issues certificate (idempotent)
create or replace function public.graduate_student(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_enrollment record; v_code text;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select c.code into v_code from public.certificates c
    join public.enrollments e on e.cohort_id = c.cohort_id and e.user_id = c.user_id
    where c.user_id = p_user_id and e.status = 'graduated' limit 1;
  if v_code is not null then return v_code; end if;   -- idempotent
  if not public.is_graduation_eligible(p_user_id) then raise exception 'not_eligible'; end if;
  select * into v_enrollment from public.enrollments
    where user_id = p_user_id and status = 'active' limit 1 for update;
  update public.enrollments set status='graduated' where id = v_enrollment.id;
  v_code := public.generate_cert_code();
  insert into public.certificates (user_id, cohort_id, code, issued_by)
    values (p_user_id, v_enrollment.cohort_id, v_code, auth.uid());
  return v_code;
end;
$$;
grant execute on function public.graduate_student(uuid) to authenticated;

-- Public verification (limited fields only)
create or replace function public.verify_certificate(p_code text)
returns table (holder_name text, cohort_name text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.first_name || ' ' || coalesce(p.last_name,''), co.name, c.issued_at
  from public.certificates c
  join public.profiles p on p.id = c.user_id
  join public.cohorts co on co.id = c.cohort_id
  where upper(c.code) = upper(trim(p_code));
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Public outcomes stats
create or replace function public.get_outcome_stats()
returns table (graduates int, deployed int, businesses int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.enrollments where status='graduated'),
    (select count(*)::int from public.showcase_entries where status='published'),
    (select count(distinct business_name)::int from public.showcase_entries where status='published');
$$;
grant execute on function public.get_outcome_stats() to anon, authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.showcase_entries enable row level security;
alter table public.certificates enable row level security;

-- Published entries are public; the student sees their own; staff see all
create policy "showcase_select_published" on public.showcase_entries for select
  to anon, authenticated using (status = 'published');
create policy "showcase_select_own" on public.showcase_entries for select
  using (exists (select 1 from public.capstone_projects cp
                 where cp.id = showcase_entries.project_id
                   and cp.user_id = auth.uid()));
create policy "showcase_select_staff" on public.showcase_entries for select
  using (public.is_staff());
create policy "showcase_update_staff_prepublish" on public.showcase_entries for update
  using (public.is_staff() and status <> 'published')
  with check (public.is_staff());
-- All state transitions flow through the RPCs above.

-- Certificates: own + staff via table; public via the verify RPC only
create policy "certificates_select_own" on public.certificates for select
  using (user_id = auth.uid());
create policy "certificates_select_staff" on public.certificates for select
  using (public.is_staff());
```

Public-read note: `/outcomes` and `/outcomes/:slug` must query ONLY `showcase_entries` (published rows) and the two public RPCs. Never join profiles, capstone_projects, or business tables from public pages; every public field is denormalized at publish time by design.

## Acceptance Criteria

Verify by hand across all four actors (public visitor, student, instructor, admin), including at 375px.

- [ ] Verifying a capstone auto-creates the showcase shell (trigger proven)
- [ ] Student preview shows exactly the public rendering; approval requires the consent checkbox and 150-char narrative; decline works and blocks publication
- [ ] Admin publish is blocked until student consent exists and slug validates; instructor cannot publish (RPC `forbidden`)
- [ ] Published entry appears on `/outcomes` with correct denormalized fields; the network payload for public pages contains NO emails, NO WhatsApp numbers, NO user ids beyond the entry itself
- [ ] Unpublish removes it from the board immediately (student removal promise honored)
- [ ] Board filters work; empty state renders intentionally when nothing is published (test with seed unpublished)
- [ ] Showcase page renders video embed, narrative, CTAs, and unique SEO tags; slug 404s cleanly for unknown values
- [ ] Home page stats are live via `get_outcome_stats` and the three-newest teaser appears when entries exist
- [ ] Roster shows progress %, capstone status, and eligibility correctly; Graduate is disabled for ineligible students
- [ ] `graduate_student` on an ineligible student raises `not_eligible` even when called from the console; on an eligible one it flips the enrollment, issues a certificate, and re-calling returns the same code (idempotency proven)
- [ ] Graduated student sees the gold dashboard card, certificate link, and Graduate badge with confetti once
- [ ] Certificate page renders the SVG-flag design, prints cleanly to A4 landscape (test an actual print-to-PDF), and shows the code + verify URL
- [ ] `/verify` returns holder, cohort, and date for a real code; garbage codes return the not-found state; the RPC exposes nothing else
- [ ] A student cannot read another student's certificate rows; anon cannot select unpublished showcase entries (RLS proven)
- [ ] Every surface bright and celebratory; DEPLOYED badges green; certificate borders blue/gold/green with the diamond watermark

## Hand-off Note

PRD 07 completes the proof engine: verified work becomes consented public showcase pages, a living Outcomes Board with real stats, and fraud-checkable certificates, with graduation computed from a single server-side source of truth. The board is deliberately safe to put in front of a ministry: every entry is instructor-tested and double-consented.

Run this PRD end-to-end from verify → approve → publish → graduate → print the certificate → verify the code, plus the console-level eligibility attack, before moving on. Next in sequence: PRD 08 — Community.
