-- ============================================
-- PRD 12: Read-only dashboard RPCs (no new tables, no writes)
-- Every function is staff- or admin-gated and returns aggregates only.
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

-- ---- Cohort health (staff) ----
create or replace function public.get_cohort_health()
returns table (
  cohort_id uuid, name text, start_date date, end_date date, status text,
  enrolled int, capacity int, avg_progress int, on_track int, slipping int,
  cap_requested int, cap_matched int, cap_submitted int, cap_verified int, graduated int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return query
  with sp as (  -- per (cohort, student) progress pct over required published lessons
    select e.cohort_id, e.user_id, e.status as enr_status,
      coalesce(floor(100.0 * count(lp.lesson_id) / nullif(count(l.id),0)), 0)::int as pct
    from public.enrollments e
    join public.cohorts co on co.id = e.cohort_id
    join public.courses c on c.room_id = co.room_id and c.status='published'
    join public.modules m on m.course_id = c.id
    join public.lessons l on l.module_id = m.id and l.required and l.published
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
    where e.status in ('active','graduated')
    group by e.cohort_id, e.user_id, e.status
  )
  select co.id, co.name, co.start_date, co.end_date, co.status::text,
    (select count(*)::int from public.enrollments e where e.cohort_id=co.id and e.status in ('active','graduated')),
    co.capacity,
    coalesce((select avg(pct)::int from sp where sp.cohort_id=co.id),0),
    (select count(*)::int from sp where sp.cohort_id=co.id and sp.enr_status='active'
       and sp.pct >= (least(8, greatest(0, extract(epoch from (now()-co.start_date))/604800))/8*100) - 12.5),
    (select count(*)::int from sp where sp.cohort_id=co.id and sp.enr_status='active'
       and sp.pct < (least(8, greatest(0, extract(epoch from (now()-co.start_date))/604800))/8*100) - 12.5),
    (select count(*)::int from public.capstone_projects cp where cp.cohort_id=co.id and cp.status='requested'),
    (select count(*)::int from public.capstone_projects cp where cp.cohort_id=co.id and cp.status='matched'),
    (select count(*)::int from public.capstone_projects cp where cp.cohort_id=co.id and cp.status='submitted'),
    (select count(*)::int from public.capstone_projects cp where cp.cohort_id=co.id and cp.status='verified'),
    (select count(*)::int from public.enrollments e where e.cohort_id=co.id and e.status='graduated')
  from public.cohorts co
  order by co.start_date desc nulls last;
end;
$$;
grant execute on function public.get_cohort_health() to authenticated;

-- ---- Review workload (staff) ----
create or replace function public.get_review_workload()
returns table (
  assignments_pending int, assignments_oldest_hours int,
  capstones_pending int, capstones_oldest_hours int,
  matches_pending int, matches_oldest_hours int,
  median_assignment_hours numeric, median_capstone_hours numeric,
  reviewers jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return query select
    (select count(*)::int from public.submissions where status='submitted'),
    coalesce((select (extract(epoch from (now()-min(created_at)))/3600)::int from public.submissions where status='submitted'),0),
    (select count(*)::int from public.capstone_projects where status='submitted'),
    coalesce((select (extract(epoch from (now()-min(submitted_at)))/3600)::int from public.capstone_projects where status='submitted'),0),
    (select count(*)::int from public.capstone_projects where status='requested'),
    coalesce((select (extract(epoch from (now()-min(created_at)))/3600)::int from public.capstone_projects where status='requested'),0),
    (select round(percentile_cont(0.5) within group (order by extract(epoch from (reviewed_at-created_at))/3600)::numeric,1)
       from public.submissions where reviewed_at is not null and reviewed_at > now()-interval '30 days'),
    (select round(percentile_cont(0.5) within group (order by extract(epoch from (verified_at-submitted_at))/3600)::numeric,1)
       from public.capstone_projects where verified_at is not null and verified_at > now()-interval '30 days'),
    (select coalesce(jsonb_agg(jsonb_build_object('name', rn, 'assignments', a_cnt, 'capstones', c_cnt, 'median_hours', med) order by (a_cnt+c_cnt) desc), '[]'::jsonb)
     from (
       select coalesce(nullif(trim(p.first_name||' '||coalesce(p.last_name,'')),''), p.email) rn,
         (select count(*)::int from public.submissions s where s.reviewed_by=p.id and s.reviewed_at > now()-interval '30 days') a_cnt,
         (select count(*)::int from public.capstone_projects cp where cp.verified_by=p.id and cp.verified_at > now()-interval '30 days') c_cnt,
         (select round(percentile_cont(0.5) within group (order by extract(epoch from (s.reviewed_at-s.created_at))/3600)::numeric,1)
            from public.submissions s where s.reviewed_by=p.id and s.reviewed_at > now()-interval '30 days') med
       from public.profiles p where p.role in ('admin','instructor')
     ) r where (a_cnt + c_cnt) > 0);
end;
$$;
grant execute on function public.get_review_workload() to authenticated;

-- ---- Engagement (ADMIN ONLY) — counts only, never message/coach content ----
create or replace function public.get_engagement_stats()
returns table (attendance jsonb, community jsonb, coach jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'admin' then raise exception 'forbidden'; end if;
  return query select
    (select coalesce(jsonb_agg(jsonb_build_object('title',x.title,'date',x.scheduled_at,'attendees',x.att,'eligible',x.elig) order by x.scheduled_at desc),'[]'::jsonb)
     from (
       select lc.id, lc.title, lc.scheduled_at,
         (select count(*)::int from public.class_attendance ca where ca.class_id=lc.id) att,
         (select count(distinct e.user_id)::int from public.enrollments e join public.cohorts co on co.id=e.cohort_id
            where co.room_id=lc.room_id and e.status in ('active','graduated') and (lc.cohort_id is null or e.cohort_id=lc.cohort_id)) elig
       from public.live_classes lc where lc.scheduled_at < now()
       order by lc.scheduled_at desc limit 10
     ) x),
    jsonb_build_object(
      'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day',d.dt,'count',coalesce(c.n,0)) order by d.dt),'[]'::jsonb)
        from (select generate_series((now()-interval '6 days')::date, now()::date, interval '1 day')::date dt) d
        left join (select created_at::date dd, count(*)::int n from public.messages where created_at > now()-interval '7 days' group by 1) c on c.dd=d.dt),
      'posters', (select count(distinct author_id)::int from public.messages where created_at > now()-interval '7 days')),
    jsonb_build_object(
      'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day',d.dt,'count',coalesce(c.n,0)) order by d.dt),'[]'::jsonb)
        from (select generate_series((now()-interval '6 days')::date, now()::date, interval '1 day')::date dt) d
        left join (select cm.created_at::date dd, count(*)::int n from public.coach_messages cm where cm.created_at > now()-interval '7 days' group by 1) c on c.dd=d.dt),
      'users', (select count(distinct cc.user_id)::int from public.coach_messages cm join public.coach_conversations cc on cc.id=cm.conversation_id where cm.created_at > now()-interval '7 days'),
      'avg_per_user', coalesce((select round(count(*)::numeric / nullif(count(distinct cc.user_id),0),1) from public.coach_messages cm join public.coach_conversations cc on cc.id=cm.conversation_id where cm.created_at > now()-interval '7 days'),0));
end;
$$;
grant execute on function public.get_engagement_stats() to authenticated;

-- ---- Ops health (ADMIN ONLY) ----
create or replace function public.get_ops_health()
returns table (outbox jsonb, business jsonb, content_flags jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'admin' then raise exception 'forbidden'; end if;
  return query select
    jsonb_build_object(
      'pending', (select count(*)::int from public.email_outbox where status='pending'),
      'failed', (select count(*)::int from public.email_outbox where status='failed'),
      'sent_24h', (select count(*)::int from public.email_outbox where status='sent' and sent_at > now()-interval '24 hours'),
      'recent_failures', (select coalesce(jsonb_agg(jsonb_build_object('domain', split_part(to_email,'@',2), 'template', template, 'error', left(coalesce(last_error,''),80), 'at', created_at) order by created_at desc),'[]'::jsonb)
        from (select * from public.email_outbox where status='failed' order by created_at desc limit 5) f)),
    jsonb_build_object(
      'pending', (select count(*)::int from public.business_partners where status='pending'),
      'approved', (select count(*)::int from public.business_partners where status='approved'),
      'capacity', (select coalesce(sum(capacity),0)::int from public.business_partners where status='approved'),
      'active_projects', (select count(*)::int from public.capstone_projects where status in ('matched','submitted','changes_requested','verified'))),
    jsonb_build_object(
      'unpublished_linked_recordings', (select count(*)::int from public.recordings where published=false and jsonb_typeof(attached_lesson_ids)='array' and jsonb_array_length(attached_lesson_ids) > 0),
      'stuck_processing', (select count(*)::int from public.lessons where video_status='processing' and updated_at < now()-interval '24 hours'));
end;
$$;
grant execute on function public.get_ops_health() to authenticated;
