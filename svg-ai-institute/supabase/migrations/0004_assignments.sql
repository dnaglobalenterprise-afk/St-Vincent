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
