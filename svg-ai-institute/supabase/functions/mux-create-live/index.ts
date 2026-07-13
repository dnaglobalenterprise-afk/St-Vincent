// Edge Function: mux-create-live (staff only)
// Provisions a Mux live stream for an embedded-mode class: stores the live
// stream id + playback id on the class and the stream key in the staff-only
// live_class_secrets table. Auto-record is on (new_asset_settings public).

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
    const { class_id } = await req.json()
    if (!class_id) return json({ error: 'class_id is required' }, 400)

    const tokenId = Deno.env.get('MUX_TOKEN_ID')
    const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET')
    if (!tokenId || !tokenSecret) {
      return json({ error: 'Mux is not configured (MUX_TOKEN_ID / MUX_TOKEN_SECRET missing)' }, 503)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Caller must be staff
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (!caller || !['admin', 'instructor'].includes(caller.role)) {
      return json({ error: 'Staff only' }, 403)
    }

    const { data: cls } = await admin
      .from('live_classes')
      .select('id, mux_live_stream_id')
      .eq('id', class_id)
      .single()
    if (!cls) return json({ error: 'Class not found' }, 404)
    if (cls.mux_live_stream_id) return json({ ok: true, already: true })

    const muxRes = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${tokenId}:${tokenSecret}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playback_policy: ['public'],
        latency_mode: 'standard',
        new_asset_settings: { playback_policy: ['public'] },
        passthrough: class_id,
      }),
    })
    if (!muxRes.ok) return json({ error: `Mux live create failed: ${await muxRes.text()}` }, 502)
    const stream = (await muxRes.json()).data
    const playbackId = stream.playback_ids?.[0]?.id ?? null

    const { error: updErr } = await admin
      .from('live_classes')
      .update({ mux_live_stream_id: stream.id, mux_live_playback_id: playbackId })
      .eq('id', class_id)
    if (updErr) return json({ error: `Class update failed: ${updErr.message}` }, 500)

    const { error: secErr } = await admin
      .from('live_class_secrets')
      .upsert({ class_id, stream_key: stream.stream_key }, { onConflict: 'class_id' })
    if (secErr) return json({ error: `Secret store failed: ${secErr.message}` }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
