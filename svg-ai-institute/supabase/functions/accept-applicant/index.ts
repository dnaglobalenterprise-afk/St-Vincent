// Edge Function: accept-applicant
// Admin-only acceptance path: verifies the caller is an admin, invites the
// applicant (if they have no account yet), enrolls them in the chosen cohort,
// and marks the application accepted. Idempotent: re-running repairs state
// instead of duplicating it. Uses the service-role key (never shipped to the
// client).

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const { application_id, cohort_id } = await req.json()
    if (!application_id || !cohort_id) {
      return json({ error: 'application_id and cohort_id are required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Caller must be a signed-in admin
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (caller?.role !== 'admin') return json({ error: 'Admins only' }, 403)

    // 2. Load application and cohort
    const { data: app } = await admin
      .from('applications')
      .select('*')
      .eq('id', application_id)
      .single()
    if (!app) return json({ error: 'Application not found' }, 404)

    const { data: cohort } = await admin.from('cohorts').select('*').eq('id', cohort_id).single()
    if (!cohort) return json({ error: 'Cohort not found' }, 404)
    if (!['open', 'draft'].includes(cohort.status)) {
      return json({ error: `Cohort is ${cohort.status}, not open` }, 400)
    }

    const email = String(app.email).toLowerCase()

    // 3. Find existing account by email, and whether they are already enrolled
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    let userId: string | null = existingProfile?.id ?? null

    let alreadyEnrolled = false
    if (userId) {
      const { data: enr } = await admin
        .from('enrollments')
        .select('id')
        .eq('cohort_id', cohort_id)
        .eq('user_id', userId)
        .maybeSingle()
      alreadyEnrolled = !!enr
    }

    // Capacity guard (skipped when repairing an existing enrollment)
    if (!alreadyEnrolled) {
      const { count } = await admin
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', cohort_id)
      if ((count ?? 0) >= cohort.capacity) return json({ error: 'Cohort is full' }, 400)
    }

    // Invite if no account exists — Supabase emails a magic sign-in invitation;
    // the foundation trigger auto-creates their profile with role student.
    if (!userId) {
      const siteUrl = Deno.env.get('SITE_URL') ?? ''
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: siteUrl + '/auth/callback',
      })
      if (invErr || !invited?.user) {
        return json({ error: `Invite failed: ${invErr?.message ?? 'unknown'}` }, 500)
      }
      userId = invited.user.id
    }

    // 4. Carry the applicant's name onto their profile
    const { error: profErr } = await admin
      .from('profiles')
      .update({ first_name: app.first_name, last_name: app.last_name })
      .eq('id', userId)
    if (profErr) return json({ error: `Profile update failed: ${profErr.message}` }, 500)

    // 5. Enroll (unique constraint + ignoreDuplicates makes re-runs safe)
    const { error: enrErr } = await admin
      .from('enrollments')
      .upsert(
        { cohort_id, user_id: userId, status: 'active' },
        { onConflict: 'cohort_id,user_id', ignoreDuplicates: true },
      )
    if (enrErr) return json({ error: `Enrollment failed: ${enrErr.message}` }, 500)

    // 6. Mark the application accepted
    const { error: updErr } = await admin
      .from('applications')
      .update({
        status: 'accepted',
        decided_at: new Date().toISOString(),
        decided_by: userData.user.id,
        cohort_id,
      })
      .eq('id', application_id)
    if (updErr) return json({ error: `Application update failed: ${updErr.message}` }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
