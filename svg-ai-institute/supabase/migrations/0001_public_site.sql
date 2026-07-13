-- ============================================
-- PRD 01: Public site — interest capture
-- ============================================

create type public.interest_audience as enum ('student', 'business');

create table public.interest_signups (
  id             uuid primary key default gen_random_uuid(),
  audience       public.interest_audience not null,
  email          text not null,
  contact_name   text,
  business_name  text,
  whatsapp       text,
  business_type  text,
  pain_point     text,
  created_at     timestamptz not null default now(),
  -- one signup per email per audience
  unique (audience, email)
);

alter table public.interest_signups enable row level security;

-- Anyone (including anonymous visitors) may register interest
create policy "interest_insert_public"
  on public.interest_signups for insert
  to anon, authenticated
  with check (true);

-- Only admins and instructors can read the list
create policy "interest_select_staff"
  on public.interest_signups for select
  using (public.current_user_role() in ('admin', 'instructor'));

-- Only admins can delete (cleanup/spam)
create policy "interest_delete_admin"
  on public.interest_signups for delete
  using (public.current_user_role() = 'admin');

-- No public select, no updates from anyone.
