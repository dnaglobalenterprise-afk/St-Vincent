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

-- ============================================
-- PRD 03 seed: room, cohort link, course, 8 modules, Week 1 lessons
-- ============================================

insert into public.rooms (name, slug, description, status)
values ('School of AI Automation', 'ai-automation',
        'Build and deploy AI automations, WhatsApp bots, and voice agents for real SVG businesses.',
        'active')
on conflict (slug) do nothing;

-- Link every unlinked cohort to the seeded room (v1 has one school)
update public.cohorts
set room_id = (select id from public.rooms where slug = 'ai-automation')
where room_id is null;

insert into public.courses (room_id, title, description, status)
select r.id, 'AI Automation Program',
       '8 weeks from beginner to a deployed system for a real business.', 'published'
from public.rooms r
where r.slug = 'ai-automation'
  and not exists (select 1 from public.courses c where c.room_id = r.id);

insert into public.modules (course_id, title, sort_order)
select c.id, m.title, m.sort_order
from public.courses c
join public.rooms r on r.id = c.room_id and r.slug = 'ai-automation',
lateral (values
  ('Week 1 — AI Fundamentals', 1),
  ('Week 2 — Prompt Craft', 2),
  ('Week 3 — Visual Automation with Make', 3),
  ('Week 4 — n8n Foundations', 4),
  ('Week 5 — WhatsApp Automation', 5),
  ('Week 6 — AI Voice Agents with VAPI', 6),
  ('Week 7 — Capstone: Build', 7),
  ('Week 8 — Capstone: Deploy & Verify', 8)
) as m(title, sort_order)
where not exists (select 1 from public.modules mo where mo.course_id = c.id);

-- Week 1 sample lessons: one text, one quiz (3 questions), one processing video
with week1 as (
  select mo.id from public.modules mo
  join public.courses c on c.id = mo.course_id
  join public.rooms r on r.id = c.room_id and r.slug = 'ai-automation'
  where mo.sort_order = 1
)
insert into public.lessons (module_id, type, title, sort_order, required, published, body_markdown, video_status, pass_threshold)
select w.id, l.type::public.lesson_type, l.title, l.sort_order, true, true, l.body, l.vstatus::public.video_status, l.threshold
from week1 w,
lateral (values
  ('text', 'What AI actually is (and is not)', 1,
   E'# What AI actually is\n\nAI models like **Claude** are prediction engines trained on text. They are not databases and not magic.\n\n## Three things to remember\n\n1. Models *predict*, they do not *know*.\n2. Clear input produces clear output.\n3. You are the operator — the model is the tool.\n\n```text\nGood prompt = context + task + format\n```\n\nFinish this reading, then mark it complete.',
   'none', null),
  ('quiz', 'Week 1 check: AI Fundamentals', 2, null, 'none', 70),
  ('video', 'Welcome to the Institute', 3, null, 'processing', null)
) as l(type, title, sort_order, body, vstatus, threshold)
where not exists (select 1 from public.lessons le where le.module_id = w.id);

with quiz as (
  select le.id from public.lessons le
  join public.modules mo on mo.id = le.module_id and mo.sort_order = 1
  where le.type = 'quiz'
)
insert into public.quiz_questions (lesson_id, prompt, options, correct_idx, sort_order)
select q.id, v.prompt, v.options::jsonb, v.correct_idx, v.sort_order
from quiz q,
lateral (values
  ('What does an AI language model fundamentally do?',
   '["Stores facts in a database","Predicts likely text from input","Searches the internet","Copies human answers"]', 1, 1),
  ('What makes a prompt strong?',
   '["Being as short as possible","Using technical jargon","Context, task, and format","Asking politely"]', 2, 2),
  ('Who is responsible for the quality of an AI system''s output?',
   '["The model vendor","The operator directing the model","Nobody","The internet"]', 1, 3)
) as v(prompt, options, correct_idx, sort_order)
where not exists (select 1 from public.quiz_questions qq where qq.lesson_id = q.id);

-- One required published intro lesson for Weeks 2-8 so the progression gate
-- chain is real for every week (an empty module would otherwise count as
-- vacuously complete and let the next week cascade unlocked). Replace these
-- with full lesson content via the course builder.
insert into public.lessons (module_id, type, title, sort_order, required, published, body_markdown)
select mo.id, 'text',
       'Intro to ' || regexp_replace(mo.title, '^Week \d+ — ', ''),
       1, true, true,
       '# ' || mo.title || E'\n\nThis week''s lessons are being finalized. Complete this intro to continue.'
from public.modules mo
join public.courses c on c.id = mo.course_id
join public.rooms r on r.id = c.room_id and r.slug = 'ai-automation'
where mo.sort_order between 2 and 8
  and not exists (select 1 from public.lessons l where l.module_id = mo.id);
