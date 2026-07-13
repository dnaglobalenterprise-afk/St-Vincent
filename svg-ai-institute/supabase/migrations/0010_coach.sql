-- ============================================
-- PRD 10: AI Study Coach — conversations and messages
-- ============================================

create table public.coach_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_conversations_updated_at before update on public.coach_conversations
  for each row execute function public.set_updated_at();
create index coach_conversations_user_idx
  on public.coach_conversations (user_id, updated_at desc);

create table public.coach_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);
create index coach_messages_conv_idx
  on public.coach_messages (conversation_id, created_at);

-- Daily usage counter (AST) used by the Edge Function cap check
create or replace function public.coach_messages_today(p_user_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.coach_messages cm
  join public.coach_conversations cc on cc.id = cm.conversation_id
  where cc.user_id = p_user_id
    and cm.role = 'user'
    and (cm.created_at at time zone 'America/St_Vincent')::date
        = (now() at time zone 'America/St_Vincent')::date;
$$;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;

-- Conversations: OWN ONLY. No staff read policy — coach chats are private.
create policy "coach_conversations_own" on public.coach_conversations
  for select using (user_id = auth.uid());
create policy "coach_conversations_update_own" on public.coach_conversations
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "coach_conversations_delete_own" on public.coach_conversations
  for delete using (user_id = auth.uid());

create policy "coach_messages_own" on public.coach_messages
  for select using (exists (
    select 1 from public.coach_conversations cc
    where cc.id = coach_messages.conversation_id
      and cc.user_id = auth.uid()));

-- No client insert policies: the Edge Function (service role) writes both
-- sides of the dialogue. Rename/delete of conversations is the only
-- client-side mutation.
