# CLAUDE.md — SVG AI Institute Platform

This file is the constitution for this build. Claude Code must read and obey this file in every session. When any instruction elsewhere conflicts with this file, this file wins.

---

## 1. What We Are Building

**Project:** Saint Vincent AI & Innovation Institute (working name: SVG AI Institute)

**One-liner:** A cohort-based online school that trains Vincentian youth (18-30) to build and deploy real AI automations, WhatsApp bots, and voice agents for actual local businesses, free to students at launch.

**Why it exists:** SVG youth unemployment is ~41%. This platform is a jobs intervention disguised as a school. Every graduate leaves with a deployed, working project for a real business and a public portfolio page proving it.

**The differentiator (never cut this):** The Capstone Pipeline. Local businesses register to receive free automations. Students are matched to businesses. Instructors verify the deployment works. Graduate projects go on a public Outcomes Board. This is the proof engine for students, for marketing, and for the Government of SVG.

**Not for profit at launch.** No payments, no Stripe, no pricing pages in v1. Admission is application-based. Scarcity comes from admissions, not price.

---

## 2. Locked Strategy Decisions (Do Not Reopen)

| Decision | Locked Value |
|---|---|
| Audience | Ages 18-30, SVG-based (diaspora allowed later) |
| Cohort size | 15-30 students |
| Instructors | 2 confirmed, possibly 3. All tooling sized for a 2-3 person team |
| Program length | 8 weeks per cohort |
| Cost to students | Free. Application-based admission |
| v1 Rooms | ONE room: School of AI Automation. Rooms architecture built so Schools 2-4 (Digital Marketing, Prompt Engineering, Video Products) activate later with zero rebuild |
| Curriculum tools | Weeks 1-2: AI fundamentals + prompting (Claude/ChatGPT/Gemini free tiers). Week 3: Make.com (fast visual wins). Weeks 4-5: n8n + WhatsApp automation (the money skill). Week 6: VAPI voice agents (the wow demo). Weeks 7-8: Capstone |
| Capstone types | WhatsApp bot, workflow automation, or voice agent, deployed at a real registered business |
| Minors | None. No parental consent flows, no guardian layer. Standard adult community features allowed |
| Out of v1 | Payments, incubator, government consulting portal, remote work center, Schools 2-4 content, native mobile app |

---

## 3. Tech Stack (Locked)

| Layer | Tool | Notes |
|---|---|---|
| Frontend | React + TypeScript + Vite | Functional components, hooks only |
| Styling | Tailwind CSS | Design tokens from Section 4 only. No arbitrary hex values in components |
| Backend / DB / Auth | Supabase | Postgres, Row Level Security on EVERY table containing user data, no exceptions |
| Auth method | Supabase email/password + magic link (email OTP) fallback | Password sign-in is the default (added 2026-07-14 per Dom); magic link kept as a no-password option. "Forgot password?" + in-app password change supported. Roles: student, instructor, admin, business_partner |
| Hosting | Vercel | Preview deploys per PR |
| Video (lessons + recordings) | Mux | Upload, playback, thumbnails |
| Live classes | Embedded livestream (Mux live) + calendar scheduling. v1 may embed Zoom/Meet links as fallback; recordings always land in the room library |
| AI Coach | Anthropic Claude API | claude-sonnet-4-6 for coach responses. Coach is scoped per-room, answers only from room content |
| Email | Resend | Magic links via Supabase, transactional via Resend |
| File storage | Supabase Storage | Assignment uploads, capstone evidence, avatars |

**Environment variables** live in `.env.local` (never committed) and Vercel project settings. Prefix client-safe vars with `VITE_`.

---

## 4. Design System (LAW — read this before writing any UI)

### 4.1 The Non-Negotiable Rule

**This platform is BRIGHT. It is never dark.** No dark backgrounds as default, no black themes, no gray-900 page backgrounds, no "dark mode" in v1. The platform carries the colors of Saint Vincent and the Grenadines in every screen. If a component ships on a dark background, it is a bug.

### 4.2 Color Tokens (SVG National Colors)

The SVG flag: blue, gold, green, with green diamonds forming a V. These are the brand.

```
/* Primary — SVG Blue (sky, sea) */
--svg-blue-900: #0B2540;  /* deep navy, TEXT color only, never backgrounds */
--svg-blue-700: #0059A8;
--svg-blue-500: #0072C6;  /* PRIMARY brand color: buttons, links, active states */
--svg-blue-100: #D6EBFA;
--svg-blue-50:  #F0F8FF;  /* section background tint */

/* Accent — SVG Gold (sunshine, energy) */
--svg-gold-600: #E0B500;
--svg-gold-500: #FCD116;  /* accent: highlights, badges, streaks, callouts */
--svg-gold-100: #FEF6D0;

/* Success / Growth — SVG Green (the islands) */
--svg-green-700: #007A2F;
--svg-green-500: #009639;  /* success, completion, CTA-secondary, "deployed" states */
--svg-green-100: #D9F2E2;

/* Neutrals — bright base */
--surface-page: #FFFFFF;      /* default page background */
--surface-alt:  #F5F9FC;      /* alternating sections, cards on white */
--border:       #E2ECF4;
--text-primary: #0B2540;      /* deep navy, NOT black #000 */
--text-muted:   #5A7184;

/* Semantic */
--danger: #D64545;
--warning: #E8890C;
```

### 4.3 Color Usage Rules

- Page backgrounds: white or `--svg-blue-50`. Alternate sections between the two for rhythm.
- Primary buttons: `--svg-blue-500` background, white text. Hover: `--svg-blue-700`.
- Success/deployed/complete states: always `--svg-green-500`.
- Gamification (points, streaks, badges): always `--svg-gold-500` family. Gold = energy and reward everywhere in the app.
- Gradients allowed: blue-500 → green-500 (hero sections), gold used as a solid accent, never in gradients with blue (goes muddy).
- The flag's V-diamond motif is a brand element: use a subtle diamond/chevron pattern in hero backgrounds, section dividers, certificate design, and badge shapes.
- Text is deep navy `#0B2540` on light backgrounds. Never pure black, never light-gray-on-white below WCAG AA (4.5:1).

### 4.4 Typography

- **Headings:** Sora (Google Fonts), weights 600/700. Confident, modern, youthful.
- **Body:** Inter, weights 400/500/600.
- Scale: 40/32/24/20/16/14. Body default 16px. Line height 1.6 body, 1.2 headings.

### 4.5 Component Character

- Rounded-xl corners (12px) on cards and buttons. Friendly, not corporate-sharp.
- Cards: white on `--surface-alt` sections, or `--surface-alt` on white, 1px `--border`, soft shadow (`0 2px 8px rgba(11,37,64,0.06)`).
- Generous whitespace. This is a school for beginners; screens must never feel dense or intimidating.
- Motion: subtle. 150-200ms transitions. Confetti/celebration moments ARE allowed on lesson completion, badge earn, and capstone approval (gold confetti).
- Every empty state has an illustration or icon, a one-line explanation, and one action button. No blank white voids.
- Mobile-first. Most SVG students will be on phones. Every screen must be fully usable at 375px width.

---

## 5. Architecture Overview

### 5.1 Core Concepts

- **Room** = a school (v1 ships one: School of AI Automation). Rooms own courses, live classes, chat, leaderboard, and an AI Coach scope.
- **Cohort** = a dated run of a room's program with an enrolled student list. Students belong to a cohort; cohorts belong to a room.
- **Course → Module (week) → Lesson** hierarchy. Lesson types: video, text/reading, quiz, assignment, live-class-replay.
- **Progression gates:** a student cannot access Week N+1 until Week N's required lessons and assignment are complete. Gates are enforced server-side (RLS + RPC), not just hidden in UI.
- **Capstone Pipeline:** business_partners register publicly → admin approves → students browse/match in Week 6 → student submits deployment evidence (video walkthrough + live URL/phone number/WhatsApp number) → instructor reviews → approved capstones publish to the public Outcomes Board and mint the certificate.

### 5.2 High-Level Data Domains

(Each PRD restates the FULL SQL schema for every table it touches. This list is orientation only.)

- **identity:** profiles, roles
- **admissions:** applications, application_reviews, cohorts, enrollments
- **learning:** rooms, courses, modules, lessons, lesson_progress, assignments, submissions, quiz_questions, quiz_attempts
- **live:** live_classes, recordings
- **capstone:** business_partners, capstone_projects, capstone_reviews, showcase_entries
- **community:** channels, messages, threads, direct_messages
- **gamification:** point_events, streaks, badges, badge_awards, leaderboard (view)
- **coach:** coach_conversations, coach_messages, room_knowledge (embedded content)
- **ops:** notifications, email_log, audit_log

### 5.3 Roles and Access (enforced with RLS everywhere)

- **student:** own profile, own cohort's room content (gated), community, own submissions, coach
- **instructor:** everything students see + review queues (assignments, capstones), live class management, cohort progress views
- **admin (Dom):** everything + admissions, business partner approval, room/course authoring, user management
- **business_partner:** own business profile, own matched capstone project status
- **public (no auth):** marketing site, outcomes board, application form, business partner signup form

---

## 6. PRD Roadmap (build in this exact order)

| # | PRD | What It Delivers |
|---|---|---|
| 00 | Foundation & Design System | Vite/React/TS scaffold, Tailwind config with all Section 4 tokens, Supabase project + auth wiring, app shell (nav, layouts), role system, protected routing |
| 01 | Public Website | Marketing pages (home, program, about, FAQ), SVG-colors hero with diamond motif, application CTA, business partner CTA, SEO |
| 02 | Admissions System | Application form, admin review queue, accept/waitlist/decline with emails, cohort creation and assignment |
| 03 | Rooms & Course Engine | Rooms architecture, course/module/lesson authoring (admin), lesson player (video/text/quiz), progression gates |
| 04 | Assignments & Submissions | Assignment lesson type, file/link/text submissions, instructor review queue, feedback, resubmission loop |
| 05 | Live Classes & Recordings | Class scheduling, calendar, live embed, Mux recording auto-publish to room library |
| 06 | Capstone Pipeline | Business partner registry + approval, student-business matching, deployment evidence submission, instructor verification, statuses |
| 07 | Outcomes Board & Certificates | Public showcase pages per graduate project, certificate generation (SVG-flag design), public outcomes stats |
| 08 | Community | Room channels, threaded messages, DMs, mentions, basic moderation tools (delete/mute) for instructors |
| 09 | Gamification | Point events, streaks, badges, room leaderboard, gold celebration moments |
| 10 | AI Study Coach | Claude-powered per-room coach, room content as knowledge scope, conversation history, guardrails (won't do assignments for students) |
| 11 | Notifications & Email | In-app notification center, email digests (Resend), event triggers (assignment reviewed, class starting, capstone approved) |
| 12 | Admin Dashboard | Cohort health view, student progress matrix, funnel stats (applications → enrolled → graduated), instructor workload view |

**Build rule:** One PRD at a time. Run it, verify it works against its Acceptance Criteria, then request the next. Never run multiple PRDs in parallel. Never skip ahead.

---

## 7. Engineering Rules for Claude Code

1. **No dark backgrounds.** Re-read Section 4.1 before every UI task.
2. **RLS on every user-data table.** If a table is created without RLS policies, the task is not complete.
3. **Server-side enforcement.** Progression gates, role checks, and review permissions live in the database (RLS/RPC), never only in React.
4. **Design tokens only.** No raw hex values in components. All colors come from the Tailwind theme mapped to Section 4.2.
5. **Mobile-first.** Build and verify at 375px before desktop.
6. **TypeScript strict.** No `any` unless annotated with a reason comment.
7. **File structure:** `src/features/<domain>/` (components, hooks, api per feature), `src/components/ui/` for shared primitives, `src/lib/` for supabase client and utils.
8. **Verify before claiming done.** Every PRD's Acceptance Criteria must be actually tested (run the app, click the flow). Never report a fix or feature as working without observing it work.
9. **Migrations are files.** Every schema change is a numbered SQL migration committed to the repo, applied via Supabase CLI.
10. **Seed data.** Maintain a seed script with 1 room, 1 cohort, 3 fake students, 1 instructor, 2 fake businesses so every feature is testable immediately.

---

## 8. Context for Copy and Content

- Tone of all platform copy: warm, direct, ambitious, Vincentian pride. Never corporate-stiff, never condescending. Students are adults being trained for real work.
- The public site speaks to three audiences: prospective students ("learn free, build real things, get proof"), local businesses ("get a free automation built for you"), and government/partners ("measurable outcomes for SVG youth").
- Key public stat to feature: youth unemployment ~41%, and the Outcomes Board as the living answer to it.
- Founder: Dom Cortez, DNA Global Enterprises. 25+ years transportation/logistics, AI systems builder. Faith. Family. Empire.
