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

-- Public submit that returns the generated ref code (the applications table
-- has no public SELECT, so a plain INSERT ... RETURNING is blocked by RLS;
-- this security-definer function is the only way the applicant learns their
-- code). A duplicate email raises unique_violation (23505) to the client.
create or replace function public.submit_application(p jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
begin
  insert into public.applications
    (first_name, last_name, email, whatsapp, date_of_birth, community, country,
     device_access, internet, weekly_hours, situation,
     motivation, finisher_story, heard_from, committed)
  values
    (trim(p->>'first_name'), trim(p->>'last_name'),
     lower(trim(p->>'email')), trim(p->>'whatsapp'),
     (p->>'date_of_birth')::date, trim(p->>'community'), trim(p->>'country'),
     p->>'device_access', p->>'internet', p->>'weekly_hours', p->>'situation',
     p->>'motivation', p->>'finisher_story', p->>'heard_from',
     coalesce((p->>'committed')::boolean, false))
  returning ref_code into v_code;
  return v_code;
end;
$$;
grant execute on function public.submit_application(jsonb) to anon, authenticated;

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
