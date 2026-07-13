-- ============================================
-- PRD 05: Live classes, recordings, attendance
-- ============================================

create type public.live_class_status as enum
  ('scheduled', 'live', 'ended', 'cancelled');

create type public.live_class_mode as enum ('external', 'embedded');

create type public.recording_status as enum ('processing', 'ready', 'errored');

create table public.live_classes (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  cohort_id           uuid references public.cohorts(id),  -- null = all cohorts in room
  host_id             uuid not null references public.profiles(id),
  title               text not null,
  description         text,
  scheduled_at        timestamptz not null,
  duration_minutes    int not null default 90 check (duration_minutes between 15 and 480),
  mode                public.live_class_mode not null default 'external',
  meeting_url         text,                    -- external mode
  mux_live_stream_id  text,                    -- embedded mode
  mux_live_playback_id text,                   -- embedded mode
  status              public.live_class_status not null default 'scheduled',
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (mode <> 'external' or meeting_url is not null)
);
create trigger live_classes_updated_at before update on public.live_classes
  for each row execute function public.set_updated_at();
create index live_classes_room_time_idx
  on public.live_classes (room_id, scheduled_at);

-- Stream keys live in their own staff-only table (never readable by students)
create table public.live_class_secrets (
  class_id    uuid primary key references public.live_classes(id) on delete cascade,
  stream_key  text not null,
  created_at  timestamptz not null default now()
);

create table public.recordings (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  class_id            uuid references public.live_classes(id) on delete set null,
  title               text not null,
  description         text,
  mux_upload_id       text,
  mux_asset_id        text,
  mux_playback_id     text,
  duration_seconds    int,
  status              public.recording_status not null default 'processing',
  published           boolean not null default true,
  attached_lesson_ids jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger recordings_updated_at before update on public.recordings
  for each row execute function public.set_updated_at();
create index recordings_room_idx on public.recordings (room_id, status, created_at);

create table public.class_attendance (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.live_classes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (class_id, user_id)
);

-- ============================================
-- RPCs
-- ============================================

-- Staff-only stream credentials
create or replace function public.get_stream_credentials(p_class_id uuid)
returns table (rtmp_url text, stream_key text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return query
    select 'rtmp://global-live.mux.com:5222/app'::text, s.stream_key
    from public.live_class_secrets s
    where s.class_id = p_class_id;
end;
$$;
grant execute on function public.get_stream_credentials(uuid) to authenticated;

-- Attendance: validates membership + cohort scoping, idempotent
create or replace function public.record_attendance(p_class_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.live_classes where id = p_class_id;
  if c is null then raise exception 'not_found'; end if;
  if not public.is_room_member(c.room_id) then raise exception 'forbidden'; end if;
  if c.cohort_id is not null and not public.is_staff() then
    if not exists (select 1 from public.enrollments e
                   where e.user_id = auth.uid()
                     and e.cohort_id = c.cohort_id
                     and e.status in ('active','graduated')) then
      raise exception 'forbidden';
    end if;
  end if;
  insert into public.class_attendance (class_id, user_id)
    values (p_class_id, auth.uid())
    on conflict do nothing;
end;
$$;
grant execute on function public.record_attendance(uuid) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.live_classes enable row level security;
alter table public.live_class_secrets enable row level security;
alter table public.recordings enable row level security;
alter table public.class_attendance enable row level security;

-- Classes: room members read their room's classes (cohort-scoped classes only
-- for that cohort's members); staff read/write all
create policy "classes_select_member" on public.live_classes for select
  using (
    public.is_room_member(room_id)
    and (
      cohort_id is null
      or public.is_staff()
      or exists (select 1 from public.enrollments e
                 where e.user_id = auth.uid()
                   and e.cohort_id = live_classes.cohort_id
                   and e.status in ('active','graduated'))
    )
  );
create policy "classes_write_staff" on public.live_classes for all
  using (public.is_staff()) with check (public.is_staff());

-- Stream secrets: staff only, and only via the RPC in practice
create policy "class_secrets_staff" on public.live_class_secrets for select
  using (public.is_staff());
-- inserts happen from the Edge Function (service role bypasses RLS)

-- Recordings: members read ready+published for their room; staff everything
create policy "recordings_select_member" on public.recordings for select
  using (status = 'ready' and published and public.is_room_member(room_id));
create policy "recordings_select_staff" on public.recordings for select
  using (public.is_staff());
create policy "recordings_write_staff" on public.recordings for all
  using (public.is_staff()) with check (public.is_staff());

-- Attendance: own rows readable; staff read all; inserts via RPC only
create policy "attendance_select_own" on public.class_attendance for select
  using (user_id = auth.uid());
create policy "attendance_select_staff" on public.class_attendance for select
  using (public.is_staff());
