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
