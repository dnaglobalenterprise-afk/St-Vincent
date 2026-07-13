# PRD 03 — Rooms & Course Engine

## Overview

This PRD builds the learning core of the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Delivered here:
- **Rooms architecture.** A room is a school (v1 ships exactly one: "School of AI Automation"). Rooms own courses and, in later PRDs, live classes, community, leaderboards, and an AI coach scope. Schools 2-4 (Digital Marketing, Prompt Engineering, Video Products) must activate later by inserting a room row, with zero rebuild.
- **Course engine.** Course → Module (week) → Lesson hierarchy with lesson types `video`, `text`, and `quiz` (an `assignment` type and a `replay` type are added by later PRDs; the enum ships with all five values now so no future migration touches it).
- **Progression gates enforced server-side.** A student cannot read Week N+1 lesson content until every required lesson in Week N is complete. Enforcement lives in the database (security-definer RPC), not just hidden UI.
- **Admin authoring:** room CRUD, course builder with module/lesson ordering, lesson editors per type, Mux video upload, publish states.
- **Student experience:** program outline with locked/unlocked weeks, the lesson player for all three types, progress tracking, quizzes with pass threshold, and a dashboard progress card.

Cohorts (which exist already) gain a `room_id` linkage: a cohort is a dated run of a room's program, and room membership derives from active enrollment in a cohort belonging to that room.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. Completion is always green; locked states are neutral with a lock icon, never scary.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `react-markdown` for text lessons, `@mux/mux-player-react` for video playback
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, security-definer RPCs for gated content, two Edge Functions for Mux (create direct upload, webhook receiver)
- **Video:** Mux (direct uploads, asset processing, playback IDs)
- **Existing foundation this PRD builds on:** app shell/layouts, base UI components (Button, Card, Input, Badge, Spinner, EmptyState, PageHeader, DiamondMotif), `profiles` + roles + `current_user_role()`, `set_updated_at()`, ProtectedRoute, `cohorts` and `enrollments` tables from the admissions build

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

This PRD's mappings: completed lesson/module = svggreen-500 check; current lesson = svgblue-500 ring; locked = ink-muted lock icon on surface-alt; quiz pass = green celebration; quiz fail = warning (not danger) with retry encouragement.

## What to Build

### 1. Rooms — admin CRUD `/admin/rooms`

ProtectedRoute `allowedRoles: ['admin']`.
- List of room Cards: name, slug, description, status Badge (draft/active/archived), count of linked cohorts and courses.
- Create/edit modal: Name*, Slug* (auto from name, editable, unique), Description*, Status.
- Room detail `/admin/rooms/:id`: room info header + two sections: **Cohorts** (list of cohorts linked to this room, plus a "Link cohort" picker showing unlinked cohorts) and **Courses** (list + "New Course" button).
- Seed requirement: migration seeds the room `School of AI Automation` (slug `ai-automation`, active).

### 2. Course builder — `/admin/courses/:id`

ProtectedRoute `allowedRoles: ['admin']`.
- Course header: Title*, Description, Status (draft/published), room name shown.
- **Module list** (the 8 weeks): ordered Cards with sort controls (up/down buttons; drag optional), each showing title, lesson count, required-lesson count, optional unlock date. Add/edit module modal: Title* (e.g. "Week 1 — AI Fundamentals"), Sort order (auto), Unlock date (optional; empty means completion-gated only).
- **Lessons within a module:** ordered rows with type icon, title, required toggle, published toggle, sort controls. "Add Lesson" opens the type picker (Video / Text / Quiz), then the type editor:
  - **Video editor:** Title*, Description (markdown), Required (default on), Upload zone. Upload flow: client requests an upload URL from the `mux-create-upload` Edge Function → uploads the file directly to Mux → lesson stores `mux_upload_id` with video_status `processing` → the Mux webhook sets `mux_playback_id` and video_status `ready`. Editor shows the processing/ready state and a preview player when ready. Duration (seconds) saved from webhook metadata when available.
  - **Text editor:** Title*, Body* (markdown textarea with a live preview toggle), Required.
  - **Quiz editor:** Title*, Pass threshold % (default 70), Required (default on), and a question list. Each question: Prompt*, 2-6 options, exactly one marked correct, sort order. Add/remove/reorder questions.
- Publish rules: a lesson is visible to students only when the lesson is published AND the course is published AND the room is active.

### 3. Access and gating model (the heart of this PRD)

Definitions, enforced in SQL (schema section):
- **Room member:** staff (admin/instructor), or a user with an `active` or `graduated` enrollment in any cohort whose `room_id` matches.
- **Module unlocked** for a student when BOTH: (a) its `unlock_date` is null or ≤ today, and (b) it is the first module by sort order, or every required published lesson in the previous module is completed by that student.
- **Lesson content gate:** lesson *metadata* (id, title, type, sort, required, module) is readable by room members so the outline can render locked weeks. Lesson *content* (markdown body, mux playback id, quiz questions) is returned only through the `get_lesson_content` RPC, which re-checks the module unlock server-side. Staff bypass gates.
- **Completion:** video and text lessons complete via an explicit "Mark complete" action (one row in `lesson_progress`). Quizzes complete automatically when an attempt scores ≥ the pass threshold. Progress rows are insert-once (unique per user+lesson).

### 4. Student — Program outline `/learn`

ProtectedRoute (any authenticated role; content resolves from the user's room membership).
- Resolve the student's room via their active enrollment; if none, EmptyState "You're not enrolled in a program yet."
- Header: room name, course title, overall progress bar (percent of required published lessons completed, green fill) and "Continue" primary button jumping to the first incomplete unlocked lesson.
- **Week accordion list:** each module Card shows week title, per-week progress (n of m), and state: unlocked (expandable lesson list), current (expanded by default, svgblue-500 accent), completed (green check), or locked (lock icon, ink-muted, subtitle "Unlocks when Week N is complete" or the unlock date). Locked modules show lesson titles greyed, not clickable.
- Lesson rows: type icon (play/file-text/help-circle), title, required Badge if required, green check when complete. Click navigates to the player.

### 5. Student — Lesson player `/learn/lesson/:lessonId`

Layout: main content area + right sidebar (desktop) / collapsible outline (mobile) showing the module's lessons with states.
- On load, call `get_lesson_content(lesson_id)`. If the RPC returns a locked error, render a friendly locked Card ("Finish Week N to unlock this") with a button back to `/learn`. Never render content from any other source.
- **Video lesson:** Mux player (16:9, rounded-xl), description below (markdown), "Mark complete" success-variant button (disabled state flips to green "Completed ✓" once done).
- **Text lesson:** rendered markdown (typographic styles: Sora headings, Inter body, code blocks styled on surface-alt), "Mark complete" at the end.
- **Quiz lesson:** intro Card (question count, pass threshold, attempts unlimited) → one-question-at-a-time flow with progress dots → submit → result screen: score ring (green if pass, warning if fail), per-question review showing correct answers ONLY after a pass (on fail show which were wrong but not the correct options, so retries mean re-thinking, not memorizing), Retry button on fail, Continue on pass. Pass writes completion automatically. Gold confetti on pass is allowed.
- **Prev / Next** navigation across the module respecting order; Next disabled until the current required lesson is complete.

### 6. Dashboard integration

Update the "Your Program" card on `/dashboard`: overall progress bar, current week name, and Continue button to the next incomplete lesson. Show "Week N of 8" computed from module completion (not calendar).

### 7. Edge Functions (Mux)

1. **`mux-create-upload`** — admin-only (verify JWT role). Creates a Mux direct upload (`cors_origin` = site URL, `playback_policy: public` for v1) and returns the upload URL + upload id. Mux token id/secret live in function env only.
2. **`mux-webhook`** — receives Mux webhooks (verify Mux signature header). On `video.asset.ready`: find the lesson by upload id, set `mux_playback_id`, `video_status='ready'`, `duration_seconds`. On failure events set `video_status='errored'`. Document the webhook URL setup step in the README.

### 8. Seed additions

Extend the seed script: link the seeded cohort to the seeded room; create course "AI Automation Program" (published) with all 8 modules matching the locked curriculum (Week 1-2 AI Fundamentals & Prompt Craft as two modules, Week 3 Make, Week 4-5 n8n + WhatsApp as two, Week 6 VAPI Voice Agents, Week 7-8 Capstone as two); into Week 1 seed one text lesson (sample markdown), one quiz (3 sample questions), and one video lesson placeholder (video_status `processing`, no playback id) so every UI state is testable immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0003_rooms_courses.sql`. Existing objects used, not modified: `profiles`, `user_role`, `current_user_role()`, `set_updated_at()`, `enrollments`. The `cohorts` table is altered here; its full resulting schema is restated below for completeness.

```sql
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
```

## Acceptance Criteria

Verify by hand in the running app, including at 375px. Use the seeded room/course/cohort plus the three test users.

- [ ] Admin creates/edits rooms; the seeded "School of AI Automation" room exists and the seeded cohort is linked to it
- [ ] Course builder: modules add/reorder correctly (unique sort enforced), all three lesson editors work, publish toggles behave
- [ ] Mux flow: admin uploads a real video, lesson shows processing, webhook flips it to ready, preview plays
- [ ] Student `/learn` shows the 8-week outline: Week 1 unlocked/current, Weeks 2-8 locked with titles visible and lock messaging
- [ ] Direct navigation to a locked lesson URL renders the locked Card; `get_lesson_content` raises `locked` (verify in network tab)
- [ ] A student calling `get_lesson_content` on an UNPUBLISHED lesson gets `not_found`; staff can fetch it
- [ ] Quiz: questions arrive WITHOUT `correct_idx` (inspect network payload); failing shows wrong indexes but not correct answers; passing at/above threshold auto-completes the lesson with green celebration; retries unlimited
- [ ] `submit_quiz` and `mark_lesson_complete` reject locked lessons even when called directly from the console (server-side gates proven)
- [ ] Completing all required Week 1 lessons unlocks Week 2 on next load; progress bars update on `/learn` and `/dashboard`
- [ ] A quiz question insert/update attempt as a student is blocked by RLS; student cannot select `quiz_questions` directly
- [ ] Students cannot insert rows into `lesson_progress` directly (no policy); only the RPCs succeed
- [ ] A second student's progress is invisible to the first (RLS on progress/attempts verified)
- [ ] Module with a future `unlock_date` stays locked even when the previous week is complete
- [ ] Continue button always lands on the first incomplete unlocked lesson
- [ ] All screens bright, lock states neutral (never danger-red), fully usable at 375px

## Hand-off Note

PRD 03 delivers the learning spine: rooms (one live school, more later with a single insert), the authoring toolchain, gated content with server-side enforcement, quizzes graded in the database, and student progress. The lesson type enum already includes `assignment` and `replay`; the next PRD activates the `assignment` type with submissions and the instructor review loop, and the live-classes PRD activates `replay`.

Run this PRD and verify every server-side gate check in the criteria list by hand, especially the console-level attack attempts, before moving on. Next in sequence: PRD 04 — Assignments & Submissions.
