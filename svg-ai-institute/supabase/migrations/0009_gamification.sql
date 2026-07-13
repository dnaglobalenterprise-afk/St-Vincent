-- ============================================
-- PRD 09: Gamification — points, streaks, badges, leaderboard
-- ============================================

create table public.point_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  points     int  not null check (points > 0),
  ref_id     uuid,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index point_events_user_idx on public.point_events (user_id, created_at desc);

create table public.streaks (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  current_streak     int not null default 0,
  longest_streak     int not null default 0,
  last_activity_date date
);

create table public.badges (
  slug        text primary key,
  name        text not null,
  description text not null,
  icon        text not null
);

create table public.badge_awards (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_slug text not null references public.badges(slug),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

-- ============================================
-- Core helpers
-- ============================================

create or replace function public.user_points(p_user_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(points),0)::int from public.point_events where user_id = p_user_id;
$$;

create or replace function public.user_level(p_points int)
returns int language sql immutable as $$
  select case
    when p_points >= 1000 then 5
    when p_points >= 500  then 4
    when p_points >= 250  then 3
    when p_points >= 100  then 2
    else 1 end;
$$;

create or replace function public.award_badge(p_user uuid, p_slug text)
returns void language sql security definer set search_path = public as $$
  insert into public.badge_awards (user_id, badge_slug)
    values (p_user, p_slug) on conflict do nothing;
$$;

-- Central award routine: writes the ledger, maintains streaks, evaluates badges
create or replace function public.award_points(
  p_user uuid, p_kind text, p_points int, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  today_ast date := (now() at time zone 'America/St_Vincent')::date;
  s record; inserted boolean := false; total int;
begin
  -- Staff never accrue (keeps leaderboard honest)
  if exists (select 1 from public.profiles
             where id = p_user and role in ('admin','instructor')) then
    return;
  end if;

  insert into public.point_events (user_id, kind, points, ref_id)
    values (p_user, p_kind, p_points, p_ref)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  if not inserted then return; end if;   -- double-award guard

  -- Streak maintenance
  select * into s from public.streaks where user_id = p_user for update;
  if s is null then
    insert into public.streaks (user_id, current_streak, longest_streak, last_activity_date)
      values (p_user, 1, 1, today_ast);
    s := (select r from (select p_user as user_id, 1 as current_streak,
          1 as longest_streak, today_ast as last_activity_date) r);
  elsif s.last_activity_date = today_ast then
    null; -- already counted today
  elsif s.last_activity_date = today_ast - 1 then
    update public.streaks
      set current_streak = s.current_streak + 1,
          longest_streak = greatest(s.longest_streak, s.current_streak + 1),
          last_activity_date = today_ast
      where user_id = p_user;
    if (s.current_streak + 1) % 7 = 0 then
      perform public.award_points(p_user, 'streak_7',
        20, gen_random_uuid());
      perform public.award_badge(p_user, 'on-fire');
    end if;
  else
    update public.streaks
      set current_streak = 1, last_activity_date = today_ast
      where user_id = p_user;
  end if;

  -- Level badge
  total := public.user_points(p_user);
  if public.user_level(total) = 5 then
    perform public.award_badge(p_user, 'island-legend');
  end if;
end;
$$;

-- ============================================
-- Event triggers on existing tables
-- ============================================

-- Lesson completions (single source for lesson-type awards)
create or replace function public.gamify_lesson_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.lesson_type; kind text; pts int;
begin
  select type into t from public.lessons where id = new.lesson_id;
  kind := case t
    when 'video' then 'lesson_video' when 'text' then 'lesson_text'
    when 'quiz' then 'quiz_pass' when 'assignment' then 'assignment_approved'
    when 'replay' then 'lesson_replay' end;
  pts := case t
    when 'video' then 10 when 'text' then 10 when 'quiz' then 15
    when 'assignment' then 25 when 'replay' then 5 end;
  perform public.award_points(new.user_id, kind, pts, new.lesson_id);
  perform public.award_badge(new.user_id, 'first-steps');
  if t = 'quiz' then perform public.award_badge(new.user_id, 'quiz-whiz'); end if;
  if t = 'assignment' then perform public.award_badge(new.user_id, 'shipped-it'); end if;
  return new;
end;
$$;
create trigger gamify_on_lesson_progress
  after insert on public.lesson_progress
  for each row execute function public.gamify_lesson_progress();

-- Perfect quizzes (bonus on the attempt row)
create or replace function public.gamify_quiz_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.passed and new.score_pct = 100 then
    perform public.award_points(new.user_id, 'quiz_perfect', 10, new.lesson_id);
    perform public.award_badge(new.user_id, 'sharpshooter');
  end if;
  return new;
end;
$$;
create trigger gamify_on_quiz_attempt
  after insert on public.quiz_attempts
  for each row execute function public.gamify_quiz_attempt();

-- Class attendance
create or replace function public.gamify_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.user_id, 'class_attended', 15, new.class_id);
  perform public.award_badge(new.user_id, 'front-row');
  return new;
end;
$$;
create trigger gamify_on_attendance
  after insert on public.class_attendance
  for each row execute function public.gamify_attendance();

-- Capstone verified + graduation
create or replace function public.gamify_capstone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    perform public.award_points(new.user_id, 'capstone_verified', 100, new.id);
    perform public.award_badge(new.user_id, 'deployed');
  end if;
  return new;
end;
$$;
create trigger gamify_on_capstone
  after update on public.capstone_projects
  for each row execute function public.gamify_capstone();

create or replace function public.gamify_graduation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'graduated' and old.status is distinct from 'graduated' then
    perform public.award_points(new.user_id, 'graduated', 150, new.id);
    perform public.award_badge(new.user_id, 'graduate');
  end if;
  return new;
end;
$$;
create trigger gamify_on_graduation
  after update on public.enrollments
  for each row execute function public.gamify_graduation();

-- ============================================
-- Leaderboard RPC (privacy-safe)
-- ============================================
create or replace function public.get_leaderboard(p_room_id uuid, p_cohort_id uuid)
returns table (rank int, display_name text, level int, points int,
               badge_count int, current_streak int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with members as (
    select distinct e.user_id
    from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    where c.room_id = p_room_id
      and e.status in ('active','graduated')
      and (p_cohort_id is null or e.cohort_id = p_cohort_id)
  ), scored as (
    select m.user_id,
           coalesce(sum(pe.points),0)::int as pts,
           max(pe.created_at) as last_earn
    from members m
    left join public.point_events pe on pe.user_id = m.user_id
    group by m.user_id
  )
  select
    (row_number() over (order by s.pts desc, s.last_earn asc nulls last))::int,
    p.first_name || ' ' || left(coalesce(p.last_name,''),1) || '.',
    public.user_level(s.pts),
    s.pts,
    (select count(*)::int from public.badge_awards ba where ba.user_id = s.user_id),
    coalesce(st.current_streak, 0),
    s.user_id = auth.uid()
  from scored s
  join public.profiles p on p.id = s.user_id
  left join public.streaks st on st.user_id = s.user_id
  where public.is_room_member(p_room_id)          -- caller must belong
  order by s.pts desc, s.last_earn asc nulls last;
$$;
grant execute on function public.get_leaderboard(uuid, uuid) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.point_events enable row level security;
alter table public.streaks enable row level security;
alter table public.badges enable row level security;
alter table public.badge_awards enable row level security;

create policy "points_select_own" on public.point_events for select
  using (user_id = auth.uid());
create policy "points_select_staff" on public.point_events for select
  using (public.is_staff());

create policy "streaks_select_own" on public.streaks for select
  using (user_id = auth.uid());
create policy "streaks_select_staff" on public.streaks for select
  using (public.is_staff());

create policy "badges_select_all" on public.badges for select
  to authenticated using (true);

create policy "badge_awards_select_own" on public.badge_awards for select
  using (user_id = auth.uid());
create policy "badge_awards_select_staff" on public.badge_awards for select
  using (public.is_staff());

-- No insert/update/delete policies anywhere: every write flows through
-- security-definer functions triggered by real platform events.

-- Realtime for live point toasts
alter publication supabase_realtime add table public.point_events;

-- Badge seed
insert into public.badges (slug, name, description, icon) values
  ('first-steps','First Steps','Complete your first lesson','footprints'),
  ('quiz-whiz','Quiz Whiz','Pass your first quiz','help-circle'),
  ('sharpshooter','Sharpshooter','Score 100% on a quiz','target'),
  ('shipped-it','Shipped It','Get your first assignment approved','package-check'),
  ('front-row','Front Row','Attend your first live class','video'),
  ('on-fire','On Fire','Hit a 7-day streak','flame'),
  ('deployed','Deployed','Get your capstone verified at a real business','rocket'),
  ('graduate','Graduate','Complete the program','graduation-cap'),
  ('island-legend','Island Legend','Reach Level 5','crown')
on conflict (slug) do nothing;
