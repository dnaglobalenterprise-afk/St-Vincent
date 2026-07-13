# PRD 08 — Community

## Overview

This PRD builds the community layer for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

The community is a retention engine, not a Discord black hole. Structure over noise: a small set of purposeful channels per room, single-level threads so conversations stay attached to the work, @mentions, and 1:1 direct messages. All members are adults (18-30 admissions gate), so there is no guardian layer, but there IS a moderation layer sized for a 2-3 person teaching team: staff can delete any message (soft delete, auditable) and mute a member for a set period, enforced server-side.

Delivered here: room channels with realtime messaging (Supabase Realtime), threads, mentions with autocomplete, DMs, edit/delete-own, staff moderation tools, server-side rate limiting and mute enforcement, and full schema with RLS. Mention/DM notifications intentionally wait for the notifications PRD; mentions are stored now so notifications can backfill behavior later.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors (blue, gold, green). No dark backgrounds anywhere; this chat looks like a sunny classroom, not a gamer cave. Text is deep navy `#0B2540`, never pure black.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS, security-definer RPCs for all writes, **Supabase Realtime** (postgres_changes subscriptions) for live message delivery
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components; `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member(room_id)`, `set_updated_at()`; tables `rooms`, `cohorts`, `enrollments`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

This PRD's mappings: own messages get an svgblue-50 bubble; others' messages white with `line` border; staff authors get a small gold "Instructor"/"Admin" Badge; mentions render as svgblue-500 pills; the #wins channel gets a gold accent header.

## What to Build

### 1. Community layout — `/community`

Authenticated route, scoped to the user's room (staff can switch rooms via a dropdown; students land in their room automatically; users with no room membership see an EmptyState).

Desktop: three-zone layout — left sidebar (channels + DMs), center message pane, right thread panel (opens on demand). Mobile (375px-first): single pane with a channel/DM switcher sheet; threads open as a full-screen overlay with a back button.

**Left sidebar:**
- Room name header.
- **Channels** section: list with `#` icons; unread dot (svgblue-500) per channel (tracked via `last_read_at`, section 6).
- **Direct messages** section: conversations sorted by latest activity, partner name + preview line + unread dot; "New message" button opening a member picker (searchable list of room members).

### 2. Channels

- Default channels seeded per room: `#general` ("Introduce yourself and talk shop"), `#help` ("Stuck? Ask here — screenshots welcome"), `#wins` ("Ship something? Post it. We celebrate here").
- Admin channel management (in the existing room admin detail): create channel (name lowercase kebab, description), rename, archive (hidden from students, messages preserved). No student-created channels in v1.
- Channel header: name, description, member count.

### 3. Messages

- **Message list:** newest at bottom, infinite scroll upward (paged 50), day divider chips. Each message: avatar (initials circle if none), author name (+ staff Badge), timestamp (AST, relative under 24h), body, thread indicator ("3 replies →" opens the thread panel), and a hover/long-press action menu.
- **Composer:** textarea (auto-grow, max 2000 chars with live counter past 1800), Enter sends / Shift+Enter newline (mobile: send button only). Plain text with auto-linked URLs (`rel="noopener noreferrer"`, target blank). No file attachments in v1 (students share links; screenshots belong in assignment submissions).
- **Threads:** replying opens the thread panel (parent pinned at top, replies below, own composer). One level only: replies cannot have replies. Thread replies do not appear in the main channel flow except via the parent's reply count.
- **Mentions:** typing `@` opens an autocomplete of room members (name-filtered, keyboard navigable). Selected mentions render as blue pills and store rows in `message_mentions`. Mentioning `@here` is NOT supported (spam vector at this scale).
- **Edit own** (within 15 minutes of posting, server-enforced): inline edit, "(edited)" suffix. **Delete own** (any time) and **staff delete any**: soft delete — the message renders as an italic ink-muted "Message removed" placeholder (author sees "You removed this"; staff menu shows who removed it). Bodies of soft-deleted messages are blanked server-side at delete time so removed content is genuinely gone from clients while the moderation record (author, remover, time) remains.
- **Realtime:** subscribe to postgres_changes on `messages` filtered by the open channel (and thread), and on the user's DM conversations. New own-message sends render optimistically, reconciled on the realtime echo.

### 4. Direct messages

- 1:1 only in v1 (group DMs are future scope). Starting a DM with someone creates (or reuses) the canonical conversation row for that pair.
- DM pane mirrors the channel message UI minus threads and mentions-autocomplete (plain @text is fine). Same edit/delete-own rules; staff do NOT read or moderate DM content (privacy), but a muted user cannot send DMs either (mute is room-wide behavior control).
- Any room member may DM any other member of the same room, including instructors.

### 5. Moderation (staff)

- **Delete any channel message** (soft, as above) via the message action menu, with a confirm.
- **Mute member:** from a member's popover (click their name/avatar): duration picker (1 hour / 24 hours / 7 days) + required reason. Muted members see a gold banner above every composer: "You're muted until {time}. Reason: {reason}. Reach out to your instructor with questions." All posting (channels, threads, DMs) is blocked server-side while muted. Unmute button for staff. Mutes are room-scoped and logged.
- **Member list** per room (staff view): name, role, cohort, message count, active mute Badge, mute/unmute action.

### 6. Read state

`channel_reads` (and `dm_reads`) row per user per channel/conversation storing `last_read_at`; opening a pane upserts it. Unread dot = latest message newer than `last_read_at`. Keep it a dot, not a count (cheap, calm, sufficient).

### 7. Server-side rules (all enforced in SQL)

- Posting requires: room membership, not muted, body 1-2000 chars after trim.
- **Rate limit:** max 10 messages per rolling 60 seconds per user across channels+DMs (RPC counts recent rows; violation raises `rate_limited`, UI shows a gentle "Slow down a touch" toast).
- Edit-own only within 15 minutes; delete-own any time; staff delete any channel message but NOT DM messages.
- Thread replies must target a non-deleted parent in the same channel; a reply cannot be a parent.
- DM send requires both participants share a room.
- Mute/unmute is staff-only, requires reason, and writes to the mute log.

### 8. Seed additions

Seed: the three default channels for the demo room; a dozen messages across #general and #help from the test users including one thread with two replies and one mention; one DM conversation between the test student and instructor; so every surface renders immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0008_community.sql`. Existing objects used, not modified: `profiles`, roles, helpers (`is_staff()`, `is_room_member()`, `current_user_role()`, `set_updated_at()`), `rooms`, `enrollments`.

```sql
-- ============================================
-- PRD 08: Community — channels, messages, threads, mentions, DMs, moderation
-- ============================================

create table public.channels (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  name        text not null check (name ~ '^[a-z0-9-]{2,32}$'),
  description text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (room_id, name)
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.channels(id) on delete cascade,
  parent_id   uuid references public.messages(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index messages_channel_idx on public.messages (channel_id, created_at desc);
create index messages_parent_idx on public.messages (parent_id, created_at);

create table public.message_mentions (
  message_id   uuid not null references public.messages(id) on delete cascade,
  mentioned_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (message_id, mentioned_id)
);

create table public.dm_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_low   uuid not null references public.profiles(id) on delete cascade,
  user_high  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low < user_high),
  unique (user_low, user_high)
);

create table public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index dm_messages_conv_idx on public.dm_messages (conversation_id, created_at desc);

create table public.user_mutes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  muted_by   uuid not null references public.profiles(id),
  reason     text not null,
  until_at   timestamptz not null,
  lifted_at  timestamptz,
  created_at timestamptz not null default now()
);
create index user_mutes_active_idx on public.user_mutes (user_id, until_at);

create table public.channel_reads (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  channel_id   uuid not null references public.channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create table public.dm_reads (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

-- ============================================
-- Helpers
-- ============================================

create or replace function public.is_muted(p_user_id uuid, p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_mutes
                 where user_id = p_user_id and room_id = p_room_id
                   and lifted_at is null and until_at > now());
$$;

create or replace function public.check_rate_limit()
returns void language plpgsql stable security definer set search_path = public as $$
declare recent int;
begin
  select (select count(*) from public.messages
          where author_id = auth.uid() and created_at > now() - interval '60 seconds')
       + (select count(*) from public.dm_messages
          where author_id = auth.uid() and created_at > now() - interval '60 seconds')
    into recent;
  if recent >= 10 then raise exception 'rate_limited'; end if;
end;
$$;

-- ============================================
-- RPCs (all writes flow through these)
-- ============================================

create or replace function public.post_message(
  p_channel_id uuid, p_parent_id uuid, p_body text, p_mentions uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare ch record; parent record; new_id uuid; m uuid;
begin
  select c.*, c.room_id as rid into ch from public.channels c
    where c.id = p_channel_id and not c.archived;
  if ch is null then raise exception 'not_found'; end if;
  if not public.is_room_member(ch.rid) then raise exception 'forbidden'; end if;
  if public.is_muted(auth.uid(), ch.rid) then raise exception 'muted'; end if;
  if coalesce(length(trim(p_body)),0) < 1 or length(p_body) > 2000 then
    raise exception 'bad_body';
  end if;
  perform public.check_rate_limit();
  if p_parent_id is not null then
    select * into parent from public.messages
      where id = p_parent_id and channel_id = p_channel_id
        and parent_id is null and deleted_at is null;
    if parent is null then raise exception 'bad_parent'; end if;
  end if;
  insert into public.messages (channel_id, parent_id, author_id, body)
    values (p_channel_id, p_parent_id, auth.uid(), trim(p_body))
    returning id into new_id;
  if p_mentions is not null then
    foreach m in array p_mentions loop
      if public.is_room_member(ch.rid) then  -- mentioned must be resolvable; cheap guard
        insert into public.message_mentions (message_id, mentioned_id)
          values (new_id, m) on conflict do nothing;
      end if;
    end loop;
  end if;
  return new_id;
end;
$$;
grant execute on function public.post_message(uuid, uuid, text, uuid[]) to authenticated;

create or replace function public.edit_message(p_message_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare msg record;
begin
  select * into msg from public.messages where id = p_message_id for update;
  if msg is null or msg.deleted_at is not null then raise exception 'not_found'; end if;
  if msg.author_id <> auth.uid() then raise exception 'forbidden'; end if;
  if msg.created_at < now() - interval '15 minutes' then raise exception 'edit_window_closed'; end if;
  if coalesce(length(trim(p_body)),0) < 1 or length(p_body) > 2000 then raise exception 'bad_body'; end if;
  update public.messages set body = trim(p_body), edited_at = now()
    where id = p_message_id;
end;
$$;
grant execute on function public.edit_message(uuid, text) to authenticated;

create or replace function public.delete_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare msg record;
begin
  select m.*, c.room_id as rid into msg from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.id = p_message_id for update;
  if msg is null or msg.deleted_at is not null then raise exception 'not_found'; end if;
  if msg.author_id <> auth.uid() and not public.is_staff() then raise exception 'forbidden'; end if;
  update public.messages
    set deleted_at = now(), deleted_by = auth.uid(), body = ''
    where id = p_message_id;
end;
$$;
grant execute on function public.delete_message(uuid) to authenticated;

create or replace function public.start_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare lo uuid; hi uuid; conv uuid; shared boolean;
begin
  if p_other = auth.uid() then raise exception 'self_dm'; end if;
  select exists (
    select 1 from public.enrollments e1
    join public.cohorts c1 on c1.id = e1.cohort_id
    where e1.user_id = auth.uid() and e1.status in ('active','graduated')
      and (
        exists (select 1 from public.enrollments e2
                join public.cohorts c2 on c2.id = e2.cohort_id
                where e2.user_id = p_other and e2.status in ('active','graduated')
                  and c2.room_id = c1.room_id)
        or exists (select 1 from public.profiles pf
                   where pf.id = p_other and pf.role in ('admin','instructor'))
      )
  ) or public.is_staff() into shared;
  if not shared then raise exception 'not_shared_room'; end if;
  lo := least(auth.uid(), p_other); hi := greatest(auth.uid(), p_other);
  insert into public.dm_conversations (user_low, user_high)
    values (lo, hi) on conflict (user_low, user_high) do nothing;
  select id into conv from public.dm_conversations
    where user_low = lo and user_high = hi;
  return conv;
end;
$$;
grant execute on function public.start_dm(uuid) to authenticated;

create or replace function public.post_dm(p_conversation_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv record; new_id uuid; muted_anywhere boolean;
begin
  select * into conv from public.dm_conversations where id = p_conversation_id;
  if conv is null or auth.uid() not in (conv.user_low, conv.user_high) then
    raise exception 'forbidden';
  end if;
  select exists (select 1 from public.user_mutes
                 where user_id = auth.uid() and lifted_at is null and until_at > now())
    into muted_anywhere;
  if muted_anywhere then raise exception 'muted'; end if;
  if coalesce(length(trim(p_body)),0) < 1 or length(p_body) > 2000 then
    raise exception 'bad_body';
  end if;
  perform public.check_rate_limit();
  insert into public.dm_messages (conversation_id, author_id, body)
    values (p_conversation_id, auth.uid(), trim(p_body))
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.post_dm(uuid, text) to authenticated;

create or replace function public.mute_user(
  p_user_id uuid, p_room_id uuid, p_hours int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_hours not in (1, 24, 168) then raise exception 'bad_duration'; end if;
  if coalesce(length(trim(p_reason)),0) < 5 then raise exception 'reason_required'; end if;
  if exists (select 1 from public.profiles where id = p_user_id
             and role in ('admin','instructor')) then
    raise exception 'cannot_mute_staff';
  end if;
  insert into public.user_mutes (user_id, room_id, muted_by, reason, until_at)
    values (p_user_id, p_room_id, auth.uid(), trim(p_reason),
            now() + make_interval(hours => p_hours));
end;
$$;
grant execute on function public.mute_user(uuid, uuid, int, text) to authenticated;

create or replace function public.unmute_user(p_mute_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  update public.user_mutes set lifted_at = now()
    where id = p_mute_id and lifted_at is null;
end;
$$;
grant execute on function public.unmute_user(uuid) to authenticated;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.message_mentions enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;
alter table public.user_mutes enable row level security;
alter table public.channel_reads enable row level security;
alter table public.dm_reads enable row level security;

create policy "channels_select_member" on public.channels for select
  using ((not archived and public.is_room_member(room_id)) or public.is_staff());
create policy "channels_write_admin" on public.channels for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "messages_select_member" on public.messages for select
  using (exists (select 1 from public.channels c
                 where c.id = messages.channel_id
                   and (public.is_room_member(c.room_id) or public.is_staff())));
-- writes via RPCs only

create policy "mentions_select_member" on public.message_mentions for select
  using (exists (select 1 from public.messages m
                 join public.channels c on c.id = m.channel_id
                 where m.id = message_mentions.message_id
                   and (public.is_room_member(c.room_id) or public.is_staff())));

create policy "dm_conversations_select_participant" on public.dm_conversations for select
  using (auth.uid() in (user_low, user_high));

create policy "dm_messages_select_participant" on public.dm_messages for select
  using (exists (select 1 from public.dm_conversations dc
                 where dc.id = dm_messages.conversation_id
                   and auth.uid() in (dc.user_low, dc.user_high)));
-- Deliberately NO staff policy on DM content: DMs are private.

create policy "mutes_select_staff" on public.user_mutes for select
  using (public.is_staff());
create policy "mutes_select_own" on public.user_mutes for select
  using (user_id = auth.uid());

create policy "channel_reads_own" on public.channel_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dm_reads_own" on public.dm_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: add messages and dm_messages to the supabase_realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.dm_messages;
```

## Acceptance Criteria

Verify with two browsers side by side (student + second student, then student + instructor), including at 375px.

- [ ] Three seeded channels render with descriptions; admin can create/rename/archive; archived channels vanish for students, history intact for staff
- [ ] Messages send and appear in the second browser in real time without refresh; optimistic send reconciles cleanly
- [ ] 2000-char limit enforced client and server; the 11th message inside 60 seconds raises `rate_limited` with the gentle toast
- [ ] Threads: reply count chip, panel opens with parent pinned, replies realtime; replying to a reply is impossible; replying to a deleted parent raises `bad_parent`
- [ ] Mentions autocomplete filters room members, renders blue pills, stores mention rows
- [ ] Edit own works inside 15 minutes and shows "(edited)"; at 16 minutes the RPC raises `edit_window_closed` (test by seeding an old message)
- [ ] Delete own and staff-delete-any render the removed placeholder in both browsers; the body is blanked in the database (verify in table editor); a student deleting another's message gets `forbidden`
- [ ] DM: starting a conversation with a room-mate works and reuses the same conversation on repeat; DMing a user from another room raises `not_shared_room`
- [ ] Staff CANNOT select other people's `dm_messages` (verify as instructor in console — RLS blocks)
- [ ] Mute: staff mute with reason; the muted student sees the banner and every post path (channel, thread, DM) raises `muted`; unmute restores posting; muting staff raises `cannot_mute_staff`
- [ ] Unread dots appear for unseen activity and clear on open; state survives refresh
- [ ] Member list shows counts and active mutes for staff
- [ ] Whole experience bright and calm; usable at 375px with the mobile channel sheet and full-screen threads

## Hand-off Note

PRD 08 delivers structured community: purposeful channels, threads that keep conversation tied to work, private DMs (private even from staff), and moderation with teeth but a kind face — enforced in the database, logged for accountability. Mention and DM notifications are stored-but-silent until the notifications PRD lands.

Run the two-browser realtime tests and every console-level enforcement check before moving on. Next in sequence: PRD 09 — Gamification.
