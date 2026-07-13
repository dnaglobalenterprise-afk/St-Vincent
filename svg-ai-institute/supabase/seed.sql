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

-- ============================================
-- PRD 04 seed: assignment lessons + one submitted submission
-- ============================================

-- Week 1 assignment (link + file + text)
insert into public.lessons (module_id, type, title, sort_order, required, published, body_markdown, submission_kinds)
select mo.id, 'assignment',
       'Build your first prompt-powered helper',
       10, true, true,
       E'# Build your first prompt-powered helper\n\nUse Claude or ChatGPT to build a small helper that solves a real task for a person you know (a checklist generator, a message rewriter, a study-quiz maker — your call).\n\n## What to submit\n\n- A **link** to your working prompt (a shareable chat link or a Loom walkthrough), and\n- A **screenshot** of it working, and\n- A short **write-up**: who it is for and what problem it solves.\n\n## Done looks like\n\n- [ ] The helper does something genuinely useful\n- [ ] Someone other than you could run it from your instructions\n- [ ] You can explain why your prompt is written the way it is',
       array['link','file','text']
from public.modules mo
join public.courses c on c.id = mo.course_id
join public.rooms r on r.id = c.room_id and r.slug='ai-automation'
where mo.sort_order = 1
  and not exists (select 1 from public.lessons l where l.module_id = mo.id and l.type='assignment');

-- Week 3 assignment (link only)
insert into public.lessons (module_id, type, title, sort_order, required, published, body_markdown, submission_kinds)
select mo.id, 'assignment',
       'Ship your first Make scenario',
       10, true, true,
       E'# Ship your first Make scenario\n\nBuild a Make.com scenario that automates one repetitive task end to end.\n\n## What to submit\n\n- The **share link** to your scenario.\n\n## Done looks like\n\n- [ ] The scenario runs without errors\n- [ ] It saves a real person real time',
       array['link']
from public.modules mo
join public.courses c on c.id = mo.course_id
join public.rooms r on r.id = c.room_id and r.slug='ai-automation'
where mo.sort_order = 3
  and not exists (select 1 from public.lessons l where l.module_id = mo.id and l.type='assignment');

-- Enroll the test student and seed one submitted Week-1 assignment submission
-- so the instructor review queue renders immediately.
insert into public.enrollments (cohort_id, user_id, status)
select c.id, p.id, 'active'
from public.cohorts c, public.profiles p
where c.name = 'Cohort 1 — 2026' and p.email = 'student@test.local'
on conflict do nothing;

insert into public.submissions (lesson_id, user_id, attempt_number, links, text_body, file_paths)
select l.id, p.id, 1,
       '["https://claude.ai/share/example-helper"]'::jsonb,
       'This helper writes friendly appointment-reminder messages for my aunt''s hair salon. Staff paste the client name and time, and it returns a warm WhatsApp-ready message.',
       '[]'::jsonb
from public.lessons l
join public.modules mo on mo.id = l.module_id and mo.sort_order = 1
join public.profiles p on p.email = 'student@test.local'
where l.type = 'assignment'
  and not exists (select 1 from public.submissions s where s.lesson_id = l.id and s.user_id = p.id);

-- ============================================
-- PRD 05 seed: live classes + one recording
-- ============================================

-- Upcoming external-mode class (3 days out)
insert into public.live_classes (room_id, host_id, title, description, scheduled_at, duration_minutes, mode, meeting_url, status)
select r.id, p.id,
       'Week 1 Live: AI Fundamentals Q&A',
       'Bring your questions from the Week 1 lessons. We build a prompt live together.',
       now() + interval '3 days', 90, 'external', 'https://meet.google.com/svg-ai-demo', 'scheduled'
from public.rooms r, public.profiles p
where r.slug='ai-automation' and p.email='instructor@test.local'
  and not exists (select 1 from public.live_classes lc where lc.title='Week 1 Live: AI Fundamentals Q&A');

-- Upcoming embedded-mode class (7 days out) — stream provisioned later via edge fn
insert into public.live_classes (room_id, host_id, title, description, scheduled_at, duration_minutes, mode, status)
select r.id, p.id,
       'Week 2 Live: Prompt Craft Workshop',
       'A hands-on workshop, streamed live. Watch right here on the class page.',
       now() + interval '7 days', 90, 'embedded', 'scheduled'
from public.rooms r, public.profiles p
where r.slug='ai-automation' and p.email='instructor@test.local'
  and not exists (select 1 from public.live_classes lc where lc.title='Week 2 Live: Prompt Craft Workshop');

-- Past class (2 days ago) with a ready recording
insert into public.live_classes (room_id, host_id, title, description, scheduled_at, duration_minutes, mode, meeting_url, status)
select r.id, p.id,
       'Kickoff: Welcome to the Institute',
       'Our opening session — the mission, the pipeline, and what you will build.',
       now() - interval '2 days', 60, 'external', 'https://meet.google.com/svg-ai-kickoff', 'ended'
from public.rooms r, public.profiles p
where r.slug='ai-automation' and p.email='instructor@test.local'
  and not exists (select 1 from public.live_classes lc where lc.title='Kickoff: Welcome to the Institute');

insert into public.recordings (room_id, class_id, title, description, mux_playback_id, mux_asset_id, duration_seconds, status, published)
select r.id, lc.id,
       'Kickoff: Welcome to the Institute — recording',
       'Replay of our opening session.',
       'p92lGkSNut11cwrViag00Rs6tiaUZvknPYvLXN1hb92E', 'seed-kickoff-asset', 60, 'ready', true
from public.rooms r
join public.live_classes lc on lc.title='Kickoff: Welcome to the Institute'
where r.slug='ai-automation'
  and not exists (select 1 from public.recordings rec where rec.title='Kickoff: Welcome to the Institute — recording');

-- ============================================
-- PRD 06 seed: businesses, contacts, capstone
-- ============================================

-- Flag the Week 7 module as the capstone gate
update public.modules set is_capstone = true
where sort_order = 7
  and course_id in (select c.id from public.courses c join public.rooms r on r.id=c.room_id where r.slug='ai-automation');

-- Approved businesses (capacities 1, 1, 2)
insert into public.business_partners (status, name, business_type, community, island, pain_point, capacity, consent)
values
  ('approved', 'Sunset View Guesthouse', 'Tourism/Guesthouse', 'Bequia', 'Bequia',
   'We lose bookings because nobody answers WhatsApp after 6pm, and guests give up and book elsewhere.', 1, true),
  ('approved', 'Kingstown Auto Parts', 'Retail', 'Kingstown', 'St. Vincent',
   'Customers call to check stock all day and we cannot keep up; we miss sales and waste hours on the phone.', 1, true),
  ('approved', 'Grenadines Tours Co', 'Tours & Transport', 'Union Island', 'Union Island',
   'Inquiries come from five channels and we lose track; some never get a reply and become lost bookings.', 2, true),
  ('pending', 'Fresh Roots Farm', 'Agriculture', 'Georgetown', 'St. Vincent',
   'We take vegetable orders on paper and lose them; customers do not know what is in stock each week.', 1, true)
on conflict do nothing;

insert into public.business_contacts (business_id, contact_name, email, whatsapp)
select b.id, v.contact_name, v.email, v.whatsapp
from public.business_partners b
join (values
  ('Sunset View Guesthouse', 'Marcia Providence', 'sunset-owner@test-biz.local', '+17845550111'),
  ('Kingstown Auto Parts', 'Rohan Da Silva', 'autoparts-owner@test-biz.local', '+17845550122'),
  ('Grenadines Tours Co', 'Elsa Charles', 'tours-owner@test-biz.local', '+17845550133'),
  ('Fresh Roots Farm', 'Junior Bacchus', 'farm-owner@test-biz.local', '+17845550144')
) as v(name, contact_name, email, whatsapp) on v.name = b.name
where not exists (select 1 from public.business_contacts bc where bc.business_id = b.id);

-- One matched + submitted capstone for the test student on the capacity-2 business
insert into public.capstone_projects (user_id, business_id, cohort_id, type, status, pitch, video_url, live_proof, narrative, submitted_at, matched_at)
select p.id, b.id,
       (select cohort_id from public.enrollments e where e.user_id = p.id and e.status='active' limit 1),
       'whatsapp_bot', 'submitted',
       'A WhatsApp bot that answers tour inquiries instantly, quotes prices, and captures booking details into one place.',
       'https://www.loom.com/share/example-capstone-walkthrough',
       '+17845550133',
       'I built a WhatsApp bot for Grenadines Tours that greets every inquiry within seconds, answers the five most common questions, quotes the standard tours, and collects the customer name, date, and party size into a single sheet the owner checks each morning. In the first test week it handled 14 inquiries with zero missed messages.',
       now() - interval '1 day', now() - interval '5 days'
from public.profiles p, public.business_partners b
where p.email='student@test.local' and b.name='Grenadines Tours Co'
  and exists (select 1 from public.enrollments e where e.user_id = p.id and e.status='active')
  and not exists (select 1 from public.capstone_projects cp where cp.user_id = p.id);
