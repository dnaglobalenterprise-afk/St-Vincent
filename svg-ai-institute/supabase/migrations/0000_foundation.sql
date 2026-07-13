-- ============================================
-- PRD 00: Foundation — roles enum, profiles, RLS
-- ============================================

-- Role enum
create type public.user_role as enum ('student', 'instructor', 'admin', 'business_partner');

-- Profiles: one row per auth user
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  first_name  text,
  last_name   text,
  role        public.user_role not null default 'student',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helper: read the current user's role (used by all future RLS policies)
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================
-- Row Level Security
-- ============================================
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins and instructors can read all profiles
create policy "profiles_select_staff"
  on public.profiles for select
  using (public.current_user_role() in ('admin', 'instructor'));

-- Users can update their own profile BUT NOT their role
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Only admins can update any profile including role changes
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- No client-side inserts (trigger handles creation) and no deletes from client
-- (intentionally no insert/delete policies)
