# PRD 05 — Live Classes & Recordings

## Overview

This PRD builds live classes and the recordings library for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

The program promises one live session per week per instructor, with every session recorded and available afterwards, because students in this audience share devices, work shifts, and lose connectivity; missing a live class must never mean losing the content.

Delivered here:
- **Class scheduling:** instructors/admins create, edit, and cancel classes tied to a room (and optionally a specific cohort), with a student-facing schedule, SVG-timezone display, countdowns, and add-to-calendar (.ics).
- **Two live modes:**
  - **External (default for v1 interactivity):** the class carries a Zoom/Google Meet join URL; students join in one click. Afterwards the instructor uploads the recording file, which is processed through Mux.
  - **Embedded live (Mux):** the platform provisions a Mux live stream; the instructor broadcasts via OBS (RTMP) and students watch an embedded player on the class page. Mux auto-records the stream.
- **Recordings library:** every recording, from either mode, auto-publishes to the room's Replays library when processing completes. No manual upload-then-forget step.
- **Attach to week:** staff can push any recording into a course week as an optional `replay` lesson (the lesson type already exists in the course engine).
- **Lightweight attendance:** a join/watch click is recorded per student per class, feeding the admin dashboard later.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere (the video player chrome itself is exempt; the page around it is not). Text is deep navy `#0B2540`, never pure black. A class that is live NOW gets the gold treatment: gold Badge "LIVE", subtle pulse.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `@mux/mux-player-react` for playback (recordings and embedded live)
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, Edge Functions for Mux live provisioning and the (extended) Mux webhook
- **Video infrastructure:** Mux — live streams (RTMP ingest, public playback policy, auto-recorded assets) and direct uploads for external-mode recordings
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components; `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member(room_id)`, `set_updated_at()`; tables `rooms`, `cohorts` (with `room_id`), `enrollments`, `courses`, `modules`, `lessons` (type enum includes `replay`); the Mux Edge Functions `mux-create-upload` and `mux-webhook`; the student area `/learn`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

Status mapping for this PRD: scheduled = blue Badge · live = gold Badge "LIVE" with pulse · ended = neutral Badge · cancelled = neutral Badge with strikethrough title · recording processing = blue "Processing" · recording ready = green "Watch replay".

**Timezone rule:** all class times are stored as `timestamptz` (UTC) and DISPLAYED in `America/St_Vincent` (AST, UTC-4, no DST) with the label "AST". Never display raw UTC or the browser's guessed timezone without the AST label.

## What to Build

### 1. Instructor/admin — class management `/teach/classes`

ProtectedRoute `allowedRoles: ['admin', 'instructor']`.

1. **List view:** tabs Upcoming / Past / Cancelled. Class Cards: title, room name, cohort Badge (or "All cohorts"), date + time in AST, duration, mode icon (video icon = embedded, external-link icon = external), status Badge, host name.
2. **Create/edit modal:** Title*, Description (markdown, shown to students), Room* (select from active rooms), Cohort (optional select filtered to the room's cohorts; empty = all the room's cohorts), Date + start time* (entered in AST; convert to UTC on save), Duration minutes* (default 90), Mode* (radio: "External meeting link" with URL field required when chosen; "Embedded live stream (OBS)" with helper text), Host (defaults to creator; admin can reassign to another staff profile).
3. **Embedded-mode go-live panel** (visible on the class detail to staff only, once created): calls `get_stream_credentials` RPC and displays RTMP server URL (`rtmp://global-live.mux.com:5222/app`) and the stream key (masked, click-to-reveal, copy button) with a 3-step OBS crib sheet. Status auto-updates: when Mux reports the stream active, class flips to `live`; when idle, flips to `ended`. Manual override buttons: "Mark live" / "Mark ended" (belt-and-braces if webhooks lag).
4. **External-mode wrap-up:** after the scheduled end, the class card shows "Upload recording": file picker → Mux direct upload (reuse the existing upload function) → recording row created in `processing` → webhook flips it `ready`.
5. **Cancel** with confirm dialog + required one-line reason (shown to students on the schedule).

### 2. Student — schedule `/learn/classes`

Route inside the authenticated app; content scoped to the student's room membership (and cohort where a class is cohort-specific).

1. **Next class hero Card** (if any upcoming): title, host, date/time in AST, live countdown (days/hrs/min), Description, and:
   - **Join button:** disabled until 15 minutes before start ("Opens 15 minutes before class"); from T-15 it becomes primary. External mode: opens the meeting URL in a new tab. Embedded mode: routes to the class page `/learn/classes/:id`.
   - **Add to calendar:** downloads a client-generated `.ics` (UTC times, summary, description, URL) named after the class.
2. **Upcoming list:** remaining scheduled classes, compact rows.
3. **Past classes:** each row shows recording state: "Watch replay" (green, links to the recording player), "Processing" (blue, disabled), or "No recording" (neutral).
4. Cancelled classes render greyed with the cancellation reason.

### 3. Student — embedded live class page `/learn/classes/:id`

For embedded-mode classes; external-mode classes never route here (their Join opens the meeting URL).
- Access check: room member (and cohort match if set); otherwise EmptyState.
- Pre-live (before T-15): countdown Card.
- Live: Mux player pointed at the live playback ID, gold LIVE Badge, class title/host, description below. (In-class chat arrives with the community PRD; do not build chat here.)
- Ended: "Class has ended. The replay will appear in your library shortly." with a link to Replays.
- First render of Join/watch fires attendance recording (section 6).

### 4. Replays library `/learn/replays`

- Grid of recording Cards for the student's room: thumbnail (Mux poster frame `https://image.mux.com/{playback_id}/thumbnail.jpg`), title, class date, duration, host. Newest first. Search by title.
- Recording player page `/learn/replays/:id`: Mux player, title, class date, host, description.
- Only `ready` + published recordings appear. Staff see all states in their management view.

### 5. Attach recording to a week

On the staff class/recording detail: "Add to week" → picker of the room's course modules → creates a `replay`-type lesson in that module (published, `required=false`, title = recording title, `mux_playback_id` copied from the recording, sort order appended at end). Show a green toast with a link to the course builder. Idempotent per recording+module (disable if already attached; track via the recording's `attached_lesson_ids`).

### 6. Attendance (lightweight)

Record one row per student per class on first Join click (external) or first live-player render (embedded), via RPC `record_attendance(class_id)`: validates room membership and inserts (on conflict do nothing). Staff class detail shows an attendee count and simple list (name, first-join time). No self-reported hours, no policing; this is signal for the admin dashboard, not surveillance.

### 7. Edge Functions

1. **`mux-create-live`** (staff-only, JWT-verified): creates a Mux live stream — `playback_policy: public`, `new_asset_settings: { playback_policy: public }` (auto-record on), latency mode standard. Stores `mux_live_stream_id` + live `playback_id` on the class and the stream key in `live_class_secrets`. Called automatically when an embedded-mode class is created.
2. **`mux-webhook`** (extend the existing function; same endpoint):
   - `video.live_stream.active` → set the matching class status `live`.
   - `video.live_stream.idle` → set status `ended`.
   - `video.asset.ready`:
     - If the asset belongs to a live stream (`live_stream_id` present) → create a `recordings` row (`ready`) linked to that class with the asset's playback ID and duration.
     - If it matches a pending external-recording upload id → flip that recording row to `ready` with playback ID and duration.
     - Else fall through to the existing lesson-video handling (unchanged).
   - Keep signature verification; unknown events are 200-acknowledged and ignored.

### 8. Seed additions

Seed for the demo room: one upcoming external-mode class (3 days out, with a placeholder meet URL), one upcoming embedded-mode class (7 days out), and one past class with a `ready` recording (use any short processed asset) so schedule, countdown, live states, and the Replays library all render immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0005_live_classes.sql`. Existing objects used, not modified: `profiles`, roles, `current_user_role()`, `is_staff()`, `is_room_member()`, `set_updated_at()`, `rooms`, `cohorts`, `enrollments`, `lessons`.

```sql
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
```

## Acceptance Criteria

Verify by hand in the running app, including at 375px. Times must display in AST everywhere.

- [ ] Staff creates an external-mode class; it appears on the student schedule with correct AST time and live countdown
- [ ] Join button is disabled before T-15 and becomes active at T-15 (test by scheduling a class 16 minutes out and waiting)
- [ ] .ics download imports correctly into Google Calendar with the right time
- [ ] Creating an embedded-mode class auto-provisions the Mux live stream; staff see RTMP URL + masked stream key with copy buttons; students can NEVER read the stream key (verify direct select on `live_class_secrets` fails, and the RPC raises `forbidden` for a student)
- [ ] Broadcasting to the RTMP URL via OBS flips the class to LIVE (gold pulsing badge) via webhook; students on the class page see the live video; stopping the stream flips it to ended
- [ ] The Mux-recorded live asset appears in Replays automatically as ready, with thumbnail and duration
- [ ] External-mode wrap-up: uploading a recording file creates a processing recording that flips to ready via webhook and appears in Replays
- [ ] A cohort-scoped class is invisible to a member of a different cohort in the same room (create a second cohort/user to verify)
- [ ] Cancelling requires a reason; students see the greyed row with the reason
- [ ] "Add to week" creates an unpublished-gates-respecting optional replay lesson in the chosen module, playable in the lesson player, and the action is disabled on repeat for the same module
- [ ] First Join/watch records attendance exactly once (click twice, one row); staff see the attendee list; a non-member calling `record_attendance` gets `forbidden`
- [ ] Replays library renders thumbnails, search works, processing/errored recordings are hidden from students
- [ ] All pages bright; only the video player surface itself is dark; whole flow usable at 375px

## Hand-off Note

PRD 05 delivers the live layer and closes the promise that no student loses content by missing a class: schedule, join, watch live (either mode), and every recording auto-lands in the Replays library, attachable into course weeks as optional replay lessons. Class reminders (email/in-app before start) intentionally wait for the notifications PRD.

Run this PRD with a real OBS broadcast test for the embedded path and a real file upload for the external path before moving on. Next in sequence: PRD 06 — Capstone Pipeline, the differentiator of the entire platform.
