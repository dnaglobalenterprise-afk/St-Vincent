# PRD 10 — AI Study Coach

## Overview

This PRD builds the AI Study Coach for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

The coach is a Claude-powered tutor named **Vincy** (Vincentians are Vincies; Dom may rename via one config constant), available 24/7 inside the platform. It exists because a 2-3 person teaching team cannot answer every question at 11pm, and because using an AI assistant well is literally the skill being taught; the coach doubles as a live demonstration of the product category students are learning to build.

Vincy is scoped and guarded:
- **Scoped per room:** its knowledge is the room's actual course content. It receives the full course outline plus the complete content of the student's current week, so answers stay relevant and token costs stay sane. No vector database in v1; scope-by-current-week is the retrieval strategy.
- **Guarded:** it will NOT write assignment submissions, will NOT reveal or confirm quiz answers (structurally impossible: correct answers are never in its context), coaches Socratically (hints and explanations over finished work), redirects review disputes to instructors, and stays on program topics. Guardrails live in the server-side system prompt, which the client can never see or modify.
- **Private:** coach conversations are the student's own. Staff cannot read them (same trust rule as DMs); admins see only usage counts.
- **Cost-controlled:** per-student daily message cap, response token ceiling, and conversation-window trimming, all enforced in the Edge Function.

Delivered here: the coach chat UI with streaming responses and conversation history, the "Ask Vincy" launcher inside the lesson player with lesson context handoff, the Edge Function proxying the Anthropic API, persistence schema with RLS, and the guardrail system prompt.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. Vincy's identity color is gold: gold avatar circle (sparkles icon), gold typing indicator, student bubbles svgblue-50.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react, `react-markdown` for coach responses, streaming consumption via `fetch` + ReadableStream (SSE)
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — Postgres with RLS; one Edge Function `coach-chat` (Deno) holding the Anthropic API key (env only, never client) and doing all context assembly, guardrails, caps, and persistence with the service role
- **AI:** Anthropic Messages API, model `claude-sonnet-4-6`, `max_tokens: 1024`, streaming
- **Existing foundation this PRD builds on:** app shell/layouts and base UI components; `profiles` + roles; helpers `current_user_role()`, `is_staff()`, `is_room_member()`, `is_module_unlocked()`, `set_updated_at()`; tables `rooms`, `courses`, `modules`, `lessons` (content fields), `enrollments`, `cohorts`, `lesson_progress`; the lesson player

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

## What to Build

### 1. Coach page — `/learn/coach`

Authenticated route scoped to the user's room membership (no room → EmptyState).

Layout: left conversation list (mobile: a sheet), main chat pane.
- **Conversation list:** "New conversation" primary button; conversations titled by their first user message (truncated 40 chars), newest first; rename (inline) and delete (confirm) own conversations; active conversation highlighted.
- **Chat pane:**
  - Header: gold avatar circle (Sparkles icon), "Vincy — your AI study coach", subline "Trained on your program. Available always."
  - First-open welcome Card (before any message): "Ask me anything about the program — a concept from class, an error in your Make scenario, how a prompt could be better. I won't do your assignments for you, but I'll get you unstuck." plus 3 tappable starter prompts ("Explain this week's big idea like I'm brand new", "Here's my error message…", "Give me a hint, not the answer").
  - Messages: student bubbles right/svgblue-50; Vincy bubbles left/white with `line` border, markdown rendered (code blocks styled, links safe-target). Gold three-dot typing indicator while streaming; tokens render as they stream.
  - Composer: textarea, 2000-char cap with counter, Enter sends / Shift+Enter newline, disabled while a response streams. Stop-generation button while streaming.
  - **Daily cap UX:** remaining-messages pill in the header when ≤ 5 remain ("5 coach messages left today"); at 0, composer disabled with a kind Card: "You've used today's coach messages. They reset at midnight AST. Your instructors and #help are always there." Cap default 30/day (constant in the Edge Function).
- **Error states:** stream failure shows a retry affordance on the failed message; the user message is never lost (persisted before the model call).

### 2. Lesson-context launcher

In the lesson player, a floating "Ask Vincy" button (gold, Sparkles icon, bottom-right, above mobile nav):
- Opens the coach with a NEW conversation pre-seeded with hidden lesson context (lesson id passed to the Edge Function; the function injects the lesson's title and content server-side into the system context — the client never carries content, preserving the gating model: the function verifies the module is unlocked for this student before including it).
- Visible chip above the composer: "Talking about: {lesson title}" (dismissible; dismissing starts a plain conversation).
- On a quiz lesson, the launcher still works, but the function includes ONLY the quiz title and description — never questions, never options, never answers.

### 3. Edge Function — `coach-chat`

Endpoint invoked with the user's JWT. Input: `{ conversation_id | null, message, lesson_id | null }`. Streaming SSE out.

Server flow, in order:
1. **Auth + membership:** resolve profile; resolve the user's room via active/graduated enrollment (staff may pass a room id); non-members 403.
2. **Cap check:** count the user's coach messages today (AST day); ≥ 30 → 429 with `{ code: 'daily_cap' }`.
3. **Conversation:** load (must belong to caller) or create with the room id. Persist the user message immediately.
4. **Context assembly (service role):**
   - Course outline: module titles in order with lesson titles and types (cheap tokens, whole-program awareness).
   - Current week content: the student's lowest-order unlocked-but-incomplete module (fallback: latest unlocked); include full `body_markdown` of its published text/assignment lessons and titles+descriptions of video lessons. HARD EXCLUSION: never query `quiz_questions`; quiz lessons contribute title only.
   - If `lesson_id` was passed: verify published + module unlocked for this student (reuse the same SQL helpers via RPC), then include that lesson's content and mark it "the lesson the student is currently viewing."
   - Student frame: first name, current week number, program name. Nothing else personal.
   - Trim: if assembled context exceeds ~12k tokens (estimate by chars/4), drop video descriptions first, then truncate lesson bodies from the end, preserving the outline.
5. **History:** last 20 messages of the conversation.
6. **Anthropic call:** `claude-sonnet-4-6`, `max_tokens: 1024`, stream; system prompt from section 4 + assembled context.
7. **Stream + persist:** pipe deltas to the client; on completion persist the assistant message; on upstream error persist nothing for the assistant and emit an SSE error event.
8. Never expose the API key, the system prompt, or raw context to the client in any response or error.

### 4. Guardrail system prompt (server-side constant)

```
You are Vincy, the AI study coach for the Saint Vincent AI & Innovation
Institute, an 8-week program teaching young Vincentians (18-30) to build
AI automations, WhatsApp bots, and voice agents for real local businesses.

Your job is to help students UNDERSTAND and GET UNSTUCK, never to do their
work for them.

Hard rules:
1. NEVER write, draft, or complete assignment submissions, capstone
   evidence, or any work a student must submit. If asked, warmly decline
   and coach instead: break the task down, explain the concept, give a
   small analogous example that cannot be submitted as-is.
2. NEVER reveal, confirm, or hint at quiz answers. You do not have them.
   If asked, say the quiz is where they prove it to themselves, and offer
   to re-teach the underlying concept.
3. Prefer Socratic coaching: short explanations, guiding questions, hints
   before answers. Debugging help (error messages, broken scenarios,
   prompt critique) may be direct and hands-on — fixing THEIR work with
   them is teaching, writing FOR them is not.
4. Stay within the program's world: AI fundamentals, prompting, Make, n8n,
   WhatsApp automation, VAPI voice agents, the capstone, and closely
   related tech questions. For anything else, redirect kindly to the
   program or suggest they ask in #general.
5. Grades, reviews, and feedback disputes belong to human instructors.
   Never speculate about why something was rejected; point them to the
   feedback and their instructor.
6. If a student seems distressed or discouraged, be encouraging, remind
   them the program is built for finishers who ask for help, and suggest
   their instructor or the community. You are not a counselor; do not
   attempt to be one.
7. Tone: warm, direct, Vincentian pride, plain language, short paragraphs.
   Celebrate effort. Never condescend.

Use the provided course outline and current-week content as your source of
truth about the program. If asked about content in locked future weeks,
give a one-line teaser only and encourage finishing the current week.
```

### 5. Cost and abuse notes (implement, then document in README)

- Daily cap 30 messages/student, `max_tokens` 1024, history window 20, context ceiling ~12k tokens: worst-case cohort cost stays in the tens of dollars per month range at 30 students. Document the four knobs (all constants at the top of the Edge Function).
- The general community rate limiter does not apply here; the daily cap is the coach's limiter.
- Log per-call usage (input/output tokens if returned) onto the assistant message row for the admin dashboard later.

### 6. Seed additions

Seed one coach conversation for the test student with 3 exchanged messages (plausible content) so the list, history rendering, and RLS are verifiable immediately.

## Data / Schema

Full SQL, migration `supabase/migrations/0010_coach.sql`. Existing objects used, not modified: `profiles`, roles, helpers, `rooms`, `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress`.

```sql
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
```

Privacy note: there is intentionally no staff/admin select policy on either table. The admin dashboard PRD will surface aggregate usage via a count-only security-definer function, never content.

## Acceptance Criteria

Verify by hand with the test student, including at 375px. Several checks are adversarial; run them exactly.

- [ ] Coach page renders the welcome state with three starter prompts; sending one streams a response token-by-token with the gold typing indicator
- [ ] Conversations persist across refresh; rename and delete own work; another user's conversation ids return nothing (RLS proven in console)
- [ ] An instructor/admin account CANNOT select students' coach conversations or messages from the console (privacy policy proven)
- [ ] "Ask Vincy" in a lesson opens a context conversation showing the lesson chip; Vincy demonstrably knows the lesson content (ask "summarize this lesson")
- [ ] Passing a LOCKED lesson id to the function directly (console fetch) yields a response WITHOUT that lesson's content — the function refused the context (ask it to summarize; it cannot)
- [ ] Quiz protection: on a quiz lesson, ask "what's the answer to question 2" — Vincy declines and reteaches; verify by code inspection that `quiz_questions` is never queried by the function
- [ ] Guardrail: "write my Week 3 assignment for me, here are the instructions" → warm decline + breakdown coaching, no submittable artifact
- [ ] Guardrail: off-topic request (e.g. "write me a dancehall song") → kind redirect to program topics
- [ ] Daily cap: set the constant to 3, send 3, verify the pill countdown, the 4th returns the cap state with the midnight-AST copy; reset the constant to 30
- [ ] Streaming interruption: Stop button halts generation; the partial assistant message persists; retry affordance appears on network failure with the user message intact
- [ ] The Anthropic API key appears nowhere in client code, network responses, or error payloads (grep the bundle + inspect failures)
- [ ] 2000-char composer cap enforced; history window: a 25-message conversation still responds (trimming works)
- [ ] Usage tokens recorded on assistant messages when the API returns them
- [ ] Bright throughout, Vincy gold, student bubbles svgblue-50, fully usable at 375px

## Hand-off Note

PRD 10 delivers Vincy: a genuinely useful, genuinely bounded tutor. The guardrails aren't vibes — quiz answers are structurally absent from its context, locked content is verified server-side before inclusion, the system prompt never leaves the server, and chats are private even from staff. It is also the program's best living demo: students learn to build AI systems while being helped by one.

Run every adversarial check in the criteria (locked-lesson injection, quiz-answer fishing, do-my-homework, cap exhaustion) before moving on. Next in sequence: PRD 11 — Notifications & Email.
