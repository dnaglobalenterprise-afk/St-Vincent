-- ============================================
-- PRD 00 seed: assign roles to the three test users
--
-- Prerequisite: create these three auth users first in the Supabase
-- dashboard (Authentication → Users → Add user → Create new user):
--   admin@test.local
--   instructor@test.local
--   student@test.local
-- The on_auth_user_created trigger inserts their profiles rows
-- automatically with the default role 'student'. This seed then sets
-- their intended roles (and display names for the dashboard greeting).
-- ============================================

update public.profiles
set role = 'admin', first_name = 'Admin', last_name = 'Test'
where email = 'admin@test.local';

update public.profiles
set role = 'instructor', first_name = 'Instructor', last_name = 'Test'
where email = 'instructor@test.local';

update public.profiles
set role = 'student', first_name = 'Student', last_name = 'Test'
where email = 'student@test.local';
