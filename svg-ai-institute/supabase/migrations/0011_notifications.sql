-- ============================================
-- PRD 11: Notifications, prefs, email outbox, announcements
-- ============================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

create table public.notification_prefs (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  email_reviews       boolean not null default true,
  email_classes       boolean not null default true,
  email_community     boolean not null default false,
  email_announcements boolean not null default true
);

create table public.email_outbox (
  id           uuid primary key default gen_random_uuid(),
  to_email     text not null,
  template     text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
               check (status in ('pending','sent','failed')),
  attempts     int not null default 0,
  last_error   text,
  resend_id    text,
  scheduled_at timestamptz not null default now(),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index email_outbox_pending_idx
  on public.email_outbox (status, scheduled_at);

create table public.class_reminders_sent (
  class_id uuid primary key references public.live_classes(id) on delete cascade,
  sent_at  timestamptz not null default now()
);

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id),
  room_id    uuid not null references public.rooms(id),
  cohort_id  uuid references public.cohorts(id),  -- null = whole room
  title      text not null,
  body       text not null,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Default prefs on profile creation
create or replace function public.handle_new_profile_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_prefs (user_id) values (new.id)
    on conflict do nothing;
  return new;
end;
$$;
create trigger profile_prefs_on_create
  after insert on public.profiles
  for each row execute function public.handle_new_profile_prefs();

-- ============================================
-- Internal helpers
-- ============================================

create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function public.enqueue_email(
  p_user uuid, p_pref text, p_template text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; allowed boolean := true;
begin
  select email into v_email from public.profiles where id = p_user;
  if v_email is null then return; end if;
  if p_pref is not null then
    execute format('select %I from public.notification_prefs where user_id = $1', p_pref)
      into allowed using p_user;
    if not coalesce(allowed, true) then return; end if;
  end if;
  insert into public.email_outbox (to_email, template, payload)
    values (v_email, p_template, p_payload);
end;
$$;

create or replace function public.notify_staff(
  p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link
  from public.profiles where role in ('admin','instructor');
$$;

-- ============================================
-- Event triggers (each guards against self-notification)
-- ============================================

create or replace function public.notif_submission_reviewed()
returns trigger language plpgsql security definer set search_path = public as $$
declare l_title text;
begin
  if new.status in ('approved','changes_requested')
     and old.status = 'submitted' and new.user_id <> auth.uid() then
    select title into l_title from public.lessons where id = new.lesson_id;
    perform public.notify(new.user_id, 'assignment_reviewed',
      case when new.status='approved' then 'Assignment approved ✓'
           else 'Feedback on your assignment' end,
      l_title, '/learn/lesson/' || new.lesson_id);
    perform public.enqueue_email(new.user_id, 'email_reviews',
      'assignment_reviewed',
      jsonb_build_object('lesson_title', l_title, 'decision', new.status,
                         'feedback', left(coalesce(new.feedback,''), 300),
                         'lesson_id', new.lesson_id));
  end if;
  return new;
end;
$$;
create trigger notif_on_submission_review
  after update on public.submissions
  for each row execute function public.notif_submission_reviewed();

create or replace function public.notif_capstone_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_staff('staff_queue', 'New capstone match request',
      null, '/teach/capstones');
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      perform public.notify_staff('staff_queue', 'Capstone evidence submitted',
        null, '/teach/capstones');
    elsif new.status in ('matched','declined','verified','changes_requested')
          and new.user_id <> auth.uid() then
      perform public.notify(new.user_id, 'capstone_update',
        case new.status
          when 'matched' then 'Capstone match approved 🎉'
          when 'verified' then 'Your capstone is VERIFIED 🚀'
          when 'changes_requested' then 'Capstone feedback is in'
          else 'Capstone match update' end,
        null, '/learn/capstone');
      perform public.enqueue_email(new.user_id, 'email_reviews',
        'capstone_update', jsonb_build_object('status', new.status));
    end if;
  end if;
  return new;
end;
$$;
create trigger notif_on_capstone
  after insert or update on public.capstone_projects
  for each row execute function public.notif_capstone_changes();

create or replace function public.notif_showcase_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    select user_id into v_user from public.capstone_projects where id = new.project_id;
    perform public.notify(v_user, 'showcase_published',
      'Your project is live on the Outcomes Board 🌍',
      new.headline, '/outcomes/' || new.slug);
    perform public.enqueue_email(v_user, 'email_reviews', 'capstone_update',
      jsonb_build_object('status', 'published', 'slug', new.slug));
  end if;
  return new;
end;
$$;
create trigger notif_on_showcase
  after update on public.showcase_entries
  for each row execute function public.notif_showcase_published();

create or replace function public.notif_application_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_staff('staff_queue', 'New application received',
      new.first_name || ' ' || new.last_name, '/admin/applications');
    return new;
  end if;
  if new.status in ('waitlisted','declined') and new.status is distinct from old.status then
    insert into public.email_outbox (to_email, template, payload)
      values (new.email,
              'application_' || new.status,
              jsonb_build_object('first_name', new.first_name,
                                 'ref_code', new.ref_code));
  end if;
  return new;
end;
$$;
create trigger notif_on_application
  after insert or update on public.applications
  for each row execute function public.notif_application_events();

create or replace function public.notif_business_registered()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff('staff_queue', 'New business registered',
    new.name, '/admin/businesses');
  return new;
end;
$$;
create trigger notif_on_business
  after insert on public.business_partners
  for each row execute function public.notif_business_registered();

create or replace function public.notif_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.messages where id = new.message_id;
  if new.mentioned_id <> author then
    perform public.notify(new.mentioned_id, 'mention',
      'You were mentioned', null, '/community');
    perform public.enqueue_email(new.mentioned_id, 'email_community',
      'mention', '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger notif_on_mention
  after insert on public.message_mentions
  for each row execute function public.notif_mention();

create or replace function public.notif_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select case when dc.user_low = new.author_id then dc.user_high else dc.user_low end
    into other
    from public.dm_conversations dc where dc.id = new.conversation_id;
  perform public.notify(other, 'dm', 'New message', null, '/community');
  return new;
end;
$$;
create trigger notif_on_dm
  after insert on public.dm_messages
  for each row execute function public.notif_dm();

create or replace function public.notif_graduated()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if new.status = 'graduated' and old.status is distinct from 'graduated' then
    select code into v_code from public.certificates
      where user_id = new.user_id and cohort_id = new.cohort_id;
    perform public.notify(new.user_id, 'graduated',
      'You graduated 🎓', 'Your certificate is ready.', '/dashboard');
    insert into public.email_outbox (to_email, template, payload)
      select p.email, 'graduated',
             jsonb_build_object('first_name', p.first_name, 'code', v_code)
      from public.profiles p where p.id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger notif_on_graduation
  after update on public.enrollments
  for each row execute function public.notif_graduated();

-- ============================================
-- Announcements RPC
-- ============================================
create or replace function public.send_announcement(
  p_room_id uuid, p_cohort_id uuid, p_title text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if coalesce(length(trim(p_title)),0) < 3
     or coalesce(length(trim(p_body)),0) < 10 then
    raise exception 'too_short';
  end if;
  for r in
    select distinct e.user_id, p.email, p.first_name
    from public.enrollments e
    join public.cohorts c on c.id = e.cohort_id
    join public.profiles p on p.id = e.user_id
    where c.room_id = p_room_id
      and e.status in ('active','graduated')
      and (p_cohort_id is null or e.cohort_id = p_cohort_id)
  loop
    perform public.notify(r.user_id, 'announcement', p_title,
      left(p_body, 140), '/dashboard');
    perform public.enqueue_email(r.user_id, 'email_announcements',
      'announcement', jsonb_build_object('title', p_title, 'body', p_body,
                                         'first_name', r.first_name));
    n := n + 1;
  end loop;
  insert into public.announcements (author_id, room_id, cohort_id, title, body, sent_count)
    values (auth.uid(), p_room_id, p_cohort_id, trim(p_title), trim(p_body), n);
  return n;
end;
$$;
grant execute on function public.send_announcement(uuid, uuid, text, text) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.email_outbox enable row level security;
alter table public.class_reminders_sent enable row level security;
alter table public.announcements enable row level security;

create policy "notifications_select_own" on public.notifications for select
  using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "prefs_own" on public.notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- email_outbox and class_reminders_sent: NO client policies at all.
-- Only the service role (Edge Functions) touches them.

create policy "announcements_select_staff" on public.announcements for select
  using (public.is_staff());

-- Realtime for the live bell
alter publication supabase_realtime add table public.notifications;


-- Added post-authoring: prefs backfill + atomic outbox claim (SKIP LOCKED lease)

-- Backfill prefs for existing profiles (trigger only covers new inserts)
insert into public.notification_prefs (user_id)
  select id from public.profiles on conflict do nothing;

-- Atomic outbox claim: lease up to p_limit due rows for 5 min (hidden from
-- concurrent processor runs via FOR UPDATE SKIP LOCKED), return them to send.
create or replace function public.claim_email_batch(p_limit int default 25)
returns setof public.email_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select id from public.email_outbox
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit p_limit
  )
  update public.email_outbox o
    set scheduled_at = now() + interval '5 minutes'
  from picked where o.id = picked.id
  returning o.*;
end;
$$;
