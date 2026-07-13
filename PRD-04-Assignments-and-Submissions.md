# PRD 04 — Assignments & Submissions

## Overview

This PRD activates the `assignment` lesson type for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Assignments are the weekly proof-of-work. The program's promise is "a school for people who finish things," and this PRD is where finishing gets recorded and verified. A student submits work (a link to their Make/n8n scenario, a text write-up, and/or an uploaded file or screenshot), an instructor reviews it, gives feedback, and either approves it or requests changes. Approval completes the lesson, which feeds the week-unlock progression gates that already exist in the course engine.

Delivered here: the assignment lesson editor for admins, the student submission experience inside the lesson player (with a resubmission loop and feedback history), the instructor review queue sized for a 2-3 person teaching team, a Supabase Storage bucket with locked-down policies for file uploads, and full schema with Row Level Security. Approval is the ONLY path to assignment completion, and it is enforced server-side.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. Approved = green; changes requested = warning gold-orange, framed as coaching, never as failure.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `react-markdown` for instructions and feedback rendering
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, security-definer RPCs for submission and review, Supabase Storage for file uploads
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components (Button, Card, Input, Badge, Spinner, EmptyState, PageHeader); `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member(room_id)`, `is_module_unlocked(module_id)`, `set_updated_at()`; tables `rooms`, `courses`, `modules`, `lessons` (whose `lesson_type` enum already contains `assignment`), `lesson_progress`, `enrollments`, `cohorts`; the student lesson player at `/learn/lesson/:lessonId`; the gated content RPC `get_lesson_content`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

Status mapping for this PRD: `submitted` = blue Badge "In review" · `changes_requested` = warning Badge "Changes requested" · `approved` = green Badge "Approved". There is no red/failed state for assignments; the loop is submit → coach → resubmit until approved.

## What to Build

### 1. Assignment lesson editor (admin course builder extension)

In the existing course builder, the "Add Lesson" type picker gains **Assignment**. The assignment editor:
- Title*, Required (default on), Published toggle.
- **Instructions*** (markdown textarea with preview): what to build, what to submit, what "done" looks like. Encourage authors to end with a checklist.
- **Accepted submission kinds*** (checkboxes, at least one): Link (e.g. Make/n8n scenario share URL, Loom video), Text write-up, File upload (screenshots, exports, PDFs).
- Instructions are stored in the lesson's existing `body_markdown` content field and served to students exclusively through the existing gated `get_lesson_content` RPC (which already returns `body_markdown`); the accepted kinds live in a new `submission_kinds` column.

### 2. Student experience — assignment player

When the lesson player loads a lesson of type `assignment` (content via `get_lesson_content`, respecting the existing week gates):

1. **Instructions section:** rendered markdown, on white Card.
2. **Status banner** (when a submission exists): Badge + one-liner — "In review: your instructor will get back to you," "Changes requested: read the feedback below and resubmit," or "Approved ✓" (green, gold confetti moment allowed on first render after approval).
3. **Submission panel:**
   - If no submission yet, or status is `changes_requested`: show the submit form. Tabs or stacked sections matching the lesson's accepted kinds:
     - **Link:** URL input, validated (https:// required). Multiple links allowed (add-row, max 5).
     - **Text:** textarea (markdown supported, min 50 chars).
     - **File:** drag-drop/browse upload zone. Max 20 MB per file, max 5 files. Accepted types: png, jpg, jpeg, webp, pdf, json, txt, csv, mp4 (short screen recordings). Upload to Storage first (path `submissions/{user_id}/{lesson_id}/{uuid}-{filename}`), then include the storage paths in the submit call. Show per-file progress and remove buttons.
   - At least one populated kind is required to submit. Submit button: primary, "Submit for review" (or "Resubmit" in the changes-requested state). Calls the `submit_assignment` RPC.
   - If status is `submitted`: form hidden, show read-only view of what was submitted and a note "You can resubmit after your instructor reviews this." (Prevents review-queue churn from rapid-fire edits.)
4. **Feedback history:** chronological list of review Cards, newest first: reviewer name, date, decision Badge, feedback markdown. Every attempt and its feedback stays visible so the coaching trail is never lost.
5. **Completion behavior:** when a submission is approved, the lesson shows the green Completed state everywhere (outline, dashboard, progress bars) exactly like other lesson types, because approval writes the `lesson_progress` row server-side. Assignments have NO "Mark complete" button under any circumstances.

### 3. Instructor review queue — `/teach/review`

ProtectedRoute `allowedRoles: ['admin', 'instructor']`. This queue is the teaching team's daily driver; keep it fast and keyboard-friendly.

1. **Header stats row** (three small Cards): Awaiting review (count, blue), Changes requested & waiting on students (count, gold), Approved this week (count, green).
2. **Queue list:** default filter status = `submitted`, sorted oldest first (first-in, first-reviewed). Columns/Card fields: student name, cohort, week/module title, assignment title, attempt number, submitted date. Filters: status, cohort, module. Search by student name. Mobile: Cards.
3. **Review detail** (drawer on desktop, page on mobile):
   - Student header: name, cohort, attempt number ("Attempt 2"), link to their prior attempts inline.
   - Assignment title + collapsible instructions (so the reviewer sees what was asked).
   - **Submission content:** links as clickable anchors (open new tab, `rel="noopener noreferrer"`), text rendered as markdown, files as a list with filename, size, and view/download via short-lived signed URLs (60 minutes) generated on click.
   - **Review form:** Feedback* (markdown textarea, min 20 chars — no empty approvals or rejections; students deserve words), then two buttons: success-variant **Approve** and warning-variant **Request changes**. Both call the `review_submission` RPC. Confirm dialog on Approve ("This completes the lesson for the student").
   - After action: toast, drawer closes, queue refreshes, next item focused.

### 4. Server-side rules (enforced in SQL, not React)

- Students can submit only: published assignment lessons, in rooms they are members of, in modules currently unlocked for them, and only when they have no submission with status `submitted` or `approved` for that lesson.
- Resubmission creates a NEW submission row with `attempt_number` incremented; history is immutable (no updates to prior attempts by students).
- Only staff can review; reviewing a submission that is not in `submitted` status is rejected (idempotency and race protection between two instructors).
- Approval inserts the `lesson_progress` row in the same function (on conflict do nothing), which the existing week-gating logic picks up automatically.
- Storage: students can upload/read only inside their own `{user_id}/...` prefix; staff can read all submission files; nothing is publicly readable.

### 5. Seed additions

Extend the seed: add one published assignment lesson to Week 1 ("Build your first prompt-powered helper — submit a link and a screenshot", kinds: link + file + text) and one to Week 3 ("Ship your first Make scenario — submit the scenario share link", kinds: link). Seed one `submitted` submission from the test student on the Week 1 assignment so the review queue renders immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0004_assignments.sql`. Existing objects used, not modified: `profiles`, roles, `current_user_role()`, `is_staff()`, `is_room_member()`, `is_module_unlocked()`, `set_updated_at()`, `lesson_progress`, `modules`, `courses`, `rooms`. The `lessons` table is altered (one column added); its full resulting schema is restated below.

```sql
-- ============================================
-- PRD 04: Assignments & submissions
-- ============================================

-- Accepted submission kinds per assignment lesson
alter table public.lessons
  add column submission_kinds text[] not null default '{}'::text[];

-- Restated full lessons schema after this migration (reference, not executed):
--   id uuid PK · module_id uuid FK modules · type lesson_type
--   ('video'|'text'|'quiz'|'assignment'|'replay') · title text ·
--   sort_order int (unique per module) · required bool (default true) ·
--   published bool (default false) · body_markdown text ·
--   mux_upload_id text · mux_playback_id text ·
--   video_status video_status ('none'|'processing'|'ready'|'errored') ·
--   duration_seconds int · pass_threshold int (1-100) ·
--   submission_kinds text[] (any of 'link'|'text'|'file'; assignments only) ·
--   created_at · updated_at

create type public.submission_status as enum
  ('submitted', 'changes_requested', 'approved');

create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.lessons(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  attempt_number int  not null,
  status         public.submission_status not null default 'submitted',
  links          jsonb not null default '[]'::jsonb,   -- ["https://...", ...] max 5
  text_body      text,
  file_paths     jsonb not null default '[]'::jsonb,   -- storage object paths, max 5
  -- review
  feedback       text,
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (lesson_id, user_id, attempt_number)
);

create index submissions_queue_idx
  on public.submissions (status, created_at);
create index submissions_user_idx
  on public.submissions (user_id, lesson_id);

-- ============================================
-- RPC: student submits (or resubmits) an assignment
-- ============================================
create or replace function public.submit_assignment(
  p_lesson_id uuid,
  p_links jsonb,
  p_text_body text,
  p_file_paths jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record; room uuid; kinds text[]; attempt int; new_id uuid;
  has_content boolean;
begin
  select les.*, c.room_id as rid, mo.id as mid
    into l
    from public.lessons les
    join public.modules mo on mo.id = les.module_id
    join public.courses c  on c.id = mo.course_id
    where les.id = p_lesson_id
      and les.type = 'assignment'
      and les.published;
  if l is null then raise exception 'not_found'; end if;
  if not public.is_room_member(l.rid) then raise exception 'forbidden'; end if;
  if not public.is_module_unlocked(l.mid) then raise exception 'locked'; end if;

  -- Block while an attempt is pending or already approved
  if exists (select 1 from public.submissions s
             where s.lesson_id = p_lesson_id and s.user_id = auth.uid()
               and s.status in ('submitted','approved')) then
    raise exception 'already_pending_or_approved';
  end if;

  -- Validate content against accepted kinds
  kinds := l.submission_kinds;
  if jsonb_array_length(coalesce(p_links,'[]'::jsonb)) > 0
     and not ('link' = any(kinds)) then raise exception 'kind_link_not_allowed'; end if;
  if coalesce(length(trim(p_text_body)),0) > 0
     and not ('text' = any(kinds)) then raise exception 'kind_text_not_allowed'; end if;
  if jsonb_array_length(coalesce(p_file_paths,'[]'::jsonb)) > 0
     and not ('file' = any(kinds)) then raise exception 'kind_file_not_allowed'; end if;
  if jsonb_array_length(coalesce(p_links,'[]'::jsonb)) > 5
     or jsonb_array_length(coalesce(p_file_paths,'[]'::jsonb)) > 5 then
    raise exception 'too_many_items';
  end if;
  has_content :=
    jsonb_array_length(coalesce(p_links,'[]'::jsonb)) > 0
    or coalesce(length(trim(p_text_body)),0) >= 50
    or jsonb_array_length(coalesce(p_file_paths,'[]'::jsonb)) > 0;
  if not has_content then raise exception 'empty_submission'; end if;

  select coalesce(max(attempt_number),0) + 1 into attempt
    from public.submissions
    where lesson_id = p_lesson_id and user_id = auth.uid();

  insert into public.submissions
    (lesson_id, user_id, attempt_number, links, text_body, file_paths)
  values
    (p_lesson_id, auth.uid(), attempt,
     coalesce(p_links,'[]'::jsonb), nullif(trim(p_text_body),''),
     coalesce(p_file_paths,'[]'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.submit_assignment(uuid, jsonb, text, jsonb)
  to authenticated;

-- ============================================
-- RPC: staff reviews a submission
-- ============================================
create or replace function public.review_submission(
  p_submission_id uuid,
  p_decision public.submission_status,   -- 'approved' or 'changes_requested'
  p_feedback text
)
returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_decision not in ('approved','changes_requested') then
    raise exception 'invalid_decision';
  end if;
  if coalesce(length(trim(p_feedback)),0) < 20 then
    raise exception 'feedback_too_short';
  end if;

  select * into s from public.submissions
    where id = p_submission_id for update;
  if s is null then raise exception 'not_found'; end if;
  if s.status <> 'submitted' then raise exception 'already_reviewed'; end if;

  update public.submissions
    set status = p_decision,
        feedback = trim(p_feedback),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_submission_id;

  if p_decision = 'approved' then
    insert into public.lesson_progress (lesson_id, user_id)
      values (s.lesson_id, s.user_id)
      on conflict do nothing;
  end if;
end;
$$;
grant execute on function public.review_submission(uuid, public.submission_status, text)
  to authenticated;

-- ============================================
-- Row Level Security — submissions
-- ============================================
alter table public.submissions enable row level security;

create policy "submissions_select_own" on public.submissions for select
  using (user_id = auth.uid());
create policy "submissions_select_staff" on public.submissions for select
  using (public.is_staff());
-- No direct insert/update/delete policies:
-- writes flow exclusively through submit_assignment / review_submission.

-- ============================================
-- Storage: submissions bucket + policies
-- ============================================
insert into storage.buckets (id, name, public)
  values ('submissions', 'submissions', false)
  on conflict (id) do nothing;

-- Students upload only under their own user-id prefix
create policy "submissions_upload_own" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Students read their own files
create policy "submissions_read_own" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff read all submission files (for review, via signed URLs)
create policy "submissions_read_staff" on storage.objects for select
  to authenticated
  using (bucket_id = 'submissions' and public.is_staff());

-- No update/delete policies: submitted evidence is immutable from the client.
```

Client-side upload rules to implement alongside: enforce max 20 MB per file and the accepted extension list before upload; total 5 files; sanitize filenames (strip path characters); prefix each stored name with a UUID to prevent collisions and enumeration.

## Acceptance Criteria

Verify by hand in the running app, including at 375px. Use the seeded assignments and test users.

- [ ] Admin can author an assignment lesson: instructions markdown, accepted kinds checkboxes, publish toggle; it appears in the student outline like other lessons and respects week gates
- [ ] Student sees instructions and only the submission inputs matching the accepted kinds
- [ ] Submitting with no content is blocked; a text-only submission under 50 chars is blocked; a 6th link or 6th file is blocked
- [ ] File upload: 20 MB+ file rejected client-side; disallowed extension rejected; upload progress shows; files land under `submissions/{user_id}/{lesson_id}/...`
- [ ] After submit, status shows "In review" and the form is hidden; calling `submit_assignment` again while pending raises `already_pending_or_approved` (verify via console)
- [ ] Instructor queue shows the seeded pending submission with correct stats; filters and oldest-first ordering work
- [ ] Reviewer sees links, text, and files (signed URLs open the actual uploaded file); feedback under 20 chars is rejected
- [ ] Request changes: student sees warning banner + feedback, the form returns as "Resubmit," and the new attempt increments to 2 with full history preserved
- [ ] Approve: confirm dialog, then the student's lesson flips to green Completed, progress bars update, and if it was the last required Week-1 item, Week 2 unlocks
- [ ] Two-instructor race: reviewing an already-reviewed submission raises `already_reviewed` (open the same item in two tabs and decide in both)
- [ ] A student cannot review (`review_submission` raises `forbidden`), cannot read another student's submissions (RLS), and cannot read another student's files in Storage (attempt a path outside their prefix)
- [ ] Submissions cannot be inserted or updated via direct table writes from the client (no policies exist; verify rejection in console)
- [ ] A submission against a locked-week assignment raises `locked` even when called directly
- [ ] All states bright and kind: changes-requested styled as coaching (warning gold), never as red failure; whole flow usable at 375px

## Hand-off Note

PRD 04 closes the weekly proof-of-work loop: build, submit, get coached, resubmit, get approved, unlock the next week. Approval is now the only path to assignment completion and it writes progress server-side, so the existing gates pick it up with zero extra wiring. Decision notifications (email/in-app when feedback lands) intentionally wait for the notifications PRD.

Run this PRD and verify the whole loop with two browsers side by side (student + instructor), including the race-condition and RLS attack checks, before moving on. Next in sequence: PRD 05 — Live Classes & Recordings.
