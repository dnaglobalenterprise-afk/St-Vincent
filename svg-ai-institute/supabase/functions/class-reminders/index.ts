// Edge Function: class-reminders  (Supabase Cron: */15 * * * *)
// Finds scheduled classes starting ~60 min out (45–75 min window), resolves the
// audience (room members, narrowed to the cohort when the class is cohort-scoped),
// and enqueues in-app notifications + prefs-respecting emails. Exactly-once is
// guaranteed by the class_reminders_sent primary key — a second run sends nothing.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const AST_TZ = 'America/St_Vincent'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const now = Date.now()
  const from = new Date(now + 45 * 60_000).toISOString()
  const to = new Date(now + 75 * 60_000).toISOString()

  const { data: classes, error } = await admin
    .from('live_classes')
    .select('id, room_id, cohort_id, title, scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
  if (error) return json({ error: error.message }, 500)

  let reminded = 0
  const results: string[] = []
  for (const cls of classes ?? []) {
    // Exactly-once claim: insert the marker first; a duplicate key means another
    // run already handled this class, so skip.
    const { error: claimErr } = await admin.from('class_reminders_sent').insert({ class_id: cls.id })
    if (claimErr) {
      results.push(`${cls.id}: already sent`)
      continue
    }

    // Resolve audience: enrolled students in the room, narrowed to the cohort if set.
    let query = admin
      .from('enrollments')
      .select('user_id, cohort_id, cohorts!inner(room_id)')
      .in('status', ['active', 'graduated'])
      .eq('cohorts.room_id', cls.room_id)
    if (cls.cohort_id) query = query.eq('cohort_id', cls.cohort_id)
    const { data: enr } = await query
    const userIds = [...new Set((enr ?? []).map((e) => (e as { user_id: string }).user_id))]

    const timeAst = new Intl.DateTimeFormat('en-US', {
      timeZone: AST_TZ, weekday: 'short', hour: 'numeric', minute: '2-digit',
    }).format(new Date(cls.scheduled_at))

    for (const uid of userIds) {
      await admin.rpc('notify', {
        p_user: uid, p_type: 'class_reminder',
        p_title: `Class soon: ${cls.title}`, p_body: `Starts ${timeAst} AST`, p_link: '/learn/classes',
      })
      await admin.rpc('enqueue_email', {
        p_user: uid, p_pref: 'email_classes', p_template: 'class_reminder',
        p_payload: { title: cls.title, time_ast: timeAst },
      })
    }
    reminded += userIds.length
    results.push(`${cls.id}: reminded ${userIds.length}`)
  }

  return json({ classes: (classes ?? []).length, reminded, results })
})
