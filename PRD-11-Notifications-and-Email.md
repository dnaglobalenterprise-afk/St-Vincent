# PRD 11 — Notifications & Email

## Overview

This PRD builds the notification system for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

Every earlier PRD deferred its "tell the user" moment here. This PRD delivers all of them through two channels:
1. **In-app notification center:** a bell in the app header with a live unread count, fed by database triggers on real platform events, delivered in realtime.
2. **Email via Resend:** branded, bright, SVG-colors templates, sent through a reliable **outbox pattern** — triggers write rows to an outbox table; a scheduled Edge Function drains it every minute with retries. No email is ever sent directly from a database trigger, so a Resend outage can never break a platform action.

Events covered (source → recipient):
- Assignment reviewed (approved / changes requested) → student
- Capstone: match decided, evidence reviewed, showcase published → student; new match request and new evidence submitted → staff
- Admissions: waitlisted / declined decisions → applicant email (acceptance already sends the Supabase invite; this adds the other two)
- New application submitted and new business registered → admins (in-app)
- Live class reminder (60 minutes before start) → the class's audience
- @Mention in community → mentioned member (in-app always; email off by default)
- New DM → recipient (in-app only)
- Graduation → student (in-app + email with certificate link)
- **Announcements:** staff compose a message to a cohort or whole room → in-app + email

Also delivered: per-user email preference toggles with a settings page (the unsubscribe link target in every email footer), and the email log for admin visibility.

**Design law (applies to every screen and every email):** bright only. White and light-blue backgrounds carrying SVG's national colors. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, Supabase Realtime for the live bell
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres triggers (notification + outbox writes), RLS, two scheduled Edge Functions (`process-email-outbox` every minute, `class-reminders` every 15 minutes) configured via Supabase Cron, one RPC for announcements
- **Email:** Resend (API key in Edge Function env only). Sender: `SVG AI Institute <hello@{domain}>` (env-configured)
- **Existing foundation this PRD builds on:** app shell (AppLayout header), base UI components, `profiles` + roles, all helpers, and the event-source tables/flows: `submissions`, `capstone_projects`, `showcase_entries`, `applications`, `business_partners`, `live_classes`, `message_mentions`, `dm_messages`, `enrollments`, `certificates`, `cohorts`, `rooms`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

## What to Build

### 1. In-app notification center

- **Bell icon** in the AppLayout header (all roles): unread count badge (svgblue-500 dot with number, "9+" cap). Realtime subscription on the user's own `notifications` inserts updates the count and pops nothing (no toast spam; the bell pulses once).
- **Dropdown (desktop) / full page `/notifications` (mobile and "See all"):** list of notification rows — type icon, title (semibold), body line, relative time (AST), unread rows on svgblue-50. Click marks read and navigates to `link`. Header actions: "Mark all read". Paged 30. Empty state: "All caught up."
- Notification types and their icons/links:

| type | icon | link target |
|---|---|---|
| `assignment_reviewed` | clipboard-check | the lesson player |
| `capstone_update` | rocket | `/learn/capstone` |
| `showcase_published` | globe | the public showcase page |
| `staff_queue` (new application / business / match request / evidence) | inbox | the relevant admin/teach queue |
| `class_reminder` | video | `/learn/classes` |
| `mention` | at-sign | `/community` (channel deep-link) |
| `dm` | message-circle | `/community` (conversation deep-link) |
| `graduated` | graduation-cap | `/dashboard` |
| `announcement` | megaphone | `/dashboard` or link provided |

### 2. Event triggers (in-app writes)

Database trigger functions on existing tables insert `notifications` rows (and `email_outbox` rows where the matrix in section 4 says so). Exact events:
- `submissions` UPDATE to `approved`/`changes_requested` → student.
- `capstone_projects` UPDATE to `matched`/`declined`/`verified`/`changes_requested` → student; INSERT (status `requested`) and UPDATE to `submitted` → all staff.
- `showcase_entries` UPDATE to `published` → student.
- `applications` INSERT → all admins. UPDATE to `waitlisted`/`declined` → outbox email to the applicant address (no in-app; applicants have no account).
- `business_partners` INSERT (status `pending`) → all admins.
- `message_mentions` INSERT → mentioned user (skip self-mention).
- `dm_messages` INSERT → the other participant (skip when author = recipient side).
- `enrollments` UPDATE to `graduated` → student (include certificate link; the certificate row exists by then).
- Guard every trigger: never notify the actor about their own action.

### 3. Email — outbox pattern

- **`email_outbox` table:** recipient email, template key, JSON payload, status (`pending`/`sent`/`failed`), attempts, last_error, scheduled_at.
- **`process-email-outbox` Edge Function** (cron: every minute): claims up to 25 pending rows past `scheduled_at` (SKIP LOCKED), renders the template, sends via Resend, marks `sent` (with Resend id) or increments attempts (retry with backoff: +2 min, +10 min, +60 min; after 4 failures mark `failed`). Idempotent by row claim.
- **Preference check happens at enqueue time** for platform users (the trigger reads `notification_prefs`); applicant decision emails bypass prefs (no account).
- **Templates** (shared HTML base: white background, top bar of three thin stripes blue/gold/green, wordmark, ink text, one primary blue button, footer with "Manage email preferences" link to `/settings/notifications` and Kingstown SVG address line):
  - `assignment_reviewed` (decision, feedback excerpt, button to lesson)
  - `capstone_update` (state-specific copy, button)
  - `application_waitlisted` / `application_declined` (kind, reapply-next-cohort copy)
  - `class_reminder` (title, AST time, join hint, button)
  - `graduated` (celebration, certificate link + verify code)
  - `announcement` (title + body markdown rendered)
- Plain-text alternative part for every template.

### 4. Channel matrix (defaults)

| Event | In-app | Email | Pref toggle |
|---|---|---|---|
| Assignment reviewed | ✓ | ✓ | `email_reviews` (on) |
| Capstone updates | ✓ | ✓ | `email_reviews` (on) |
| Showcase published | ✓ | ✓ | `email_reviews` (on) |
| Class reminder (T-60m) | ✓ | ✓ | `email_classes` (on) |
| Mention | ✓ | ✗ default | `email_community` (off) |
| New DM | ✓ | ✗ | — |
| Graduation | ✓ | ✓ | always (celebration) |
| Announcements | ✓ | ✓ | `email_announcements` (on) |
| Staff queue events | ✓ | ✗ | — |
| Applicant decisions | n/a | ✓ | n/a (no account) |

### 5. Class reminders

**`class-reminders` Edge Function** (cron: every 15 minutes): find `live_classes` with status `scheduled`, starting between 45 and 75 minutes from now, not yet in `class_reminders_sent` → resolve the audience (room members, narrowed to the cohort when set) → insert notifications + outbox rows (prefs respected) → record the class in `class_reminders_sent`. Exactly-once per class guaranteed by that table's primary key.

### 6. Announcements

- Staff compose at `/teach/announcements`: Title*, Body* (markdown), Audience* (room-wide, or one cohort), Send button with confirm showing recipient count. Calls `send_announcement` RPC: staff-only, stores the announcement, fan-outs notifications + outbox rows (prefs respected).
- History list of past announcements (title, audience, sent count, date).

### 7. Settings page — `/settings/notifications`

Authenticated. Four labeled toggles matching the pref columns, saved on change with a subtle confirmation. Copy under the header: "In-app notifications always work. These control email only." This page is every email footer's "Manage email preferences" target.

### 8. Seed additions

Seed: default prefs rows for test users; three unread notifications of different types for the test student; one pending outbox row with a fake template payload (so the processor run is observable); one sent announcement.

## Data / Schema

Full SQL, migration `supabase/migrations/0011_notifications.sql`. Existing objects used, not modified except where triggers are ADDED to existing tables (no column changes anywhere).

```sql
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
```

Edge Function configuration (document in README): Supabase Cron schedules — `process-email-outbox` `* * * * *`, `class-reminders` `*/15 * * * *`; env vars `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`.

## Acceptance Criteria

Verify by hand with two browsers, a real inbox you control, and the cron functions invoked manually where waiting is impractical. All at 375px too.

- [ ] Bell shows the live unread count; a triggered event increments it within a second without refresh; open → mark read → count drops; "Mark all read" works
- [ ] Assignment approval fires the in-app notification with the correct deep link AND lands a branded email (three-stripe header, blue button, prefs footer link) in a real inbox
- [ ] Turning `email_reviews` off stops the email but never the in-app row (repeat the flow and check the outbox has no new row)
- [ ] Capstone request/evidence notify all staff; student capstone decisions notify the student; nobody is ever notified of their own action (verify: instructor approving sees no self-notification)
- [ ] Waitlist and decline decisions email the applicant address with kind copy (no in-app; no account)
- [ ] New application and new business each ping all admins in-app
- [ ] Mention notifies the mentioned member in-app; email only after enabling `email_community`; self-mentions are silent; DM pings the recipient in-app only
- [ ] Graduation sends the celebration email containing the working certificate link and verify code
- [ ] Class reminders: schedule a class ~60 minutes out, run `class-reminders` manually — audience gets in-app + email exactly once; running the function again sends nothing (exactly-once proven); a cohort-scoped class only reminds that cohort
- [ ] Outbox processor: with a valid pending row it sends and marks `sent` with the Resend id; with a bad address it retries with growing `scheduled_at` and marks `failed` after 4 attempts with `last_error` populated
- [ ] Announcement: compose to one cohort, confirm shows the correct recipient count, recipients get in-app + email, history records it; a student calling `send_announcement` gets `forbidden`
- [ ] Settings page toggles persist and are honored; every email's footer preferences link lands there
- [ ] RLS: a user cannot read another's notifications or prefs; NO client (any role) can select or write `email_outbox` (console-verified)
- [ ] Plain-text parts exist on every template; emails render acceptably in Gmail mobile

## Hand-off Note

PRD 11 closes every deferred "tell them" moment across the platform with a bell that's live, emails that are branded and preference-respecting, and an outbox that survives provider outages with retries — nothing in the product ever blocks on email delivery. Announcements give the teaching team a real megaphone.

Run the full matrix in the criteria with a real inbox before moving on. Next in sequence: PRD 12 — Admin Dashboard, the final PRD.
