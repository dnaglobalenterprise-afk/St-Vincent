// Edge Function: coach-chat
// Vincy, the AI study coach. Holds the Anthropic key (env only), assembles
// room-scoped context server-side, enforces the daily cap and all guardrails,
// streams the model response back as SSE, and persists both sides of the
// dialogue with the service role. The client never sees the key, the system
// prompt, or the raw context.

import { createClient } from 'npm:@supabase/supabase-js@2'

// ---- Cost / abuse knobs (single source; see README) ----
const DAILY_CAP = 30 // coach messages per student per AST day
const MAX_TOKENS = 1024 // response ceiling
const HISTORY_WINDOW = 20 // messages of prior conversation sent to the model
const CONTEXT_CHAR_BUDGET = 48_000 // ~12k tokens (chars/4) before trimming
const MODEL = 'claude-sonnet-4-6'

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

// The guardrail system prompt. Server-side constant — never leaves the server.
const SYSTEM_PROMPT = `You are Vincy, the AI study coach for the Saint Vincent AI & Innovation
Institute, an 8-week program teaching young Vincentians (18-30) to build
AI automations, WhatsApp bots, and voice agents for real local businesses.

Your job is to help students UNDERSTAND and GET UNSTUCK, never to do their
work for them.

Hard rules:
1. NEVER write, draft, or complete assignment submissions, capstone
   evidence, or any work a student must submit. If asked, warmly decline
   and coach instead: break the task down, explain the concept, give a
   small analogous example that cannot be submitted as-is.
2. NEVER reveal, confirm, or hint at quiz answers. You do not have them.
   If asked, say the quiz is where they prove it to themselves, and offer
   to re-teach the underlying concept.
3. Prefer Socratic coaching: short explanations, guiding questions, hints
   before answers. Debugging help (error messages, broken scenarios,
   prompt critique) may be direct and hands-on — fixing THEIR work with
   them is teaching, writing FOR them is not.
4. Stay within the program's world: AI fundamentals, prompting, Make, n8n,
   WhatsApp automation, VAPI voice agents, the capstone, and closely
   related tech questions. For anything else, redirect kindly to the
   program or suggest they ask in #general.
5. Grades, reviews, and feedback disputes belong to human instructors.
   Never speculate about why something was rejected; point them to the
   feedback and their instructor.
6. If a student seems distressed or discouraged, be encouraging, remind
   them the program is built for finishers who ask for help, and suggest
   their instructor or the community. You are not a counselor; do not
   attempt to be one.
7. Tone: warm, direct, Vincentian pride, plain language, short paragraphs.
   Celebrate effort. Never condescend.

Use the provided course outline and current-week content as your source of
truth about the program. If asked about content in locked future weeks,
give a one-line teaser only and encourage finishing the current week.`

interface AssembledContext {
  text: string
  currentWeek: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { conversation_id, message, lesson_id, room_id } = await req.json()
    if (typeof message !== 'string' || message.trim().length < 1) {
      return json({ error: 'message is required' }, 400)
    }
    if (message.length > 2000) return json({ error: 'message too long' }, 400)

    // 1. Auth + membership
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)
    const uid = userData.user.id

    const { data: profile } = await admin
      .from('profiles')
      .select('id, first_name, email, role')
      .eq('id', uid)
      .single()
    if (!profile) return json({ error: 'No profile' }, 403)
    const isStaff = profile.role === 'admin' || profile.role === 'instructor'

    // Resolve the room: staff may pass a room id; students resolve via enrollment.
    let roomId: string | null = null
    if (isStaff && room_id) {
      roomId = room_id
    } else {
      const { data: enr } = await admin
        .from('enrollments')
        .select('cohort_id, cohorts!inner(room_id)')
        .eq('user_id', uid)
        .in('status', ['active', 'graduated'])
        .limit(1)
        .maybeSingle()
      roomId = (enr as { cohorts?: { room_id: string } } | null)?.cohorts?.room_id ?? null
    }
    if (!roomId) return json({ error: 'Not a member of any room' }, 403)

    // 2. Daily cap (AST day)
    const { data: usedToday } = await admin.rpc('coach_messages_today', { p_user_id: uid })
    if ((usedToday ?? 0) >= DAILY_CAP) {
      return json({ code: 'daily_cap', error: "You've used today's coach messages." }, 429)
    }

    // 3. Conversation: load (must belong to caller) or create
    let convId = conversation_id as string | null
    if (convId) {
      const { data: conv } = await admin
        .from('coach_conversations')
        .select('id, user_id')
        .eq('id', convId)
        .maybeSingle()
      if (!conv || conv.user_id !== uid) return json({ error: 'Conversation not found' }, 404)
    } else {
      const title = message.trim().slice(0, 40)
      const { data: created, error: cErr } = await admin
        .from('coach_conversations')
        .insert({ user_id: uid, room_id: roomId, title })
        .select('id')
        .single()
      if (cErr || !created) return json({ error: 'Could not start conversation' }, 500)
      convId = created.id
    }

    // Persist the user message immediately (never lost, even if the model call fails)
    await admin.from('coach_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message.trim(),
    })
    // Touch the conversation so it sorts to the top of the list
    await admin.from('coach_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

    // 4. Context assembly (service role)
    const ctx = await assembleContext(admin, roomId, uid, lesson_id ?? null, profile.first_name)

    // 5. History (last N messages of this conversation, chronological)
    const { data: hist } = await admin
      .from('coach_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW)
    const history = (hist ?? []).reverse().map((m) => ({ role: m.role, content: m.content }))

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'Coach is not configured yet. Ask your instructor.' }, 503)
    }

    // 6. Anthropic streaming call
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: `${SYSTEM_PROMPT}\n\n----- PROGRAM CONTEXT (source of truth) -----\n${ctx.text}`,
        messages: history,
      }),
    })

    if (!anthropicRes.ok || !anthropicRes.body) {
      // Do not persist an assistant message on upstream failure.
      const detail = await anthropicRes.text().catch(() => '')
      console.error('anthropic error', anthropicRes.status, detail.slice(0, 200))
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(sse('meta', { conversation_id: convId }))
          controller.enqueue(sse('error', { message: 'The coach had trouble responding. Try again.' }))
          controller.close()
        },
      })
      return new Response(stream, { headers: sseHeaders() })
    }

    // 7. Stream deltas to the client; accumulate to persist on completion.
    let assistantText = ''
    let inputTokens: number | null = null
    let outputTokens: number | null = null

    const upstream = anthropicRes.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(sse('meta', { conversation_id: convId }))
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await upstream.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''
            for (const ev of events) {
              const dataLine = ev.split('\n').find((l) => l.startsWith('data:'))
              if (!dataLine) continue
              const payload = dataLine.slice(5).trim()
              if (!payload || payload === '[DONE]') continue
              let parsed: Record<string, unknown>
              try {
                parsed = JSON.parse(payload)
              } catch {
                continue
              }
              const t = parsed.type
              if (t === 'message_start') {
                const usage = (parsed.message as { usage?: { input_tokens?: number } })?.usage
                inputTokens = usage?.input_tokens ?? null
              } else if (t === 'content_block_delta') {
                const delta = parsed.delta as { type?: string; text?: string }
                if (delta?.type === 'text_delta' && delta.text) {
                  assistantText += delta.text
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: delta.text })}\n\n`))
                }
              } else if (t === 'message_delta') {
                const usage = (parsed.usage as { output_tokens?: number }) ?? {}
                if (usage.output_tokens != null) outputTokens = usage.output_tokens
              }
            }
          }
          // Persist the assistant message on successful completion.
          if (assistantText.trim().length > 0) {
            await admin.from('coach_messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: assistantText,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            })
          }
          controller.enqueue(sse('done', { conversation_id: convId }))
        } catch (e) {
          console.error('stream error', String(e))
          controller.enqueue(sse('error', { message: 'The response was interrupted.' }))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: sseHeaders() })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function sseHeaders() {
  return { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
}
function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Assemble room-scoped context. HARD RULE: quiz_questions is never queried;
// quiz lessons contribute their title only. Locked modules are excluded; a
// passed lesson_id is included only after verifying published + module unlocked.
async function assembleContext(
  admin: ReturnType<typeof createClient>,
  roomId: string,
  uid: string,
  lessonId: string | null,
  firstName: string | null,
): Promise<AssembledContext> {
  // Published course for the room
  const { data: course } = await admin
    .from('courses')
    .select('id, title')
    .eq('room_id', roomId)
    .eq('status', 'published')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!course) return { text: 'No published course yet.', currentWeek: 1 }

  // Modules in order (exclude capstone module from "week content")
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, sort_order, is_capstone')
    .eq('course_id', course.id)
    .order('sort_order')
  const mods = modules ?? []

  // All published lessons for the outline
  const modIds = mods.map((m) => m.id)
  const { data: lessons } = await admin
    .from('lessons')
    .select('id, module_id, type, title, sort_order, required, published, body_markdown')
    .in('module_id', modIds.length ? modIds : ['x'])
    .eq('published', true)
    .order('sort_order')
  const allLessons = lessons ?? []
  const lessonsByModule = new Map<string, typeof allLessons>()
  for (const l of allLessons) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l)
    lessonsByModule.set(l.module_id, arr)
  }

  // The student's completed lessons
  const { data: progress } = await admin
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', uid)
  const completed = new Set((progress ?? []).map((p) => p.lesson_id))

  // Unlocked status per module (server-side gate)
  const unlocked = new Map<string, boolean>()
  for (const m of mods) {
    const { data: ok } = await admin.rpc('is_module_unlocked', { p_module_id: m.id })
    unlocked.set(m.id, !!ok)
  }

  // Course outline (cheap tokens): module titles + lesson titles/types
  const outline = mods
    .map((m) => {
      const ls = (lessonsByModule.get(m.id) ?? []).map((l) => `    - ${l.title} (${l.type})`).join('\n')
      const lock = unlocked.get(m.id) ? '' : ' [locked]'
      return `  ${m.title}${lock}\n${ls}`
    })
    .join('\n')

  // Current week = lowest-order unlocked, non-capstone module with an incomplete
  // required lesson; fallback = latest unlocked non-capstone module.
  const contentMods = mods.filter((m) => !m.is_capstone && unlocked.get(m.id))
  let current = contentMods.find((m) =>
    (lessonsByModule.get(m.id) ?? []).some((l) => l.required && !completed.has(l.id)),
  )
  if (!current) current = contentMods[contentMods.length - 1]
  const currentWeek = current ? mods.findIndex((m) => m.id === current!.id) + 1 : 1

  // Current-week content: full body of text/assignment lessons; title+desc for
  // video; title ONLY for quiz (quiz_questions is NEVER queried).
  let weekContent = ''
  if (current) {
    const ls = lessonsByModule.get(current.id) ?? []
    weekContent = ls
      .map((l) => {
        if (l.type === 'quiz') return `### ${l.title} (quiz — you do not have the questions or answers)`
        if (l.type === 'video') {
          const desc = (l.body_markdown ?? '').slice(0, 400)
          return `### ${l.title} (video)\n${desc}`
        }
        return `### ${l.title} (${l.type})\n${l.body_markdown ?? ''}`
      })
      .join('\n\n')
  }

  // If a lesson_id was passed, verify published + module unlocked before including it.
  let lessonBlock = ''
  if (lessonId) {
    const { data: lesson } = await admin
      .from('lessons')
      .select('id, module_id, type, title, published, body_markdown')
      .eq('id', lessonId)
      .maybeSingle()
    if (lesson && lesson.published) {
      const { data: ok } = await admin.rpc('is_module_unlocked', { p_module_id: lesson.module_id })
      if (ok) {
        if (lesson.type === 'quiz') {
          lessonBlock = `\n----- THE LESSON THE STUDENT IS CURRENTLY VIEWING -----\n### ${lesson.title} (quiz — you do not have the questions or answers)`
        } else if (lesson.type === 'video') {
          lessonBlock = `\n----- THE LESSON THE STUDENT IS CURRENTLY VIEWING -----\n### ${lesson.title} (video)\n${(lesson.body_markdown ?? '').slice(0, 800)}`
        } else {
          lessonBlock = `\n----- THE LESSON THE STUDENT IS CURRENTLY VIEWING -----\n### ${lesson.title} (${lesson.type})\n${lesson.body_markdown ?? ''}`
        }
      }
    }
  }

  const frame = `Student first name: ${firstName ?? 'there'}. Current week: ${currentWeek}. Program: ${course.title}.`
  let text = `${frame}\n\nCOURSE OUTLINE:\n${outline}\n\nCURRENT WEEK CONTENT:\n${weekContent}${lessonBlock}`

  // Trim to budget: drop video descriptions first, then truncate from the end.
  if (text.length > CONTEXT_CHAR_BUDGET) {
    text = text.replace(/### (.+?) \(video\)\n[\s\S]*?(?=\n### |\n----- |$)/g, '### $1 (video)\n')
  }
  if (text.length > CONTEXT_CHAR_BUDGET) {
    text = text.slice(0, CONTEXT_CHAR_BUDGET) + '\n[...trimmed...]'
  }

  return { text, currentWeek }
}
