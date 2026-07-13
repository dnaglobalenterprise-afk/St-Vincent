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
