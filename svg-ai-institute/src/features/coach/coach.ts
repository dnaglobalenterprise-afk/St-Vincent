import { supabase } from '../../lib/supabase'
import type { CoachConversation, CoachMessage } from '../../lib/types'

export const DAILY_CAP = 30
export const MAX_CHARS = 2000

export const STARTERS = [
  "Explain this week's big idea like I'm brand new",
  "Here's my error message…",
  'Give me a hint, not the answer',
]

export async function loadConversations(userId: string): Promise<CoachConversation[]> {
  const { data } = await supabase
    .from('coach_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return data ?? []
}

export async function loadMessages(conversationId: string): Promise<CoachMessage[]> {
  const { data } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at')
  return data ?? []
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await supabase.from('coach_conversations').update({ title: title.slice(0, 80) }).eq('id', id)
}

export async function deleteConversation(id: string): Promise<void> {
  await supabase.from('coach_conversations').delete().eq('id', id)
}

/** How many coach messages the user has spent today (AST). */
export async function messagesToday(userId: string): Promise<number> {
  const { data } = await supabase.rpc('coach_messages_today', { p_user_id: userId })
  return typeof data === 'number' ? data : 0
}

export interface StreamHandlers {
  onMeta?: (conversationId: string) => void
  onDelta: (text: string) => void
  onDone: (conversationId: string) => void
  onError: (message: string) => void
}

/**
 * Call the coach-chat Edge Function and consume its SSE stream. The function
 * holds the Anthropic key and does all context assembly + guardrails; the
 * client only sends the message and renders tokens as they arrive.
 * Returns an AbortController so the caller can stop generation.
 */
export function streamCoach(
  input: { conversationId: string | null; message: string; lessonId: string | null; roomId?: string | null },
  handlers: StreamHandlers,
): AbortController {
  const controller = new AbortController()
  void (async () => {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-chat`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: input.conversationId,
          message: input.message,
          lesson_id: input.lessonId,
          room_id: input.roomId ?? null,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let msg = 'The coach could not respond.'
        try {
          const body = await res.json()
          if (body.code === 'daily_cap') msg = '__DAILY_CAP__'
          else if (body.error) msg = body.error
        } catch { /* */ }
        handlers.onError(msg)
        return
      }
      if (!res.body) {
        handlers.onError('No response stream.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          const lines = ev.split('\n')
          const evtLine = lines.find((l) => l.startsWith('event:'))
          const dataLine = lines.find((l) => l.startsWith('data:'))
          if (!evtLine || !dataLine) continue
          const type = evtLine.slice(6).trim()
          let data: Record<string, unknown> = {}
          try {
            data = JSON.parse(dataLine.slice(5).trim())
          } catch { /* */ }
          if (type === 'meta') handlers.onMeta?.(String(data.conversation_id))
          else if (type === 'delta') handlers.onDelta(String(data.text ?? ''))
          else if (type === 'done') handlers.onDone(String(data.conversation_id))
          else if (type === 'error') handlers.onError(String(data.message ?? 'Interrupted.'))
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      handlers.onError('Network error. Your message was saved — try again.')
    }
  })()
  return controller
}
