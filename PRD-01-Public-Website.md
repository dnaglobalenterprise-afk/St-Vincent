# PRD 01 — Public Website

## Overview

This PRD builds the complete public-facing website for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

The public site speaks to three audiences at once:
1. **Prospective students (18-30):** learn free, build real things, graduate with public proof.
2. **Local businesses:** register interest to receive a free automation, WhatsApp bot, or voice agent built by a supervised student.
3. **Government and partners:** a credible national initiative with measurable outcomes, aligned with SVG's digital transformation agenda. Key stat: SVG youth unemployment is approximately 41%, and this school is a direct jobs intervention.

This PRD delivers: home page, program page, about page, FAQ, a `/apply` placeholder page, a `/businesses` page with an interest-capture form, an `interest_signups` table with RLS, SEO metadata, and analytics-ready structure. The full application form and admissions flow arrive in a later PRD and will replace the `/apply` placeholder; nothing in this PRD depends on it.

**Design law (applies to every screen):** the interface is BRIGHT. White and light-blue backgrounds carrying the national colors of Saint Vincent and the Grenadines. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react icons
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase (Postgres + RLS) for the `interest_signups` table
- **Fonts:** Sora (headings 600/700), Inter (body 400/500/600)
- **Hosting:** Vercel
- **Existing foundation this PRD builds on:** the app shell, PublicLayout, Navbar, Footer, Button, Card, Input, Badge, EmptyState, PageHeader, and DiamondMotif components, plus the Supabase client at `src/lib/supabase.ts`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4
ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

Rules: primary buttons `svgblue-500` with white text; success and "deployed" language pairs with `svggreen-500`; gold is for energy, highlights, and stats; gradients only blue-500 → green-500; page sections alternate white and `svgblue-50`; cards `rounded-xl border-line shadow-card`; mobile-first, fully usable at 375px.

## What to Build

### 1. Navbar (update the existing PublicLayout navbar)

- Left: wordmark "SVG AI Institute" (Sora 700, svgblue-500) with a small three-diamond green motif mark to its left.
- Links (desktop): Home, Program, For Businesses, About, FAQ.
- Right: secondary Button "Sign In" (links `/signin`) + primary Button "Apply" (links `/apply`).
- Mobile: hamburger opening a full-height white sheet with the same links stacked, Apply as a full-width primary button at the bottom.
- Sticky top, white background, bottom border `line`, subtle shadow on scroll.

### 2. Home page `/`

Build in this exact section order:

1. **Hero** (background: white with DiamondMotif at 10% opacity positioned right; on mobile the motif sits behind at 6%):
   - Overline Badge (gold): "Free · Cohort-Based · Saint Vincent and the Grenadines"
   - H1 (Sora 700, 40px desktop / 32px mobile): "Learn AI. Build Real Systems. Get Hired or Get Clients."
   - Subhead (ink-muted, 18px): "An 8-week program that trains young Vincentians to build AI automations, WhatsApp bots, and voice agents for real local businesses. Free to students. Proof you can show anyone."
   - Buttons: primary "Apply for the Next Cohort" (`/apply`) + secondary "I Own a Business" (`/businesses`)
   - Trust line beneath (ink-muted, 14px): "Built for Saint Vincent and the Grenadines 🇻🇨"
2. **Stats band** (background svgblue-50, three stat cards): "41%" / "youth unemployment in SVG — the problem we exist to attack" · "8 weeks" / "from beginner to a deployed system for a real business" · "$0" / "cost to students — admission by application". Numbers in Sora 700 svgblue-500, the 41% number in danger red to signal urgency.
3. **How it works** (white, three steps with numbered gold circles): Apply → Train live online with instructors and an AI study coach → Deploy a real system for a real SVG business and graduate with public proof.
4. **What you'll build** (svgblue-50, three Cards with lucide icons): WhatsApp booking bots ("the Caribbean runs on WhatsApp — build bots that answer, book, and follow up"), Workflow automations ("connect the tools businesses already use and remove hours of manual work"), AI voice agents ("agents that answer calls, take bookings, and text customers back").
5. **The Capstone promise** (white, split layout: text left, illustrative mock card right): headline "You don't graduate with a certificate. You graduate with a deployed system." Copy explaining the business-partner match, instructor verification, and the public Outcomes Board. The mock card on the right previews a future showcase entry: student name, project type Badge (green "DEPLOYED"), business name, one-line result.
6. **For businesses strip** (svggreen-100 background, single row): "Own a business in SVG? Get a free automation built for you." + secondary button to `/businesses`.
7. **Backed by a bigger vision** (white): short paragraph positioning the Institute within SVG's national digital transformation momentum, aligned with the goals of the Ministry of Education, Vocational Training, Innovation, Digital Transformation and Information. No fabricated endorsements: use language like "aligned with," never "endorsed by" unless Dom confirms an actual endorsement.
8. **Final CTA band** (gradient svgblue-500 → svggreen-500, white text, DiamondMotif in white at 10%): "The next cohort is forming." + white-background primary-styled button "Apply Now".

### 3. Program page `/program`

1. PageHeader: "The Program — School of AI Automation".
2. Intro paragraph: 8 weeks, live weekly classes, recordings, assignments, AI study coach, capstone with a real business. Ages 18-30. Free.
3. **Week-by-week timeline** (vertical timeline, gold week-number circles, cards alternating): Week 1-2 AI Fundamentals & Prompt Craft · Week 3 Visual Automation with Make · Week 4-5 n8n + WhatsApp Automation ("the money skill") · Week 6 AI Voice Agents with VAPI · Week 7-8 Capstone: build and deploy for a real SVG business (optional website crash session included).
4. **What you need** (Card list): a laptop or reliable phone + browser, internet access, roughly 8-10 hours per week, no coding experience required.
5. **What graduation requires** (Card, green left border): every weekly assignment completed, and one verified deployed capstone. State plainly: "This is a school for people who finish things."
6. CTA band: Apply.

### 4. For Businesses page `/businesses`

1. PageHeader: "Get a Free Automation for Your Business".
2. Explainer: a supervised student builds you a WhatsApp bot, workflow automation, or voice agent at no cost; you agree to a short discovery chat, give feedback, and allow the finished project (with your approval) on our public Outcomes Board.
3. **Examples grid** (three Cards): guesthouse WhatsApp booking bot; retail missed-call text-back and review requests; tour operator inquiry-to-booking automation.
4. **Interest form** (Card, max-w-lg): fields Business name (required), Contact name (required), Email (required, validated), WhatsApp number (optional), Business type (select: Tourism/Guesthouse, Restaurant/Bar, Retail, Tours & Transport, Services, Other), What's your biggest time-waster? (textarea, optional). Submit: primary button "Register Interest". On success replace the form with a success Card (svggreen-100 background, check icon): "You're on the list. We'll reach out when student matching opens." Handle duplicate email for the same audience gracefully (show the same success state; do not error).
5. This form inserts into `interest_signups` with `audience = 'business'`.

### 5. About page `/about`

1. PageHeader: "Why This Exists".
2. Mission narrative (adapt, do not fabricate beyond this): SVG youth unemployment near 41%; AI is the biggest economic equalizer in a generation; the Institute trains builders, not certificate collectors; long-term vision includes schools for digital marketing, prompt engineering, and video, plus an innovation ecosystem.
3. **Founder Card:** Dom Cortez, Founder — DNA Global Enterprises. 25+ years across transportation, logistics, and systems building; AI systems operator. Include the line "Faith. Family. Empire." as a personal creed styled as a quote. Avatar placeholder.
4. **Instructors section:** grid of instructor Cards (name, title, one-liner). Ship with the founder card plus two placeholder Cards containing EmptyState "Instructor announcement coming soon" so the layout is real and Dom fills names later.
5. Student interest capture (Card): "Want to be notified when applications open?" Email input + button, inserts into `interest_signups` with `audience = 'student'`. Same success and duplicate handling as the business form.

### 6. FAQ page `/faq`

Accordion (accessible: buttons with aria-expanded, chevron rotation). Ship with these ten Q&As, editable copy:
1. How much does it cost? — Free at launch; admission is by application.
2. Who can apply? — Ages 18-30, based in SVG (diaspora may be considered later).
3. Do I need coding experience? — No. You need commitment and 8-10 hours a week.
4. Is this online? — Yes, fully online: live weekly classes plus recordings.
5. What do I graduate with? — A verified deployed system for a real business, a public showcase page, and a certificate.
6. What tools will I learn? — Claude and modern AI models, Make, n8n, WhatsApp automation, VAPI voice agents.
7. Can I do this from a phone? — Partially; a laptop is strongly recommended for build weeks.
8. What happens if I fall behind? — Progression gates and instructors keep you on pace; the program rewards finishers.
9. I own a business, how do I get a free automation? — Register on the For Businesses page.
10. Who runs this? — Founded by Dom Cortez (DNA Global Enterprises) with volunteer instructors from SVG and the diaspora.

### 7. `/apply` placeholder page

PageHeader "Applications" + Card with EmptyState: "Applications for Cohort 1 open soon." + the student interest-capture form (same `interest_signups` insert, `audience = 'student'`). A later PRD replaces this page with the full application; build it so the route swap is a one-file change.

### 8. Footer (update existing)

Three columns on desktop, stacked mobile: (1) wordmark + one-line mission + the three-bar flag accent (thin stacked bars: svgblue-500, svggold-500, svggreen-500); (2) links: Program, For Businesses, About, FAQ, Sign In; (3) contact email placeholder + "Kingstown, Saint Vincent and the Grenadines". Bottom line: © year, "SVG AI Institute".

### 9. SEO and metadata

1. `react-helmet-async` (or equivalent): unique title + meta description per page. Title pattern: "{Page} — SVG AI Institute". Home: "SVG AI Institute — Free AI & Automation School for Vincentian Youth".
2. Open Graph + Twitter card tags: og:title, og:description, og:type website, og:image pointing to `/og-image.png` (create a 1200×630 static image: white background, wordmark, blue/gold/green bars, tagline).
3. `public/robots.txt` allowing all, and a static `public/sitemap.xml` listing the six public routes.
4. Semantic HTML throughout: one h1 per page, sections with headings, nav/main/footer landmarks, all images with alt text.

### 10. Performance and accessibility

- Lighthouse targets on the deployed preview: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95 (mobile).
- Lazy-load below-the-fold images. No layout shift on font load (use `font-display: swap`).
- All interactive elements keyboard-reachable with visible focus rings (svgblue-500).

## Data / Schema

Full SQL, delivered as migration file `supabase/migrations/0001_public_site.sql`. This PRD touches one new table. (The platform's `profiles` table and `current_user_role()` helper already exist from the foundation migration; they are not modified here. `current_user_role()` returns the signed-in user's role and is used in policies below.)

```sql
-- ============================================
-- PRD 01: Public site — interest capture
-- ============================================

create type public.interest_audience as enum ('student', 'business');

create table public.interest_signups (
  id             uuid primary key default gen_random_uuid(),
  audience       public.interest_audience not null,
  email          text not null,
  contact_name   text,
  business_name  text,
  whatsapp       text,
  business_type  text,
  pain_point     text,
  created_at     timestamptz not null default now(),
  -- one signup per email per audience
  unique (audience, email)
);

alter table public.interest_signups enable row level security;

-- Anyone (including anonymous visitors) may register interest
create policy "interest_insert_public"
  on public.interest_signups for insert
  to anon, authenticated
  with check (true);

-- Only admins and instructors can read the list
create policy "interest_select_staff"
  on public.interest_signups for select
  using (public.current_user_role() in ('admin', 'instructor'));

-- Only admins can delete (cleanup/spam)
create policy "interest_delete_admin"
  on public.interest_signups for delete
  using (public.current_user_role() = 'admin');

-- No public select, no updates from anyone.
```

Client insert handling: attempt the insert; if Postgres returns a unique-violation error (code 23505), treat it as success in the UI (the person is already on the list). Validate email format client-side before insert; trim and lowercase emails before sending.

## Acceptance Criteria

Verify every item by running the deployed preview (Vercel) and the local app, including at 375px width.

- [ ] All six public routes render: `/`, `/program`, `/businesses`, `/about`, `/faq`, `/apply`
- [ ] Every page is bright: white or svgblue-50 backgrounds only; zero dark sections; text is navy, never pure black (audit visually and grep for `bg-gray-9`, `bg-black`, `#000`)
- [ ] Home page contains all 8 sections in order, including the 41% stat, the capstone promise section, and the blue→green gradient CTA band
- [ ] Program page shows the exact 8-week timeline with the locked curriculum (Make week 3, n8n + WhatsApp weeks 4-5, VAPI week 6, capstone 7-8)
- [ ] Business interest form validates required fields and email format, inserts a row with `audience='business'`, and shows the green success state
- [ ] Student interest capture on `/about` and `/apply` inserts rows with `audience='student'`
- [ ] Submitting the same email twice for the same audience shows success, not an error (verify a 23505 is handled)
- [ ] Anonymous visitors CANNOT read `interest_signups` via the Supabase client (RLS verified); a signed-in admin CAN
- [ ] Navbar sticky with mobile hamburger sheet working; Apply button reachable on mobile
- [ ] Accordion FAQ is keyboard-operable with correct aria-expanded states
- [ ] Unique titles and meta descriptions on all six pages; OG image renders in a link-preview checker
- [ ] robots.txt and sitemap.xml served
- [ ] Lighthouse mobile on deployed preview: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95
- [ ] Full site walk-through at 375px: no horizontal scroll, all CTAs tappable

## Hand-off Note

PRD 01 delivers the complete public face: marketing pages, interest capture with locked-down RLS, SEO, and the three-audience story (students, businesses, government). The `/apply` page is intentionally a placeholder that captures interest; the real application form and admissions review flow arrive in the next PRD and replace that single page.

Run and verify this PRD fully, including the RLS check and the duplicate-email behavior, before moving on. Next in sequence: PRD 02 — Admissions System.
