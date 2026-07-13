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

-- ============================================
-- PRD 07 seed: verified capstone -> published showcase -> graduated + certificate
-- ============================================

-- Ensure the test student is enrolled
insert into public.enrollments (cohort_id, user_id, status)
select c.id, p.id, 'active' from public.cohorts c, public.profiles p
where c.name = 'Cohort 1 — 2026' and p.email = 'student@test.local'
on conflict do nothing;

-- Complete every required published lesson for the student (so graduation is eligible)
insert into public.lesson_progress (lesson_id, user_id)
select l.id, p.id
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
join public.rooms r on r.id = c.room_id and r.slug = 'ai-automation'
join public.profiles p on p.email = 'student@test.local'
where l.required and l.published
on conflict do nothing;

-- A verified capstone at Grenadines Tours (the trigger creates the showcase shell)
insert into public.capstone_projects
  (user_id, business_id, cohort_id, type, status, pitch, video_url, live_proof, narrative, submitted_at, matched_at, verified_at, verified_by)
select p.id, b.id,
       (select cohort_id from public.enrollments e where e.user_id = p.id and e.status='active' limit 1),
       'whatsapp_bot', 'verified',
       'A WhatsApp bot that answers tour inquiries instantly and captures bookings into one sheet.',
       'https://www.loom.com/share/example-capstone-walkthrough',
       '+17845550133',
       'This WhatsApp bot for Grenadines Tours greets every inquiry within seconds, answers the most common questions, quotes the standard tours, and drops the customer name, date, and party size into one sheet the owner checks each morning. In its first test week it handled fourteen inquiries with zero missed messages — turning lost bookings into confirmed ones.',
       now() - interval '2 days', now() - interval '6 days', now() - interval '1 day', p.id
from public.profiles p, public.business_partners b
where p.email='student@test.local' and b.name='Grenadines Tours Co'
  and not exists (select 1 from public.capstone_projects cp where cp.user_id = p.id);

-- Publish the showcase entry directly (the verified-capstone trigger only fires
-- on UPDATE, so a directly-seeded verified capstone has no shell yet).
insert into public.showcase_entries
  (project_id, status, slug, headline, narrative, student_consent, consented_at,
   display_name, project_type, business_name, island, video_url, published_at, published_by)
select cp.id, 'published', 'stu-e-whatsapp-bot-union-island',
  'A WhatsApp bot that turns missed messages into booked tours',
  cp.narrative, true, now(),
  p.first_name || ' ' || left(coalesce(p.last_name,''),1) || '.',
  'whatsapp_bot', 'Grenadines Tours Co', 'Union Island', cp.video_url,
  now(), (select id from public.profiles where email='admin@test.local')
from public.capstone_projects cp join public.profiles p on p.id=cp.user_id
where p.email='student@test.local' and cp.status='verified'
on conflict (project_id) do nothing;

-- Graduate the student + issue a certificate
update public.enrollments set status='graduated'
where user_id=(select id from public.profiles where email='student@test.local') and status='active';

insert into public.certificates (user_id, cohort_id, code, issued_by)
select p.id, c.id, 'SVGAI-DEMO1', (select id from public.profiles where email='admin@test.local')
from public.profiles p, public.cohorts c
where p.email='student@test.local' and c.name='Cohort 1 — 2026'
on conflict do nothing;

-- ============================================
-- PRD 08 seed: channels, messages, thread, mention, DM
-- ============================================

insert into public.channels (room_id, name, description)
select r.id, v.name, v.description
from public.rooms r,
(values
  ('general', 'Introduce yourself and talk shop'),
  ('help', 'Stuck? Ask here — screenshots welcome'),
  ('wins', 'Ship something? Post it. We celebrate here')
) as v(name, description)
where r.slug = 'ai-automation'
  and not exists (select 1 from public.channels c where c.room_id = r.id and c.name = v.name);

-- A dozen messages across #general and #help (authors: student, instructor, admin)
do $$
declare
  gen uuid; hlp uuid; stu uuid; ins uuid; adm uuid; parent uuid;
begin
  select id into gen from public.channels where name='general';
  select id into hlp from public.channels where name='help';
  select id into stu from public.profiles where email='student@test.local';
  select id into ins from public.profiles where email='instructor@test.local';
  select id into adm from public.profiles where email='admin@test.local';
  if exists (select 1 from public.messages where channel_id=gen) then return; end if;

  insert into public.messages (channel_id, author_id, body, created_at) values
    (gen, ins, 'Welcome to the School of AI Automation 🎉 Introduce yourself here — where you''re from and what you want to build.', now() - interval '3 days'),
    (gen, stu, 'Hi all! Stu from Kingstown. I want to build WhatsApp bots for the guesthouses around here.', now() - interval '3 days' + interval '10 min'),
    (gen, adm, 'Great to have you Stu. This community is small on purpose — say hi, ask questions, share wins.', now() - interval '3 days' + interval '20 min'),
    (gen, stu, 'Question — is Make or n8n better for a first automation?', now() - interval '2 days'),
    (gen, ins, 'Start with Make for the fast wins, then n8n when you need more control. Both in the course.', now() - interval '2 days' + interval '5 min');

  insert into public.messages (channel_id, author_id, body, created_at)
    values (hlp, stu, 'My Make scenario keeps erroring on the WhatsApp module. Anyone seen "invalid token"?', now() - interval '1 day')
    returning id into parent;
  insert into public.messages (channel_id, parent_id, author_id, body, created_at) values
    (hlp, parent, ins, 'That usually means the access token expired. Regenerate it and paste the new one into the connection.', now() - interval '1 day' + interval '15 min'),
    (hlp, parent, stu, 'That was it — working now. Thank you! 🙏', now() - interval '1 day' + interval '30 min');

  -- a message mentioning the instructor
  insert into public.messages (channel_id, author_id, body, created_at)
    values (hlp, stu, 'Thanks for the help earlier, that fixed it completely.', now() - interval '20 hours')
    returning id into parent;
  insert into public.message_mentions (message_id, mentioned_id) values (parent, ins);
end $$;

-- One DM conversation between the test student and instructor
do $$
declare stu uuid; ins uuid; conv uuid; lo uuid; hi uuid;
begin
  select id into stu from public.profiles where email='student@test.local';
  select id into ins from public.profiles where email='instructor@test.local';
  lo := least(stu, ins); hi := greatest(stu, ins);
  insert into public.dm_conversations (user_low, user_high) values (lo, hi)
    on conflict do nothing;
  select id into conv from public.dm_conversations where user_low=lo and user_high=hi;
  if not exists (select 1 from public.dm_messages where conversation_id=conv) then
    insert into public.dm_messages (conversation_id, author_id, body, created_at) values
      (conv, ins, 'Hi Stu — saw your capstone idea, it''s strong. Want to talk through the booking flow?', now() - interval '2 days'),
      (conv, stu, 'Yes please! That would help a lot. When are you free?', now() - interval '2 days' + interval '1 hour');
  end if;
end $$;
