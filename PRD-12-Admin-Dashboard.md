# PRD 12 — Admin Dashboard

## Overview

This PRD builds the operational command center for the Saint Vincent AI & Innovation Institute (SVG AI Institute): a free, cohort-based online school teaching Vincentians aged 18-30 to build and deploy AI automations, WhatsApp bots, and voice agents for real local businesses.

This is the final PRD. Everything it displays already exists in the database; this PRD adds ZERO new writable state. It is read-only analytics served entirely by staff-gated, security-definer RPCs returning aggregates, so it can never break or corrupt the systems it observes.

It answers the questions a founder running this alongside four other companies actually asks:
- **Is the funnel healthy?** Interest → applications → accepted → enrolled → graduated, with conversion rates.
- **Is the cohort on track?** Per-cohort progress, who's ahead, who's slipping, capstone pipeline state.
- **Is the teaching team drowning?** Pending review queues, turnaround times, per-instructor throughput.
- **Is anyone engaged?** Attendance rates, community activity, coach usage (counts only — never content; coach chats and DMs stay private).
- **Is the machinery running?** Email outbox health, business partner capacity utilization.

It also produces the numbers for the Government of SVG conversation: the funnel and outcomes stats here are the quarterly report to the Ministry, exportable as CSV.

**Design law (applies to every screen):** bright interface only. White and light-blue backgrounds carrying SVG's national colors. No dark backgrounds anywhere. Text is deep navy `#0B2540`, never pure black. Data visualization uses ONLY theme colors: blue for volume, green for good, gold for attention, `warning` for slipping, `danger` reserved for failures.

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite, react-router-dom v6, lucide-react. Charts are built with plain divs/SVG and Tailwind (horizontal bars, sparklines, progress rings) — NO chart library dependency; everything here is bars, rings, and tables.
- **Styling:** Tailwind CSS with the platform theme tokens (restated below)
- **Backend:** Supabase — security-definer RPCs only; no new tables, no new writes, no Edge Functions
- **Existing foundation this PRD builds on:** every prior table and helper: `profiles`, roles, `current_user_role()`, `is_staff()`, `interest_signups`, `applications`, `cohorts`, `enrollments`, `rooms`, `courses`, `modules`, `lessons`, `lesson_progress`, `submissions`, `live_classes`, `class_attendance`, `capstone_projects`, `business_partners`, `showcase_entries`, `certificates`, `messages`, `coach_conversations`, `coach_messages`, `email_outbox`, `point_events`

**Theme tokens (restated for standalone completeness):**

```
svgblue-50 #F0F8FF · svgblue-100 #D6EBFA · svgblue-500 #0072C6 (primary) · svgblue-700 #0059A8 (hover) · svgblue-900 #0B2540 (text only)
svggold-100 #FEF6D0 · svggold-500 #FCD116 (accent) · svggold-600 #E0B500
svggreen-100 #D9F2E2 · svggreen-500 #009639 (success) · svggreen-700 #007A2F
surface-page #FFFFFF · surface-alt #F5F9FC · line #E2ECF4 · ink #0B2540 · ink-muted #5A7184 · danger #D64545 · warning #E8890C
```

## What to Build

### 1. Dashboard shell — `/admin/dashboard`

ProtectedRoute `allowedRoles: ['admin','instructor']`. Sections 2-5 visible to both; sections 6-7 admin-only (hidden entirely for instructors, not disabled). PageHeader "Command Center" + a global cohort filter (All cohorts / specific) that scopes sections 3-5. Auto-refresh every 60s with a subtle "Updated {time} AST" stamp; manual refresh button.

Reusable mini-components to build once here: `StatCard` (big Sora number, label, optional delta arrow), `HBar` (labeled horizontal bar, theme color prop), `MiniRing` (progress ring), `Spark` (7/8-point sparkline from an int array).

### 2. Funnel section

Fed by `get_admin_funnel()`:
- Five StatCards in a row (stacked mobile): Interest signups (student audience), Applications, Accepted, Currently enrolled (active), Graduated — each with conversion % from the previous stage beneath.
- HBar breakdown of application statuses (submitted / under review / accepted / waitlisted / declined).
- Spark of applications per week, last 8 weeks.
- **Export CSV** button: client-side CSV of the funnel numbers + the per-week series, filename `svgai-funnel-{date}.csv`. This is the Ministry-report artifact.

### 3. Cohort health section

Fed by `get_cohort_health()` (rows per cohort; filtered by the global selector):
Per cohort Card: name, dates, status Badge, enrolled/capacity ring, average progress % (required lessons), **on-track split** — expected progress = elapsed program weeks ÷ 8; a student is "slipping" when their progress % is more than one week's worth (12.5 points) behind expected — shown as a green/gold HBar pair (on-track vs slipping counts), capstone pipeline chips (requested / matched / submitted / verified counts), graduated count.

### 4. Student progress matrix

Fed by `get_progress_matrix(p_cohort_id)` (requires a specific cohort selected; prompt to pick one otherwise):
- Table: rows = students (name links to a student drill-down), columns = the 8 modules in order, cells = filled green square (complete: all required lessons done), half gold square (in progress: some done), muted outline (untouched/locked). Sticky first column; horizontal scroll on mobile.
- Right-edge columns: overall %, capstone status Badge, streak, points.
- **Student drill-down drawer:** progress per module with dates, submission history (statuses + links to the review screens), attendance list, points total and recent events. Everything links to existing pages; nothing is re-implemented.

### 5. Instructor workload section

Fed by `get_review_workload()`:
- Three StatCards: Assignments awaiting review, Capstone evidence awaiting, Match requests awaiting — each turns gold at ≥ 10 and shows the oldest item's age ("oldest: 2d") — with buttons to the respective queues.
- Turnaround: median hours from submitted → reviewed, last 30 days, assignments and capstones separately (StatCards; gold when > 48h).
- Per-reviewer table (last 30 days): reviewer name, assignments reviewed, capstones reviewed, median turnaround. Keeps a 2-3 person team honest with each other.

### 6. Engagement section (admin only)

Fed by `get_engagement_stats()`:
- Attendance: per past class (last 10): title, date, attendees / eligible audience, rate HBar (green ≥ 60%, gold below).
- Community: messages in the last 7 days (Spark by day), distinct posters last 7 days.
- Coach usage: coach messages last 7 days (Spark), distinct active coach users, average messages per active user. **Counts only — the RPC must not touch message content.**

### 7. Ops health section (admin only)

Fed by `get_ops_health()`:
- Email outbox: pending count, failed count (danger Badge when > 0), last 5 failures (recipient domain only — not full address — template, error, time), sent last 24h.
- Business pipeline: pending approvals count (button to the queue), approved businesses, capacity utilization (active capstone projects ÷ total capacity, ring).
- Content flags: unpublished-but-linked recordings, lessons stuck in `processing` video state > 24h (each with counts and links).

### 8. Navigation

Add "Command Center" to the staff sidebar (both roles), first position in the staff group.

## Data / Schema

No new tables. One migration `supabase/migrations/0012_admin_dashboard.sql` containing ONLY read RPCs. Every function begins with a staff (or admin) gate; every function returns aggregates or the minimal row data the UI lists. Representative signatures and full bodies for the two most complex; the rest follow the identical pattern and must be implemented with the same gating:

```sql
-- ============================================
-- PRD 12: Read-only dashboard RPCs
-- ============================================

create or replace function public.get_admin_funnel()
returns table (
  interest int, applications int, accepted int,
  enrolled_active int, graduated int,
  by_status jsonb,          -- {"submitted": n, ...}
  weekly jsonb              -- [{"week_start": date, "count": n} x 8]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return query select
    (select count(*)::int from public.interest_signups where audience='student'),
    (select count(*)::int from public.applications),
    (select count(*)::int from public.applications where status='accepted'),
    (select count(*)::int from public.enrollments where status='active'),
    (select count(*)::int from public.enrollments where status='graduated'),
    (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
       (select status::text, count(*)::int as n
        from public.applications group by status) s),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'week_start', w.week_start, 'count', coalesce(a.n,0))
        order by w.week_start), '[]'::jsonb)
     from (select generate_series(
             date_trunc('week', now() - interval '7 weeks'),
             date_trunc('week', now()), interval '1 week')::date as week_start) w
     left join (select date_trunc('week', created_at)::date as ws, count(*)::int as n
                from public.applications
                where created_at > now() - interval '8 weeks'
                group by 1) a on a.ws = w.week_start);
end;
$$;
grant execute on function public.get_admin_funnel() to authenticated;

create or replace function public.get_progress_matrix(p_cohort_id uuid)
returns table (
  user_id uuid, student_name text,
  module_states jsonb,   -- [{"module_id":..,"title":..,"done":n,"required":m}]
  overall_pct int, capstone_status text,
  current_streak int, points int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return query
  select e.user_id,
         p.first_name || ' ' || coalesce(p.last_name,''),
         (select jsonb_agg(jsonb_build_object(
             'module_id', m.id, 'title', m.title,
             'done', (select count(*) from public.lessons l
                      join public.lesson_progress lp on lp.lesson_id = l.id
                        and lp.user_id = e.user_id
                      where l.module_id = m.id and l.required and l.published),
             'required', (select count(*) from public.lessons l
                          where l.module_id = m.id and l.required and l.published))
             order by m.sort_order)
          from public.modules m
          join public.courses c2 on c2.id = m.course_id
          where c2.room_id = co.room_id and c2.status = 'published'),
         coalesce((
           select floor(100.0 * count(lp.*) / nullif(count(l.*),0))::int
           from public.lessons l
           join public.modules m on m.id = l.module_id
           join public.courses c3 on c3.id = m.course_id
             and c3.room_id = co.room_id and c3.status='published'
           left join public.lesson_progress lp on lp.lesson_id = l.id
             and lp.user_id = e.user_id
           where l.required and l.published), 0),
         coalesce((select cp.status::text from public.capstone_projects cp
                   where cp.user_id = e.user_id
                   order by cp.created_at desc limit 1), 'none'),
         coalesce((select s.current_streak from public.streaks s
                   where s.user_id = e.user_id), 0),
         public.user_points(e.user_id)
  from public.enrollments e
  join public.cohorts co on co.id = e.cohort_id
  join public.profiles p on p.id = e.user_id
  where e.cohort_id = p_cohort_id
    and e.status in ('active','graduated')
  order by 2;
end;
$$;
grant execute on function public.get_progress_matrix(uuid) to authenticated;

-- Implement with the SAME staff/admin gating and aggregate-only outputs:
--   get_cohort_health()          -- staff; per-cohort aggregates incl. on-track
--                                --   split and capstone pipeline counts
--   get_review_workload()        -- staff; queue counts + oldest ages + median
--                                --   turnarounds + per-reviewer 30-day table
--   get_engagement_stats()      -- ADMIN ONLY; attendance rates (last 10
--                                --   classes), community counts by day (7d),
--                                --   coach message counts by day (7d) +
--                                --   distinct users. MUST select counts only:
--                                --   never message bodies, never coach content
--   get_ops_health()             -- ADMIN ONLY; outbox pending/failed/sent24h +
--                                --   last 5 failures (domain-only recipients),
--                                --   business capacity utilization,
--                                --   stuck-processing content flags
-- Admin-only functions gate with:
--   if public.current_user_role() <> 'admin' then raise exception 'forbidden';
```

No RLS changes anywhere. No table alterations. No client writes of any kind in this PRD.

## Acceptance Criteria

Verify by hand with admin and instructor accounts and the seeded data, including at 375px.

- [ ] Funnel numbers reconcile exactly against manual table-editor counts of the seeded data; conversion percentages compute correctly; weekly spark shows 8 points
- [ ] CSV export downloads and opens in a spreadsheet with the funnel and weekly series intact
- [ ] Cohort health shows the seeded cohort with correct enrolled/capacity, average progress, on-track vs slipping split (manufacture one slipping student by seeding low progress), and capstone chips
- [ ] Progress matrix renders the 8-module grid with correct cell states for each seeded student; sticky first column works; drill-down drawer shows real submissions, attendance, and points with working links
- [ ] Workload cards show the true pending counts and oldest ages; the queue buttons land on the right pages; per-reviewer table attributes the seeded reviews to the right reviewer with a plausible median
- [ ] Engagement: attendance rates match seeded attendance; community and coach sparks show counts; verify by SQL inspection that `get_engagement_stats` selects NO content columns from messages or coach tables
- [ ] Ops health: seed one failed outbox row → failed count shows danger Badge and the failure lists domain-only recipient; capacity utilization ring matches active projects ÷ total capacity; a lesson seeded stuck in `processing` appears under content flags
- [ ] Instructor account: sections 2-5 render; Engagement and Ops health are entirely absent from the DOM; calling `get_engagement_stats`/`get_ops_health` from the instructor's console raises `forbidden`
- [ ] A student calling ANY dashboard RPC from the console raises `forbidden`
- [ ] Cohort filter scopes sections 3-5; auto-refresh updates the stamp; manual refresh works
- [ ] Every visualization uses only theme colors; bright throughout; usable at 375px with horizontal-scroll matrix

## Hand-off Note

PRD 12 is the FINAL PRD. The Command Center reads everything and writes nothing: funnel for the Ministry conversation, cohort health for the founder, workload for the teaching team, engagement and ops for the admin — all through staff-gated aggregate RPCs that respect the privacy lines drawn earlier (coach chats and DMs stay unreadable, even here).

The complete build order is: 00 Foundation → 01 Public Website → 02 Admissions → 03 Rooms & Course Engine → 04 Assignments → 05 Live Classes → 06 Capstone Pipeline → 07 Outcomes & Certificates → 08 Community → 09 Gamification → 10 AI Study Coach → 11 Notifications & Email → 12 Admin Dashboard.

Run PRD 00 first. Verify every one of its Acceptance Criteria by hand — especially the RLS checks — before touching PRD 01. Then proceed strictly one PRD at a time, verifying each fully before starting the next. Never run PRDs in parallel, never skip ahead: later PRDs assume the earlier ones are not just built but PROVEN.
