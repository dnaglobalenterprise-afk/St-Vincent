// Edge Function: mux-create-upload (admin only)
// Creates a Mux direct upload for a video lesson, stores the upload id on the
// lesson, and returns the browser-upload URL. Mux credentials live only here.

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
    const { lesson_id, recording_id } = await req.json()
    if (!lesson_id && !recording_id) {
      return json({ error: 'lesson_id or recording_id is required' }, 400)
    }

    const tokenId = Deno.env.get('MUX_TOKEN_ID')
    const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET')
    if (!tokenId || !tokenSecret) {
      return json({ error: 'Mux is not configured yet (MUX_TOKEN_ID / MUX_TOKEN_SECRET missing)' }, 503)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Caller must be an admin
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (caller?.role !== 'admin') return json({ error: 'Admins only' }, 403)

    if (lesson_id) {
      const { data: lesson } = await admin.from('lessons').select('id, type').eq('id', lesson_id).single()
      if (!lesson || lesson.type !== 'video') return json({ error: 'Video lesson not found' }, 404)
    } else {
      const { data: rec } = await admin.from('recordings').select('id').eq('id', recording_id).single()
      if (!rec) return json({ error: 'Recording not found' }, 404)
    }

    const muxRes = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${tokenId}:${tokenSecret}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cors_origin: Deno.env.get('SITE_URL') ?? '*',
        new_asset_settings: { playback_policy: ['public'], passthrough: lesson_id ?? recording_id },
      }),
    })
    if (!muxRes.ok) {
      return json({ error: `Mux upload creation failed: ${await muxRes.text()}` }, 502)
    }
    const upload = (await muxRes.json()).data

    if (lesson_id) {
      const { error: updErr } = await admin
        .from('lessons')
        .update({ mux_upload_id: upload.id, video_status: 'processing', mux_playback_id: null })
        .eq('id', lesson_id)
      if (updErr) return json({ error: `Lesson update failed: ${updErr.message}` }, 500)
    } else {
      const { error: updErr } = await admin
        .from('recordings')
        .update({ mux_upload_id: upload.id, status: 'processing' })
        .eq('id', recording_id)
      if (updErr) return json({ error: `Recording update failed: ${updErr.message}` }, 500)
    }

    return json({ upload_url: upload.url, upload_id: upload.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
