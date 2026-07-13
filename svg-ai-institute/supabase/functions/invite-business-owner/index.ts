// Edge Function: invite-business-owner (admin only)
// Invites a business's contact email as a business_partner account and links it
// to the business as owner_user_id. Idempotent: if an account already exists,
// just (re)links it.

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
    const { business_id } = await req.json()
    if (!business_id) return json({ error: 'business_id is required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Caller must be an admin
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)
    const { data: caller } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Admins only' }, 403)

    // Business must be approved
    const { data: biz } = await admin
      .from('business_partners')
      .select('id, status, owner_user_id')
      .eq('id', business_id)
      .single()
    if (!biz) return json({ error: 'Business not found' }, 404)
    if (biz.status !== 'approved') return json({ error: 'Business is not approved' }, 400)
    if (biz.owner_user_id) return json({ ok: true, already: true })

    const { data: contact } = await admin
      .from('business_contacts')
      .select('email, contact_name')
      .eq('business_id', business_id)
      .single()
    if (!contact) return json({ error: 'Business has no contact email' }, 400)
    const email = String(contact.email).toLowerCase()

    // Find existing account, or invite a new one
    const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    let userId: string | null = existing?.id ?? null

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

    // Set role business_partner and carry the contact name
    const nameParts = (contact.contact_name ?? '').trim().split(/\s+/)
    const { error: profErr } = await admin
      .from('profiles')
      .update({
        role: 'business_partner',
        first_name: nameParts[0] ?? null,
        last_name: nameParts.slice(1).join(' ') || null,
      })
      .eq('id', userId)
    if (profErr) return json({ error: `Profile update failed: ${profErr.message}` }, 500)

    const { error: linkErr } = await admin
      .from('business_partners')
      .update({ owner_user_id: userId })
      .eq('id', business_id)
    if (linkErr) return json({ error: `Link failed: ${linkErr.message}` }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
