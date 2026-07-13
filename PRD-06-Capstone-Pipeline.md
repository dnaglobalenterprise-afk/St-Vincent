# PRD 06 — Capstone Pipeline

## Overview

This PRD builds the differentiator of the Saint Vincent AI & Innovation Institute (SVG AI Institute): the Capstone Pipeline. The school's promise is that a graduate does not leave with a certificate; they leave with a **verified, deployed system running at a real SVG business**. This PRD is that promise as software. It must never be cut or simplified away.

The pipeline: local businesses register to receive a free build → admin approves them into the directory → when a student reaches capstone eligibility, they browse the directory and request a match (or propose their own business, or staff assigns one) → staff approves the match → the student builds one of three project types (WhatsApp bot, workflow automation, or AI voice agent) → the student submits deployment evidence (video walkthrough + live proof) → an instructor verifies against a checklist, with a coaching loop → the capstone becomes **verified**. Verified capstones are the raw material for the public Outcomes Board and certificates, which the next PRD publishes.

Also delivered: the full public business registration form (upgrading the interest-capture-only page), the admin business approval queue, optional business-partner accounts (role exists already) so an owner can follow their project's status, match capacity controls so ten students don't pile onto one guesthouse, and contact-detail protection so business owners' WhatsApp numbers are revealed only to their matched student and staff.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. "Verified" and "Deployed" are always green; the capstone hub is the most celebratory surface in the app.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `react-markdown`
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, security-definer RPCs for every state transition, one Edge Function for partner-account invites
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components; `profiles` + roles including `business_partner`; helpers `current_user_role()`, `is_staff()`, `is_room_member(room_id)`, `is_module_unlocked(module_id)`, `set_updated_at()`; tables `rooms`, `cohorts`, `enrollments`, `courses`, `modules`, `lessons`, `interest_signups`; the public site `/businesses` page; the admissions Edge Function pattern for admin-gated invites

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

Status mapping: business pending = gold · business approved = green · match requested = blue · matched/in progress = blue · evidence submitted = gold "In verification" · changes requested = warning · **verified = green with gold celebration**.

## What to Build

### 1. Public business registration — `/businesses/register`

Public route, no auth, linked prominently from the existing `/businesses` page ("Register your business" primary button; the lightweight interest form remains for the hesitant).

Form (Card, max-w-xl): Business name*, Business type* (select: Tourism/Guesthouse, Restaurant/Bar, Retail, Tours & Transport, Services, Agriculture, Other), Community/Town*, Island (select: St. Vincent, Bequia, Union Island, Canouan, Mustique, Mayreau, Other Grenadines), Contact name*, Email*, WhatsApp number*, "What eats your time or loses you customers?"* (textarea, min 100 chars — this becomes the project brief seed), "Anything students should know?" (optional), Consent checkbox*: "I agree to a short discovery chat with a matched student and, if I approve the finished project, to it appearing on the public Outcomes Board."

On submit: insert into `business_partners` (status `pending`). Success Card: "Thank you. We review every business and reach out on WhatsApp." Duplicate email → friendly already-registered state.

### 2. Admin — business approval queue `/admin/businesses`

ProtectedRoute `allowedRoles: ['admin']`.
1. Tabs: Pending / Approved / Archived. Cards: business name, type Badge, island, contact name, submitted date, pain-point preview.
2. Detail drawer: all fields, plus admin controls — **Approve** (sets approved; sets Capacity, default 1, max 3: how many concurrent student projects this business can host), **Archive** (with internal reason), edit fields (typo cleanup).
3. **Convert from interest:** a sub-tab listing `interest_signups` where `audience='business'`, each with a "Start registration" action that opens the registration form pre-filled for admin completion (marks the signup consumed via a `converted` flag column added to that table).
4. **Invite owner account** (optional, per approved business): button calls the `invite-business-owner` Edge Function → Supabase invite email → new auth user gets role `business_partner` and is linked as `owner_user_id`. Idempotent; shows "Owner account active" once claimed.

### 3. Business partner portal — `/partner`

ProtectedRoute `allowedRoles: ['business_partner']`. Single page, deliberately simple:
- Their business Card (fields read-only except WhatsApp and pain point, which they may update).
- Project status list: each matched project shows student first name, project type Badge, status timeline (matched → building → in verification → verified), and the student's evidence video link once verified. No student contact details are shown here; coordination happens on WhatsApp after the match email/handshake.

### 4. Student — capstone hub `/learn/capstone`

The student's mission control for Weeks 7-8. Access: any room member can view; actions unlock with eligibility.

1. **Eligibility gate:** capstone actions (browse/request/propose) unlock when the room's first capstone module is unlocked for the student (modules gain an `is_capstone` flag; the Week 7 module carries it — this reuses the existing server-side `is_module_unlocked` logic). Before eligibility: a bright progress Card "The capstone unlocks when you complete Week 6" with their progress bar. Staff bypass.
2. **Browse businesses:** grid of approved businesses WITH remaining capacity: name, type Badge, island, pain point. NO contact details at this stage. Filters: type, island. Each card: "Request this match".
3. **Request match modal:** project type* (radio: WhatsApp bot / Workflow automation / AI voice agent), pitch* ("What would you build for them?", min 100 chars). Submits via RPC; one live capstone per student enforced server-side (a pending request counts as live).
4. **Propose your own business:** form mirroring the public registration (student fills it on the business's behalf, plus their pitch). Creates a `pending` business flagged `proposed_by` + a match request contingent on admin approval of the business. UI explains staff will vet it first.
5. **My capstone** (once requested/matched): status timeline component (5 steps with icons: Requested → Matched → Building → In verification → Verified), the business card (contact details NOW revealed via RPC once matched: contact name + WhatsApp, with a "Message on WhatsApp" `wa.me` deep link), the pitch, and:
   - **Evidence submission** (available in `matched`/`changes_requested`): Video walkthrough URL* (Loom/YouTube — must show the system working end-to-end), Live proof* (type-dependent placeholder: WhatsApp number the bot answers on, scenario/share URL, or the voice agent's phone number), "What it does & the result for the business"* (min 150 chars, becomes showcase copy later), optional screenshots (reuse the existing submissions Storage bucket pattern, max 5 files, 20 MB each, path `submissions/{user_id}/capstone-{project_id}/...`). Submit → status `submitted`.
   - **Feedback history:** every verification review, newest first, exactly like assignment feedback.
6. Verified state: full-width green celebration Card, gold confetti, "You built something real." plus "Your showcase page is coming" note (next PRD).

### 5. Instructor — verification queue `/teach/capstones`

ProtectedRoute `allowedRoles: ['admin','instructor']`. Two queues in tabs:

1. **Match requests:** student name, cohort, business, type, pitch. Actions: **Approve match** (checks business remaining capacity atomically; decrements implicitly via active-project count) or **Decline** (required reason, returned kindly to the student, who may request elsewhere). Staff may also **Assign directly**: pick student + business + type, creating a `matched` project (used when staff plays matchmaker).
2. **Verification queue:** submitted capstones, oldest first. Detail view: pitch, business (with contacts), evidence video (embedded if Loom/YouTube, else link), live proof rendered by type (wa.me link / URL / tel: link), narrative, screenshots via signed URLs, prior attempts. **Verification checklist** (all required before Verify enables): ☐ Watched the full walkthrough ☐ Tested the live proof myself ☐ It addresses the business's stated pain point ☐ Business is aware and has seen it. Feedback* (min 20 chars) + buttons: success **Verify capstone** (confirm dialog: "This marks the capstone complete and eligible for the public Outcomes Board") or warning **Request changes**.

### 6. Server-side rules (all enforced in SQL)

- One live capstone per student (statuses `requested`, `matched`, `submitted`, `changes_requested` count as live; `declined` and `withdrawn` do not).
- Match approval fails if the business's active projects ≥ capacity, atomically (row lock on the business).
- Evidence submission only from the matched student, only in `matched`/`changes_requested`, only with all required fields.
- Verification only by staff, only from `submitted`, race-protected (row lock), feedback required.
- Business contact details (email, WhatsApp, contact name) are readable ONLY via `get_business_contact(project_id)`: matched student, staff, or the owning partner. Directory queries never receive them (enforced by column-split: contacts live in `business_contacts`).
- Students may withdraw a live capstone pre-submission (status `withdrawn`, frees business capacity, allows a fresh request).

### 7. Seed additions

Seed: three approved businesses across types/islands (capacities 1, 1, 2) with contacts; one pending business; flag the Week 7 module `is_capstone`; one matched project for the test student with a submitted evidence set so both queues and the timeline render immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0006_capstone.sql`. Existing objects used, not modified: `profiles`, roles, `current_user_role()`, `is_staff()`, `is_room_member()`, `is_module_unlocked()`, `set_updated_at()`, `enrollments`, `cohorts`, storage bucket `submissions` and its policies. Tables altered here: `modules` (one flag), `interest_signups` (one flag); resulting schemas restated.

```sql
-- ============================================
-- PRD 06: Capstone pipeline
-- ============================================

alter table public.modules add column is_capstone boolean not null default false;
-- Restated full modules schema (reference): id uuid PK · course_id FK ·
--   title text · sort_order int (unique per course) · unlock_date date ·
--   is_capstone bool (default false) · created_at · updated_at

alter table public.interest_signups add column converted boolean not null default false;
-- Restated full interest_signups schema (reference): id uuid PK ·
--   audience ('student'|'business') · email (unique per audience) ·
--   contact_name · business_name · whatsapp · business_type · pain_point ·
--   converted bool · created_at

create type public.business_status as enum ('pending', 'approved', 'archived');
create type public.capstone_type   as enum ('whatsapp_bot', 'automation', 'voice_agent');
create type public.capstone_status as enum
  ('requested', 'matched', 'submitted', 'changes_requested',
   'verified', 'declined', 'withdrawn');

create table public.business_partners (
  id            uuid primary key default gen_random_uuid(),
  status        public.business_status not null default 'pending',
  name          text not null,
  business_type text not null,
  community     text not null,
  island        text not null,
  pain_point    text not null,
  notes         text,
  capacity      int not null default 1 check (capacity between 1 and 3),
  consent       boolean not null default false,
  proposed_by   uuid references public.profiles(id),  -- student-proposed
  owner_user_id uuid references public.profiles(id),  -- claimed partner account
  archive_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger business_partners_updated_at before update on public.business_partners
  for each row execute function public.set_updated_at();

-- Contacts split into their own table so the directory can never leak them
create table public.business_contacts (
  business_id  uuid primary key references public.business_partners(id) on delete cascade,
  contact_name text not null,
  email        text not null unique,
  whatsapp     text not null
);

create table public.capstone_projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  business_id    uuid not null references public.business_partners(id),
  cohort_id      uuid references public.cohorts(id),
  type           public.capstone_type not null,
  status         public.capstone_status not null default 'requested',
  pitch          text not null,
  -- evidence
  video_url      text,
  live_proof     text,
  narrative      text,
  file_paths     jsonb not null default '[]'::jsonb,
  submitted_at   timestamptz,
  -- decisions
  matched_by     uuid references public.profiles(id),
  matched_at     timestamptz,
  verified_by    uuid references public.profiles(id),
  verified_at    timestamptz,
  decline_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger capstone_projects_updated_at before update on public.capstone_projects
  for each row execute function public.set_updated_at();
create index capstone_status_idx on public.capstone_projects (status, created_at);

-- Enforce ONE live capstone per student
create unique index one_live_capstone_per_user
  on public.capstone_projects (user_id)
  where status in ('requested','matched','submitted','changes_requested');

create table public.capstone_reviews (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.capstone_projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision    public.capstone_status not null,  -- 'verified' | 'changes_requested' | 'declined' | 'matched'
  feedback    text not null,
  created_at  timestamptz not null default now()
);

-- ============================================
-- Helpers
-- ============================================
create or replace function public.business_active_projects(p_business_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.capstone_projects
  where business_id = p_business_id
    and status in ('matched','submitted','changes_requested');
$$;

create or replace function public.is_capstone_eligible()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    where m.is_capstone
      and c.status = 'published'
      and public.is_room_member(c.room_id)
      and public.is_module_unlocked(m.id)
    order by m.sort_order limit 1
  );
$$;

-- ============================================
-- RPCs (every transition goes through one)
-- ============================================

create or replace function public.request_capstone_match(
  p_business_id uuid, p_type public.capstone_type, p_pitch text)
returns uuid language plpgsql security definer set search_path = public as $$
declare b record; new_id uuid; v_cohort uuid;
begin
  if not public.is_capstone_eligible() then raise exception 'not_eligible'; end if;
  if coalesce(length(trim(p_pitch)),0) < 100 then raise exception 'pitch_too_short'; end if;
  select * into b from public.business_partners
    where id = p_business_id and status = 'approved' for update;
  if b is null then raise exception 'business_unavailable'; end if;
  if public.business_active_projects(p_business_id) >= b.capacity then
    raise exception 'business_full';
  end if;
  select e.cohort_id into v_cohort from public.enrollments e
    where e.user_id = auth.uid() and e.status = 'active' limit 1;
  insert into public.capstone_projects (user_id, business_id, cohort_id, type, pitch)
    values (auth.uid(), p_business_id, v_cohort, p_type, trim(p_pitch))
    returning id into new_id;  -- unique partial index blocks a second live one
  return new_id;
end;
$$;
grant execute on function public.request_capstone_match(uuid, public.capstone_type, text) to authenticated;

create or replace function public.decide_capstone_match(
  p_project_id uuid, p_approve boolean, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare pr record; b record;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(p_feedback)),0) < 5 then raise exception 'feedback_required'; end if;
  select * into pr from public.capstone_projects
    where id = p_project_id for update;
  if pr is null or pr.status <> 'requested' then raise exception 'invalid_state'; end if;
  if p_approve then
    select * into b from public.business_partners where id = pr.business_id for update;
    if b.status <> 'approved'
       or public.business_active_projects(pr.business_id) >= b.capacity then
      raise exception 'business_full';
    end if;
    update public.capstone_projects
      set status='matched', matched_by=auth.uid(), matched_at=now()
      where id = p_project_id;
    insert into public.capstone_reviews (project_id, reviewer_id, decision, feedback)
      values (p_project_id, auth.uid(), 'matched', trim(p_feedback));
  else
    update public.capstone_projects
      set status='declined', decline_reason=trim(p_feedback)
      where id = p_project_id;
    insert into public.capstone_reviews (project_id, reviewer_id, decision, feedback)
      values (p_project_id, auth.uid(), 'declined', trim(p_feedback));
  end if;
end;
$$;
grant execute on function public.decide_capstone_match(uuid, boolean, text) to authenticated;

create or replace function public.assign_capstone(
  p_user_id uuid, p_business_id uuid, p_type public.capstone_type, p_pitch text)
returns uuid language plpgsql security definer set search_path = public as $$
declare b record; new_id uuid; v_cohort uuid;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select * into b from public.business_partners
    where id = p_business_id and status='approved' for update;
  if b is null or public.business_active_projects(p_business_id) >= b.capacity then
    raise exception 'business_full';
  end if;
  select e.cohort_id into v_cohort from public.enrollments e
    where e.user_id = p_user_id and e.status = 'active' limit 1;
  insert into public.capstone_projects
    (user_id, business_id, cohort_id, type, pitch, status, matched_by, matched_at)
    values (p_user_id, p_business_id, v_cohort, p_type,
            coalesce(nullif(trim(p_pitch),''),'Assigned by staff'),
            'matched', auth.uid(), now())
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.assign_capstone(uuid, uuid, public.capstone_type, text) to authenticated;

create or replace function public.submit_capstone_evidence(
  p_project_id uuid, p_video_url text, p_live_proof text,
  p_narrative text, p_file_paths jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pr record;
begin
  select * into pr from public.capstone_projects
    where id = p_project_id and user_id = auth.uid() for update;
  if pr is null then raise exception 'not_found'; end if;
  if pr.status not in ('matched','changes_requested') then raise exception 'invalid_state'; end if;
  if p_video_url !~* '^https://' then raise exception 'video_url_invalid'; end if;
  if coalesce(length(trim(p_live_proof)),0) < 5 then raise exception 'live_proof_required'; end if;
  if coalesce(length(trim(p_narrative)),0) < 150 then raise exception 'narrative_too_short'; end if;
  if jsonb_array_length(coalesce(p_file_paths,'[]'::jsonb)) > 5 then raise exception 'too_many_files'; end if;
  update public.capstone_projects
    set status='submitted', video_url=trim(p_video_url),
        live_proof=trim(p_live_proof), narrative=trim(p_narrative),
        file_paths=coalesce(p_file_paths,'[]'::jsonb), submitted_at=now()
    where id = p_project_id;
end;
$$;
grant execute on function public.submit_capstone_evidence(uuid, text, text, text, jsonb) to authenticated;

create or replace function public.review_capstone(
  p_project_id uuid, p_verify boolean, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare pr record;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(p_feedback)),0) < 20 then raise exception 'feedback_too_short'; end if;
  select * into pr from public.capstone_projects
    where id = p_project_id for update;
  if pr is null or pr.status <> 'submitted' then raise exception 'invalid_state'; end if;
  if p_verify then
    update public.capstone_projects
      set status='verified', verified_by=auth.uid(), verified_at=now()
      where id = p_project_id;
    insert into public.capstone_reviews (project_id, reviewer_id, decision, feedback)
      values (p_project_id, auth.uid(), 'verified', trim(p_feedback));
  else
    update public.capstone_projects set status='changes_requested'
      where id = p_project_id;
    insert into public.capstone_reviews (project_id, reviewer_id, decision, feedback)
      values (p_project_id, auth.uid(), 'changes_requested', trim(p_feedback));
  end if;
end;
$$;
grant execute on function public.review_capstone(uuid, boolean, text) to authenticated;

create or replace function public.withdraw_capstone(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pr record;
begin
  select * into pr from public.capstone_projects
    where id = p_project_id and user_id = auth.uid() for update;
  if pr is null then raise exception 'not_found'; end if;
  if pr.status not in ('requested','matched','changes_requested') then
    raise exception 'invalid_state';
  end if;
  update public.capstone_projects set status='withdrawn' where id = p_project_id;
end;
$$;
grant execute on function public.withdraw_capstone(uuid) to authenticated;

create or replace function public.get_business_contact(p_project_id uuid)
returns table (contact_name text, email text, whatsapp text)
language plpgsql stable security definer set search_path = public as $$
declare pr record;
begin
  select * into pr from public.capstone_projects where id = p_project_id;
  if pr is null then raise exception 'not_found'; end if;
  if not (public.is_staff()
          or pr.user_id = auth.uid() and pr.status in
             ('matched','submitted','changes_requested','verified')
          or exists (select 1 from public.business_partners b
                     where b.id = pr.business_id and b.owner_user_id = auth.uid())) then
    raise exception 'forbidden';
  end if;
  return query select bc.contact_name, bc.email, bc.whatsapp
    from public.business_contacts bc where bc.business_id = pr.business_id;
end;
$$;
grant execute on function public.get_business_contact(uuid) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.business_partners enable row level security;
alter table public.business_contacts enable row level security;
alter table public.capstone_projects enable row level security;
alter table public.capstone_reviews enable row level security;

-- Directory: authenticated room members read APPROVED businesses (no contacts
-- in this table by design); staff read all; owner reads their own
create policy "businesses_select_member" on public.business_partners for select
  using (status = 'approved' and auth.uid() is not null);
create policy "businesses_select_staff" on public.business_partners for select
  using (public.is_staff());
create policy "businesses_select_owner" on public.business_partners for select
  using (owner_user_id = auth.uid());
-- Public registration inserts (pending only, consent required)
create policy "businesses_insert_public" on public.business_partners for insert
  to anon, authenticated
  with check (status = 'pending' and consent = true);
create policy "businesses_update_admin" on public.business_partners for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy "businesses_update_owner" on public.business_partners for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and status = status);

-- Contacts: staff only via table; everyone else via the RPC. Public insert
-- rides along with registration.
create policy "contacts_select_staff" on public.business_contacts for select
  using (public.is_staff());
create policy "contacts_insert_public" on public.business_contacts for insert
  to anon, authenticated with check (true);
create policy "contacts_update_admin" on public.business_contacts for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Projects: own rows; staff all; partner sees projects at their business
create policy "capstone_select_own" on public.capstone_projects for select
  using (user_id = auth.uid());
create policy "capstone_select_staff" on public.capstone_projects for select
  using (public.is_staff());
create policy "capstone_select_partner" on public.capstone_projects for select
  using (exists (select 1 from public.business_partners b
                 where b.id = capstone_projects.business_id
                   and b.owner_user_id = auth.uid()));
-- No direct writes: all transitions via RPCs.

-- Reviews: visible to the project's student, staff, and the business owner
create policy "capstone_reviews_select" on public.capstone_reviews for select
  using (
    public.is_staff()
    or exists (select 1 from public.capstone_projects p
               where p.id = capstone_reviews.project_id
                 and (p.user_id = auth.uid()
                      or exists (select 1 from public.business_partners b
                                 where b.id = p.business_id
                                   and b.owner_user_id = auth.uid())))
  );
```

Registration form note: insert `business_partners` and `business_contacts` in one client transaction order (partner first, then contacts with the returned id); on contact insert failure, surface a retry that only re-attempts the contact row.

## Acceptance Criteria

Verify by hand, two browsers (student + staff), plus a partner account. All at 375px too.

- [ ] Public registration creates a pending business + contact row; consent unchecked blocks; duplicate email handled kindly
- [ ] Admin queue: approve with capacity, archive with reason, convert-from-interest pre-fills and flags the signup consumed
- [ ] Owner invite creates a `business_partner` account; the partner portal shows their business and lets them edit WhatsApp and pain point only
- [ ] Student before Week-7 unlock sees the locked capstone hub with progress; `request_capstone_match` raises `not_eligible` from the console
- [ ] Eligible student browses the directory WITHOUT any contact details in the network payload (inspect: no email/WhatsApp fields); filters work
- [ ] Match request enforces the 100-char pitch; a second live request raises the unique-index violation surfaced as "You already have an active capstone"
- [ ] Staff approve-match on a full business raises `business_full` (fill a capacity-1 business, then try a second approval)
- [ ] After match, the student sees contact details via the RPC and the wa.me link works; an UNmatched student calling `get_business_contact` gets `forbidden`
- [ ] Evidence submission validates https video URL, live proof, 150-char narrative; files land under the student's own storage prefix
- [ ] Verification checklist gates the Verify button; verify flips status with green/gold celebration on the student side; feedback history shows the full trail
- [ ] Changes-requested returns the evidence form; resubmission works; verifying an already-verified project raises `invalid_state` (two-tab race)
- [ ] Withdraw frees the business capacity and allows a fresh request; withdraw after submission is blocked
- [ ] Student-proposed business arrives pending with `proposed_by` set; approving it then allows the match
- [ ] Partner portal shows live project status; partner cannot see other businesses' projects (RLS)
- [ ] Direct table writes to projects/reviews from any non-service client are rejected
- [ ] Every capstone surface is bright and celebratory; verified state uses green + gold; usable at 375px

## Hand-off Note

PRD 06 delivers the differentiator end-to-end: businesses in, matches controlled, evidence verified, capacity protected, contacts gated. Verified capstones now exist as trustworthy records; the next PRD turns them into public proof — showcase pages, the Outcomes Board, and certificates — and computes graduation.

Run this PRD with the full three-actor flow (student, staff, partner) and every console-level attack in the list before moving on. Next in sequence: PRD 07 — Outcomes Board & Certificates.
