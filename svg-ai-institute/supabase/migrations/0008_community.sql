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


-- Added post-authoring: room member directory RPC (students can't read others' profiles under RLS)

-- Room member directory: display fields for all members of a room, readable by
-- any member of that room (students can't SELECT others' profiles under RLS).
create or replace function public.get_room_members(p_room_id uuid)
returns table (id uuid, name text, role public.user_role, cohort text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) as name,
         p.role,
         (select c.name from public.enrollments e join public.cohorts c on c.id = e.cohort_id
          where e.user_id = p.id and c.room_id = p_room_id and e.status in ('active','graduated') limit 1) as cohort
  from public.profiles p
  where public.is_room_member(p_room_id)
    and (
      p.role in ('admin','instructor')
      or exists (select 1 from public.enrollments e join public.cohorts c on c.id = e.cohort_id
                 where e.user_id = p.id and c.room_id = p_room_id and e.status in ('active','graduated'))
    );
$$;
grant execute on function public.get_room_members(uuid) to authenticated;
