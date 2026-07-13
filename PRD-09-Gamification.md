# PRD 09 — Gamification

## Overview

This PRD builds the gamification layer for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Gamification here is retention fuel for finishers, not a casino. Points reward real learning actions only (never chat volume, which would invite spam), streaks reward showing up daily, badges mark genuine milestones, and the leaderboard creates friendly cohort pressure. Everything gold: per the platform design system, gold is the color of energy and reward.

Delivered here:
- **Points:** an append-only, server-written ledger. Completing lessons, passing quizzes, approved assignments, attending live classes, verified capstones, and graduation all award points automatically via database triggers on events that already exist. No client can ever write points.
- **Levels:** computed from lifetime points across five named tiers.
- **Streaks:** consecutive-day activity (in AST, the students' timezone), with current and longest tracked.
- **Badges:** seeded definitions, auto-awarded server-side at real milestones.
- **Leaderboard:** per-room ranking with a cohort filter, top 10 plus "your rank," fed by a privacy-safe RPC.
- **Celebration UX:** realtime gold point toasts, the dashboard gamification card, and badge-earn confetti moments.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. Everything in this PRD leans gold: `svggold-500` fills, gold confetti, gold flame.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react (Flame, Trophy, Medal, Star, Zap, Award icons), Supabase Realtime for live point toasts
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres triggers and functions do ALL awarding; RLS everywhere; one leaderboard RPC
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components; `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member()`, `set_updated_at()`; event-source tables `lesson_progress` (written on every lesson completion), `lessons` (type per lesson), `class_attendance`, `capstone_projects` (status `verified`), `enrollments` (status `graduated`), `quiz_attempts` (`score_pct`), `cohorts`, `rooms`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent/reward) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

## What to Build

### 1. Point economy (fixed values, server-awarded)

| Event (existing platform action) | Kind | Points |
|---|---|---|
| Video lesson completed | `lesson_video` | 10 |
| Text lesson completed | `lesson_text` | 10 |
| Replay lesson completed | `lesson_replay` | 5 |
| Quiz passed | `quiz_pass` | 15 |
| Quiz passed with 100% | `quiz_perfect` (bonus, stacks) | +10 |
| Assignment approved | `assignment_approved` | 25 |
| Live class attended | `class_attended` | 15 |
| Capstone verified | `capstone_verified` | 100 |
| Graduated | `graduated` | 150 |
| 7-day streak reached | `streak_7` (each time a fresh 7-run completes) | 20 |

Rules: values live in the awarding functions (single source); every award is one `point_events` row with a `ref_id` (the triggering row's id) and a uniqueness guard so nothing double-awards; deleting/undoing source rows does NOT claw back points (ledger is append-only; keep it simple and generous).

### 2. Levels

Computed from lifetime points, five tiers themed to the school's identity:
- **Level 1 — Spark** (0+)
- **Level 2 — Builder** (100+)
- **Level 3 — Operator** (250+)
- **Level 4 — Systems Boss** (500+)
- **Level 5 — Island Legend** (1000+)

Pure function of the points total (SQL function + mirrored TS util). Level-up detection on the client (previous vs new total crossing a threshold) fires a gold full-screen confetti moment with the new level name.

### 3. Streaks (AST days)

- A day "counts" when the student earns any point event that day, computed in `America/St_Vincent` (UTC-4, no DST) — never UTC, never browser-guessed.
- `streaks` row per user: `current_streak`, `longest_streak`, `last_activity_date` (AST date). Maintained by a trigger on `point_events` insert: same AST date → no change; yesterday → increment; older → reset to 1; longest updated with greatest.
- Completing a 7-day run awards the `streak_7` bonus (again at 14, 21, ... — every fresh multiple of 7 on the current run).
- UI: gold Flame icon + count. Flame renders ink-muted when today has no activity yet ("Keep it alive — do one lesson today").

### 4. Badges

Seeded definitions (slug, name, description, lucide icon), all awarded server-side, each once per user:

| Slug | Name | Awarded when |
|---|---|---|
| `first-steps` | First Steps | First lesson completion of any type |
| `quiz-whiz` | Quiz Whiz | First quiz pass |
| `sharpshooter` | Sharpshooter | First 100% quiz |
| `shipped-it` | Shipped It | First assignment approved |
| `front-row` | Front Row | First live class attended |
| `on-fire` | On Fire | First 7-day streak |
| `deployed` | Deployed | Capstone verified |
| `graduate` | Graduate | Graduation |
| `island-legend` | Island Legend | Reaching Level 5 |

Badge awards happen inside the same awarding functions (no separate cron). UI: badges grid on the profile card — earned in full gold with the icon, unearned as ink-muted outlines with a lock and the "how to earn" description (visible goals drive behavior). Earning fires a gold toast + confetti.

### 5. Leaderboard — `/learn/leaderboard`

- Scope: the user's room. Filter tabs: **My cohort** (default) / **All-time room**.
- Served by the `get_leaderboard` RPC (privacy-safe fields only: display name "Keisha B.", level, points, badge count, streak). Top 10 rows; podium treatment for the top 3 (gold/neutral/bronze-tinted Cards with Trophy/Medal icons); below the list, a "Your rank" Card always shows the current user's own position even outside the top 10.
- Staff are excluded from rankings (they'd pollute it via testing).
- Ties break by earliest achiever (lower `last earned at` ranks higher).
- Empty state pre-activity: "The board is waiting. First lesson takes it."

### 6. Dashboard gamification card + toasts

- **Dashboard card** (replaces the "Your Progress" placeholder): level ring (SVG circular progress toward next level, gold stroke), level name, lifetime points, streak flame, next-level hint ("140 points to Operator"), latest 3 badges, link to the leaderboard.
- **Live point toasts:** subscribe (Supabase Realtime) to the user's own `point_events` inserts; each new event pops a gold toast bottom-center: "+25 — Assignment approved" with the matching icon, auto-dismiss 4s, stacking politely. Badge awards pop their own richer toast.

### 7. Seed additions

Seed: badge definitions (all nine); backfill point events for the test student's existing seeded history (their completed lessons, approved submission, attendance, verified capstone) by re-running the award functions across existing rows in a one-time seed block, so the dashboard card, badges, and leaderboard render with real numbers immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0009_gamification.sql`. Existing objects used, not modified: `profiles`, roles, helpers, `lesson_progress`, `lessons`, `quiz_attempts`, `class_attendance`, `capstone_projects`, `enrollments`, `cohorts`, `rooms`, and the existing triggers on those tables (new triggers added here are additional).

```sql
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
```

## Acceptance Criteria

Verify by hand with the test student (and a second student for the leaderboard), including at 375px.

- [ ] Completing a video lesson awards +10 exactly once (complete, verify ledger, attempt any re-award path — unique guard holds)
- [ ] Quiz pass awards +15; a 100% pass additionally awards +10 and Sharpshooter; a second perfect on the same quiz does not re-award
- [ ] Assignment approval awards +25 and Shipped It; class attendance +15 and Front Row; capstone verification +100 and Deployed; graduation +150 and Graduate (walk each real flow)
- [ ] Admin/instructor actions never create point rows for staff accounts (verify after staff complete a lesson)
- [ ] Streak: activity today sets 1; activity on consecutive AST days increments (test by manipulating `last_activity_date` in the table editor to yesterday and earning); a gap resets to 1; longest never decreases; day 7 pays +20 and On Fire
- [ ] Streak day boundary is AST: an event at 01:00 UTC (21:00 AST previous day) counts for the AST date (verify with a manual timestamp)
- [ ] Levels compute at 0/100/250/500/1000; crossing a threshold fires the level-up confetti with the level name; Level 5 awards Island Legend
- [ ] Dashboard card shows ring, points, streak flame (muted when nothing earned today), next-level hint, latest badges
- [ ] Live gold toast pops within a second of an award without refresh (Realtime proven)
- [ ] Leaderboard: cohort and all-time tabs rank correctly, ties break by earliest earn, staff absent, top-3 podium renders, "Your rank" shows outside top 10 (seed a low-scoring second student)
- [ ] A non-member calling `get_leaderboard` for a foreign room gets zero rows; payload contains only display name/level/points/badge count/streak — no emails, no user ids
- [ ] Students cannot insert into any gamification table from the console (no policies — verified rejection)
- [ ] Everything gold, bright, celebratory; usable at 375px

## Hand-off Note

PRD 09 wires reward to reality: points only flow from verified learning actions through database triggers, streaks run on island time, badges mark true milestones, and the leaderboard is privacy-safe and staff-free. Nothing is client-writable, so the economy cannot be gamed from a console.

Run the full award matrix in the criteria (every event type once, plus the double-award and staff-exclusion checks) before moving on. Next in sequence: PRD 10 — AI Study Coach.
