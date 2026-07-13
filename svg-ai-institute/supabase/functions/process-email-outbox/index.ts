// Edge Function: process-email-outbox  (Supabase Cron: * * * * *)
// Drains pending email_outbox rows through Resend with retry/backoff. No email
// is ever sent from a DB trigger — triggers only enqueue rows here — so a Resend
// outage can never break a platform action. Claims are atomic (SKIP LOCKED lease
// via claim_email_batch), so overlapping runs never double-send.

import { createClient } from 'npm:@supabase/supabase-js@2'

const BATCH = 25
const MAX_ATTEMPTS = 4
const BACKOFF_MIN = [2, 10, 60] // minutes after failure 1, 2, 3

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const RESEND = Deno.env.get('RESEND_API_KEY')
  const FROM = Deno.env.get('EMAIL_FROM') ?? 'SVG AI Institute <onboarding@resend.dev>'
  const SITE = Deno.env.get('SITE_URL') ?? ''
  if (!RESEND) return json({ skipped: 'RESEND_API_KEY not configured' }, 200)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Atomically claim a batch of due rows (leased 5 min against concurrent runs).
  const { data: rows, error } = await admin.rpc('claim_email_batch', { p_limit: BATCH })
  if (error) return json({ error: error.message }, 500)
  const batch = (rows ?? []) as OutboxRow[]

  let sent = 0
  let failed = 0
  for (const row of batch) {
    try {
      const { subject, html, text } = render(row.template, row.payload ?? {}, SITE)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: row.to_email, subject, html, text }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        await onFailure(admin, row, `${res.status} ${detail.slice(0, 200)}`)
        failed++
        continue
      }
      const body = await res.json().catch(() => ({}))
      await admin.from('email_outbox').update({ status: 'sent', resend_id: body.id ?? null, sent_at: new Date().toISOString() }).eq('id', row.id)
      sent++
    } catch (e) {
      await onFailure(admin, row, String(e).slice(0, 200))
      failed++
    }
  }

  return json({ claimed: batch.length, sent, failed })
})

interface OutboxRow {
  id: string
  to_email: string
  template: string
  payload: Record<string, unknown>
  attempts: number
}

async function onFailure(admin: ReturnType<typeof createClient>, row: OutboxRow, err: string) {
  const attempts = row.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await admin.from('email_outbox').update({ status: 'failed', attempts, last_error: err }).eq('id', row.id)
    return
  }
  const delay = BACKOFF_MIN[attempts - 1] ?? 60
  await admin
    .from('email_outbox')
    .update({ status: 'pending', attempts, last_error: err, scheduled_at: new Date(Date.now() + delay * 60_000).toISOString() })
    .eq('id', row.id)
}

// ---------------- Templates ----------------

const BLUE = '#0072C6'
const INK = '#0B2540'
const MUTED = '#5A7184'

function base(title: string, bodyHtml: string, site: string): string {
  const prefs = `${site}/settings/notifications`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F5F9FC;font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2ECF4;">
    <div style="height:6px;display:flex;">
      <div style="flex:1;background:${BLUE};"></div><div style="flex:1;background:#FCD116;"></div><div style="flex:1;background:#009639;"></div>
    </div>
    <div style="padding:28px 28px 8px;">
      <p style="margin:0 0 20px;font-weight:700;font-size:18px;color:${BLUE};">SVG AI Institute</p>
      ${bodyHtml}
    </div>
    <div style="padding:20px 28px;border-top:1px solid #E2ECF4;color:${MUTED};font-size:12px;line-height:1.6;">
      <a href="${prefs}" style="color:${BLUE};">Manage email preferences</a><br/>
      Saint Vincent AI &amp; Innovation Institute · Kingstown, St. Vincent &amp; the Grenadines
    </div>
  </div>
</div></body></html>`
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;margin:8px 0;">${label}</a>`
}
function h(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${INK};">${text}</h1>`
}
function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${text}</p>`
}
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function render(template: string, payload: Record<string, unknown>, site: string): { subject: string; html: string; text: string } {
  const P = payload as Record<string, string>
  switch (template) {
    case 'assignment_reviewed': {
      const approved = P.decision === 'approved'
      const subject = approved ? 'Your assignment was approved ✓' : 'Feedback on your assignment'
      const inner = `${h(approved ? 'Approved ✓' : 'Feedback is in')}
        ${p(`Your instructor reviewed <strong>${esc(P.lesson_title)}</strong>.`)}
        ${P.feedback ? p(`“${esc(P.feedback)}”`) : ''}
        ${button(approved ? 'See your progress' : 'Read the feedback', `${site}/learn/lesson/${esc(P.lesson_id)}`)}`
      const text = `${subject}\n\nYour instructor reviewed "${P.lesson_title}".\n${P.feedback ? `Feedback: ${P.feedback}\n` : ''}Open: ${site}/learn/lesson/${P.lesson_id}\n\nManage email preferences: ${site}/settings/notifications`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'capstone_update': {
      const map: Record<string, string> = {
        matched: 'Your capstone match was approved 🎉',
        verified: 'Your capstone is verified 🚀',
        changes_requested: 'Your capstone needs a few changes',
        declined: 'An update on your capstone match',
        published: 'Your project is live on the Outcomes Board 🌍',
      }
      const subject = map[P.status] ?? 'Capstone update'
      const link = P.status === 'published' ? `${site}/outcomes/${esc(P.slug)}` : `${site}/learn/capstone`
      const inner = `${h(subject)}${p('Head to your capstone hub for the details and next steps.')}${button('Open capstone', link)}`
      const text = `${subject}\n\nOpen: ${link}\n\nManage email preferences: ${site}/settings/notifications`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'application_waitlisted': {
      const subject = "You're on the waitlist for SVG AI Institute"
      const inner = `${h('You made a strong impression')}
        ${p(`Hi ${esc(P.first_name)}, thank you for applying. This cohort filled up, but you're on our waitlist — if a seat opens we'll reach out first.`)}
        ${p(`You're also welcome to reapply for the next cohort. Your reference is <strong>${esc(P.ref_code)}</strong>.`)}`
      const text = `Hi ${P.first_name}, thank you for applying. This cohort filled up, but you're on our waitlist. You may reapply next cohort. Reference: ${P.ref_code}.`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'application_declined': {
      const subject = 'An update on your SVG AI Institute application'
      const inner = `${h('Thank you for applying')}
        ${p(`Hi ${esc(P.first_name)}, we can't offer you a seat this cohort. This isn't the end — the program runs again, and we'd genuinely welcome a fresh application next time.`)}
        ${p('Your reference is <strong>' + esc(P.ref_code) + '</strong>.')}`
      const text = `Hi ${P.first_name}, we can't offer you a seat this cohort. The program runs again — please reapply. Reference: ${P.ref_code}.`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'class_reminder': {
      const subject = `Class starting soon: ${P.title}`
      const inner = `${h('Your live class starts in about an hour')}
        ${p(`<strong>${esc(P.title)}</strong> begins at <strong>${esc(P.time_ast)}</strong> (AST).`)}
        ${p('Find your seat in the classes area a few minutes early.')}
        ${button('Go to classes', `${site}/learn/classes`)}`
      const text = `${P.title} begins at ${P.time_ast} AST.\nJoin: ${site}/learn/classes\n\nManage email preferences: ${site}/settings/notifications`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'graduated': {
      const subject = 'You graduated from SVG AI Institute 🎓'
      const inner = `${h('Congratulations, graduate 🎓')}
        ${p(`Hi ${esc(P.first_name)}, you finished the program — and you built something real doing it. Your certificate is ready.`)}
        ${button('View your certificate', `${site}/certificates/${esc(P.code)}`)}
        ${p(`Verify code: <strong>${esc(P.code)}</strong> · <a href="${site}/verify" style="color:${BLUE};">verify page</a>`)}`
      const text = `Congratulations ${P.first_name}! You graduated. Certificate: ${site}/certificates/${P.code}\nVerify code: ${P.code} (${site}/verify)`
      return { subject, html: base(subject, inner, site), text }
    }
    case 'announcement': {
      const subject = String(P.title ?? 'A message from SVG AI Institute')
      const bodyHtml = mdToHtml(String(P.body ?? ''))
      const inner = `${h(esc(P.title))}${bodyHtml}${button('Open dashboard', `${site}/dashboard`)}`
      const text = `${P.title}\n\n${P.body}\n\nManage email preferences: ${site}/settings/notifications`
      return { subject, html: base(subject, inner, site), text }
    }
    default: {
      const subject = 'A message from SVG AI Institute'
      const inner = `${h(subject)}${p('You have a new update in the platform.')}${button('Open dashboard', `${site}/dashboard`)}`
      return { subject, html: base(subject, inner, site), text: `${subject}\nOpen: ${site}/dashboard` }
    }
  }
}

// Minimal, safe markdown → HTML for announcement bodies (bold, line breaks, links).
function mdToHtml(md: string): string {
  const safe = esc(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" style="color:${BLUE};">$1</a>`)
    .replace(/\n{2,}/g, '</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;">')
    .replace(/\n/g, '<br/>')
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${safe}</p>`
}
