// Edge Function: mux-webhook
// Receives Mux webhooks (signature-verified). On video.asset.ready, stores the
// playback id and duration on the matching lesson; on failures marks errored.
// Deploy with verify_jwt disabled — Mux authenticates via its signature header.

import { createClient } from 'npm:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return expected === signature
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const rawBody = await req.text()

    const webhookSecret = Deno.env.get('MUX_WEBHOOK_SECRET')
    if (!webhookSecret) return json({ error: 'MUX_WEBHOOK_SECRET not configured' }, 503)
    const valid = await verifySignature(rawBody, req.headers.get('mux-signature'), webhookSecret)
    if (!valid) return json({ error: 'Invalid signature' }, 401)

    const event = JSON.parse(rawBody)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (event.type === 'video.live_stream.active') {
      const streamId: string | undefined = event.data?.id
      if (streamId) {
        await admin.from('live_classes').update({ status: 'live' }).eq('mux_live_stream_id', streamId)
      }
    } else if (event.type === 'video.live_stream.idle') {
      const streamId: string | undefined = event.data?.id
      if (streamId) {
        await admin.from('live_classes').update({ status: 'ended' }).eq('mux_live_stream_id', streamId)
      }
    } else if (event.type === 'video.asset.ready') {
      const uploadId: string | undefined = event.data?.upload_id
      const liveStreamId: string | undefined = event.data?.live_stream_id
      const assetId: string | undefined = event.data?.id
      const playbackId: string | undefined = event.data?.playback_ids?.[0]?.id
      const duration: number | null = event.data?.duration ? Math.round(event.data.duration) : null

      if (liveStreamId && playbackId) {
        // Recording of a live stream: create a ready recordings row for its class.
        const { data: cls } = await admin
          .from('live_classes')
          .select('id, room_id, title, description')
          .eq('mux_live_stream_id', liveStreamId)
          .maybeSingle()
        if (cls) {
          const { data: existing } = await admin
            .from('recordings')
            .select('id')
            .eq('mux_asset_id', assetId)
            .maybeSingle()
          if (!existing) {
            await admin.from('recordings').insert({
              room_id: cls.room_id,
              class_id: cls.id,
              title: `${cls.title} — recording`,
              description: cls.description,
              mux_asset_id: assetId,
              mux_playback_id: playbackId,
              duration_seconds: duration,
              status: 'ready',
            })
          }
        }
      } else if (uploadId && playbackId) {
        // External-mode recording upload flips to ready...
        const { data: rec } = await admin
          .from('recordings')
          .select('id')
          .eq('mux_upload_id', uploadId)
          .maybeSingle()
        if (rec) {
          await admin
            .from('recordings')
            .update({ mux_playback_id: playbackId, mux_asset_id: assetId, status: 'ready', duration_seconds: duration })
            .eq('mux_upload_id', uploadId)
        } else {
          // ...otherwise fall through to the existing lesson-video handling.
          await admin
            .from('lessons')
            .update({ mux_playback_id: playbackId, video_status: 'ready', duration_seconds: duration })
            .eq('mux_upload_id', uploadId)
        }
      }
    } else if (event.type === 'video.asset.errored' || event.type === 'video.upload.errored') {
      const uploadId: string | undefined = event.data?.upload_id ?? event.data?.id
      if (uploadId) {
        await admin.from('lessons').update({ video_status: 'errored' }).eq('mux_upload_id', uploadId)
        await admin.from('recordings').update({ status: 'errored' }).eq('mux_upload_id', uploadId)
      }
    }

    return json({ received: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
