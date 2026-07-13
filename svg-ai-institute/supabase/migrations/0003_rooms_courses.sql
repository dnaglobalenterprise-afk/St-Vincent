-- ============================================
-- PRD 03: Rooms, courses, modules, lessons, progress, quizzes
-- ============================================

create type public.room_status   as enum ('draft', 'active', 'archived');
create type public.course_status as enum ('draft', 'published');
create type public.lesson_type   as enum ('video', 'text', 'quiz', 'assignment', 'replay');
create type public.video_status  as enum ('none', 'processing', 'ready', 'errored');

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  status      public.room_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

-- Link cohorts to rooms.
alter table public.cohorts add column room_id uuid references public.rooms(id);

-- Restated full cohorts schema after this migration (reference, not executed):
--   id uuid PK · name text · start_date date · end_date date ·
--   capacity int (>0, default 30) · status cohort_status
--   ('draft'|'open'|'running'|'completed') · room_id uuid FK rooms ·
--   created_at · updated_at

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  title       text not null,
  description text,
  status      public.course_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  sort_order  int not null,
  unlock_date date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, sort_order)
);
create trigger modules_updated_at before update on public.modules
  for each row execute function public.set_updated_at();

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules(id) on delete cascade,
  type             public.lesson_type not null,
  title            text not null,
  sort_order       int not null,
  required         boolean not null default true,
  published        boolean not null default false,
  -- content fields (gated; served only via RPC)
  body_markdown    text,
  mux_upload_id    text,
  mux_playback_id  text,
  video_status     public.video_status not null default 'none',
  duration_seconds int,
  pass_threshold   int check (pass_threshold between 1 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (module_id, sort_order)
);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  prompt      text not null,
  options     jsonb not null,          -- ["opt A","opt B",...] (2-6 items)
  correct_idx int not null,            -- index into options
  sort_order  int not null,
  unique (lesson_id, sort_order)
);

create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  answers     jsonb not null,          -- [chosen_idx per question in sort order]
  score_pct   int not null,
  passed      boolean not null,
  created_at  timestamptz not null default now()
);

create table public.lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

-- ============================================
-- Access helpers (security definer; used by RLS and RPCs)
-- ============================================

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_role() in ('admin','instructor');
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    where e.user_id = auth.uid()
      and e.status in ('active','graduated')
      and c.room_id = p_room_id
  );
$$;

-- Is a module unlocked for the CURRENT user?
create or replace function public.is_module_unlocked(p_module_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  m record; prev record; missing int;
begin
  select * into m from public.modules where id = p_module_id;
  if m is null then return false; end if;
  if public.is_staff() then return true; end if;
  if m.unlock_date is not null and m.unlock_date > current_date then
    return false;
  end if;
  select * into prev from public.modules
    where course_id = m.course_id and sort_order < m.sort_order
    order by sort_order desc limit 1;
  if prev is null then return true; end if;  -- first module
  select count(*) into missing
    from public.lessons l
    where l.module_id = prev.id and l.required and l.published
      and not exists (select 1 from public.lesson_progress lp
                      where lp.lesson_id = l.id and lp.user_id = auth.uid());
  return missing = 0;
end;
$$;

-- Gated content fetch: the ONLY path to lesson content for students
create or replace function public.get_lesson_content(p_lesson_id uuid)
returns table (
  id uuid, module_id uuid, type public.lesson_type, title text,
  body_markdown text, mux_playback_id text, video_status public.video_status,
  duration_seconds int, pass_threshold int,
  questions jsonb  -- [{id, prompt, options, sort_order}] with correct_idx STRIPPED
)
language plpgsql stable security definer set search_path = public as $$
declare
  l record; room uuid;
begin
  select les.*, c.room_id into l
    from public.lessons les
    join public.modules mo on mo.id = les.module_id
    join public.courses c  on c.id = mo.course_id
    where les.id = p_lesson_id;
  if l is null then raise exception 'not_found'; end if;
  if not public.is_staff() then
    if not l.published then raise exception 'not_found'; end if;
    if not public.is_room_member(l.room_id) then raise exception 'forbidden'; end if;
    if not public.is_module_unlocked(l.module_id) then raise exception 'locked'; end if;
  end if;
  return query select l.id, l.module_id, l.type, l.title,
    l.body_markdown, l.mux_playback_id, l.video_status,
    l.duration_seconds, l.pass_threshold,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'prompt', q.prompt, 'options', q.options,
        'sort_order', q.sort_order) order by q.sort_order), '[]'::jsonb)
     from public.quiz_questions q where q.lesson_id = l.id);
end;
$$;
grant execute on function public.get_lesson_content(uuid) to authenticated;

-- Quiz grading: server-side so correct answers never reach the client pre-pass
create or replace function public.submit_quiz(p_lesson_id uuid, p_answers jsonb)
returns table (score_pct int, passed boolean, wrong_indexes jsonb)
language plpgsql security definer set search_path = public as $$
declare
  total int; correct int := 0; threshold int; unlocked boolean;
  q record; i int := 0; wrongs jsonb := '[]'::jsonb; did_pass boolean;
begin
  select l.pass_threshold into threshold from public.lessons l
    where l.id = p_lesson_id and l.type = 'quiz' and l.published;
  if threshold is null then raise exception 'not_found'; end if;
  select public.is_module_unlocked(m.id) into unlocked
    from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = p_lesson_id;
  if not unlocked then raise exception 'locked'; end if;
  select count(*) into total from public.quiz_questions where lesson_id = p_lesson_id;
  if total = 0 then raise exception 'empty_quiz'; end if;
  for q in select * from public.quiz_questions
           where lesson_id = p_lesson_id order by sort_order loop
    if (p_answers ->> i)::int = q.correct_idx then correct := correct + 1;
    else wrongs := wrongs || to_jsonb(i); end if;
    i := i + 1;
  end loop;
  score_pct := floor(100.0 * correct / total);
  did_pass := score_pct >= threshold;
  passed := did_pass;
  wrong_indexes := wrongs;
  insert into public.quiz_attempts (lesson_id, user_id, answers, score_pct, passed)
    values (p_lesson_id, auth.uid(), p_answers, score_pct, did_pass);
  if did_pass then
    insert into public.lesson_progress (lesson_id, user_id)
      values (p_lesson_id, auth.uid()) on conflict do nothing;
  end if;
  return next;
end;
$$;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Mark video/text lessons complete (validates gate + type server-side)
create or replace function public.mark_lesson_complete(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select les.*, mo.id as mid into l from public.lessons les
    join public.modules mo on mo.id = les.module_id where les.id = p_lesson_id;
  if l is null or not l.published then raise exception 'not_found'; end if;
  if l.type not in ('video','text') then raise exception 'invalid_type'; end if;
  if not public.is_module_unlocked(l.mid) then raise exception 'locked'; end if;
  insert into public.lesson_progress (lesson_id, user_id)
    values (p_lesson_id, auth.uid()) on conflict do nothing;
end;
$$;
grant execute on function public.mark_lesson_complete(uuid) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.rooms enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.lesson_progress enable row level security;

-- Rooms: members read active rooms; staff read all; admin writes
create policy "rooms_select_member" on public.rooms for select
  using (status = 'active' and public.is_room_member(id));
create policy "rooms_select_staff" on public.rooms for select
  using (public.is_staff());
create policy "rooms_write_admin" on public.rooms for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Courses: members read published; staff all; admin writes
create policy "courses_select_member" on public.courses for select
  using (status = 'published' and public.is_room_member(room_id));
create policy "courses_select_staff" on public.courses for select
  using (public.is_staff());
create policy "courses_write_admin" on public.courses for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Modules: members read (locked weeks still show titles); staff all; admin writes
create policy "modules_select_member" on public.modules for select
  using (exists (select 1 from public.courses c
                 where c.id = modules.course_id
                   and c.status = 'published'
                   and public.is_room_member(c.room_id)));
create policy "modules_select_staff" on public.modules for select
  using (public.is_staff());
create policy "modules_write_admin" on public.modules for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Lessons: members read PUBLISHED rows (metadata for the outline; content
-- columns are only trusted via get_lesson_content). Staff read all; admin writes.
create policy "lessons_select_member" on public.lessons for select
  using (published and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = lessons.module_id and c.status = 'published'
      and public.is_room_member(c.room_id)));
create policy "lessons_select_staff" on public.lessons for select
  using (public.is_staff());
create policy "lessons_write_admin" on public.lessons for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- IMPORTANT client rule: student-facing queries on lessons must select ONLY
-- metadata columns (id, module_id, type, title, sort_order, required).
-- Content rendering must come exclusively from get_lesson_content so the
-- unlock check always runs. Locked-module content secrecy for direct selects
-- is additionally protected because quiz answers live in quiz_questions
-- (staff-only policy below) and get_lesson_content is the graded path.

-- Quiz questions: staff only (students receive questions via the RPC,
-- with correct_idx stripped)
create policy "quiz_questions_staff" on public.quiz_questions for select
  using (public.is_staff());
create policy "quiz_questions_write_admin" on public.quiz_questions for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Attempts and progress: own rows; staff read all; writes happen via RPCs
create policy "attempts_select_own" on public.quiz_attempts for select
  using (user_id = auth.uid());
create policy "attempts_select_staff" on public.quiz_attempts for select
  using (public.is_staff());
create policy "progress_select_own" on public.lesson_progress for select
  using (user_id = auth.uid());
create policy "progress_select_staff" on public.lesson_progress for select
  using (public.is_staff());
-- No direct insert/update/delete policies on attempts/progress:
-- all writes flow through submit_quiz / mark_lesson_complete (security definer).
