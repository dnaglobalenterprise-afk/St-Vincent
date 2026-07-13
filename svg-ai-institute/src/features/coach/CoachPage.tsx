import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { CoachConversation, CoachMessage } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { resolveRoom } from '../community/community'
import {
  DAILY_CAP,
  MAX_CHARS,
  STARTERS,
  deleteConversation,
  loadConversations,
  loadMessages,
  messagesToday,
  renameConversation,
  streamCoach,
} from './coach'

type UiMessage = CoachMessage & { streaming?: boolean; failed?: boolean }

export function CoachPage() {
  const { profile, role } = useAuth()
  const isStaff = role === 'admin' || role === 'instructor'
  const [params, setParams] = useSearchParams()
  const lessonId = params.get('lesson')
  const lessonTitleParam = params.get('lessonTitle')

  const [roomId, setRoomId] = useState<string | null>(null)
  const [hasRoom, setHasRoom] = useState<boolean | null>(null)
  const [conversations, setConversations] = useState<CoachConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [used, setUsed] = useState(0)
  const [mobileList, setMobileList] = useState(false)
  const [lessonChip, setLessonChip] = useState<string | null>(lessonTitleParam)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Resolve room + load conversation list
  useEffect(() => {
    if (!profile) return
    resolveRoom(profile.id, isStaff).then(async (room) => {
      setHasRoom(!!room)
      setRoomId(room?.id ?? null)
      if (!room) return
      const [convs, todayCount] = await Promise.all([loadConversations(profile.id), messagesToday(profile.id)])
      setConversations(convs)
      setUsed(todayCount)
      // Lesson launcher always opens a fresh conversation; otherwise pick newest.
      if (!lessonId && convs[0]) setActiveId(convs[0].id)
    })
  }, [profile, isStaff, lessonId])

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    loadMessages(activeId).then((m) => setMessages(m))
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const remaining = Math.max(0, DAILY_CAP - used)
  const capReached = remaining === 0

  const startNew = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    setLessonChip(lessonTitleParam)
    setMobileList(false)
  }, [lessonTitleParam])

  const send = useCallback(
    (text: string) => {
      const body = text.trim()
      if (!body || body.length > MAX_CHARS || streaming || capReached || !profile) return
      const now = new Date().toISOString()
      const userMsg: UiMessage = { id: `local-${now}`, conversation_id: activeId ?? '', role: 'user', content: body, input_tokens: null, output_tokens: null, created_at: now }
      const assistantMsg: UiMessage = { id: `stream-${now}`, conversation_id: activeId ?? '', role: 'assistant', content: '', input_tokens: null, output_tokens: null, created_at: now, streaming: true }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setDraft('')
      setStreaming(true)
      setUsed((u) => u + 1)

      let convId = activeId
      abortRef.current = streamCoach(
        { conversationId: activeId, message: body, lessonId: lessonChip ? lessonId : null, roomId },
        {
          onMeta: (id) => {
            convId = id
            if (!activeId) setActiveId(id)
          },
          onDelta: (delta) => {
            setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, content: m.content + delta } : m)))
          },
          onDone: () => {
            setStreaming(false)
            setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
            if (profile) void loadConversations(profile.id).then(setConversations)
          },
          onError: (msg) => {
            setStreaming(false)
            if (msg === '__DAILY_CAP__') {
              setUsed(DAILY_CAP)
              setMessages((prev) => prev.filter((m) => !m.streaming))
              return
            }
            setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false, failed: true, content: m.content } : m)))
          },
        },
      )
      void convId
    },
    [activeId, streaming, capReached, profile, lessonChip, lessonId, roomId],
  )

  const stop = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
  }

  if (hasRoom === null) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (hasRoom === false) {
    return <Card><EmptyState icon={Sparkles} message="Your AI coach unlocks when you join a cohort." /></Card>
  }

  return (
    <div className="relative -mx-4 -my-6 flex h-[calc(100vh-3.5rem)] md:mx-0 md:my-0 md:h-[calc(100vh-8rem)] md:overflow-hidden md:rounded-xl md:border md:border-line">
      {/* Conversation list */}
      <aside className={`${activeId !== null && !mobileList && messages.length ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-line bg-surface-alt md:w-72`}>
        <div className="border-b border-line px-4 py-3">
          <Button className="w-full" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" /> New conversation</Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-ink-muted">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conv={c}
                active={c.id === activeId}
                onOpen={() => { setActiveId(c.id); setMobileList(false); setLessonChip(null) }}
                onRenamed={(title) => setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, title } : x)))}
                onDeleted={() => {
                  setConversations((prev) => prev.filter((x) => x.id !== c.id))
                  if (activeId === c.id) { setActiveId(null); setMessages([]) }
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* Chat pane */}
      <div className={`${mobileList ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 flex-col bg-surface-page`}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          {(activeId || messages.length > 0) && (
            <button type="button" onClick={() => setMobileList(true)} className="rounded-lg p-1 text-ink-muted hover:bg-svgblue-50 md:hidden"><ArrowLeft className="h-5 w-5" /></button>
          )}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-svggold-500"><Sparkles className="h-5 w-5 text-ink" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold text-ink">Vincy — your AI study coach</p>
            <p className="truncate text-xs text-ink-muted">Trained on your program. Available always.</p>
          </div>
          {remaining <= 5 && !capReached && (
            <span className="shrink-0 rounded-full bg-svggold-100 px-3 py-1 text-xs font-medium text-warning">{remaining} coach {remaining === 1 ? 'message' : 'messages'} left today</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <WelcomeState onPick={send} disabled={capReached} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m) => <MessageBubble key={m.id} message={m} onRetry={() => send(lastUserText(messages))} />)}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer / cap state */}
        {capReached ? (
          <div className="border-t border-line px-4 py-4">
            <Card className="border-svggold-500 bg-svggold-100">
              <p className="text-base text-ink">You&apos;ve used today&apos;s coach messages. They reset at midnight AST. Your instructors and <span className="font-medium">#help</span> are always there.</p>
            </Card>
          </div>
        ) : (
          <Composer
            draft={draft}
            setDraft={setDraft}
            streaming={streaming}
            lessonChip={lessonChip}
            onDismissLesson={() => { setLessonChip(null); setParams({}, { replace: true }) }}
            onSend={() => send(draft)}
            onStop={stop}
          />
        )}
      </div>
    </div>
  )
}

function lastUserText(messages: UiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i].content
  return ''
}

function WelcomeState({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-svggold-500"><Sparkles className="h-8 w-8 text-ink" aria-hidden="true" /></span>
      <div>
        <p className="font-heading text-2xl font-bold text-ink">Ask me anything about the program</p>
        <p className="mt-2 text-base text-ink-muted">A concept from class, an error in your Make scenario, how a prompt could be better. I won&apos;t do your assignments for you, but I&apos;ll get you unstuck.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {STARTERS.map((s) => (
          <button key={s} type="button" disabled={disabled} onClick={() => onPick(s)} className="rounded-xl border border-line bg-surface-alt px-4 py-3 text-left text-base text-ink hover:border-svgblue-500 hover:bg-svgblue-50 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message, onRetry }: { message: UiMessage; onRetry: () => void }) {
  const own = message.role === 'user'
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-base ${own ? 'bg-svgblue-50 text-ink' : 'border border-line bg-white text-ink'}`}>
        {own ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : message.content ? (
          <div className="coach-markdown break-words">
            <ReactMarkdown
              components={{
                a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="font-medium text-svgblue-500 underline" />,
                code: ({ ...props }) => <code {...props} className="rounded bg-surface-alt px-1 py-0.5 text-sm" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <TypingDots />
        )}
        {message.failed && (
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-danger underline">Response failed — retry</button>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Vincy is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-svggold-500" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}

function Composer({
  draft, setDraft, streaming, lessonChip, onDismissLesson, onSend, onStop,
}: {
  draft: string
  setDraft: (v: string) => void
  streaming: boolean
  lessonChip: string | null
  onDismissLesson: () => void
  onSend: () => void
  onStop: () => void
}) {
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {lessonChip && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-svggold-100 px-3 py-1 text-sm text-warning">
            Talking about: {lessonChip}
            <button type="button" aria-label="Dismiss lesson context" onClick={onDismissLesson}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!streaming) onSend() } }}
            placeholder="Ask Vincy…"
            rows={1}
            maxLength={MAX_CHARS}
            disabled={streaming}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-white px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500 disabled:bg-surface-alt"
          />
          {streaming ? (
            <Button variant="secondary" aria-label="Stop generating" onClick={onStop} className="shrink-0"><Square className="h-4 w-4" aria-hidden="true" /></Button>
          ) : (
            <Button aria-label="Send" onClick={onSend} disabled={draft.trim().length < 1} className="shrink-0"><Send className="h-4 w-4" aria-hidden="true" /></Button>
          )}
        </div>
        {draft.length > 1800 && (
          <p className={`mt-1 text-right text-xs ${draft.length > MAX_CHARS ? 'text-danger' : 'text-ink-muted'}`}>{draft.length} / {MAX_CHARS}</p>
        )}
      </div>
    </div>
  )
}

function ConversationRow({
  conv, active, onOpen, onRenamed, onDeleted,
}: {
  conv: CoachConversation
  active: boolean
  onOpen: () => void
  onRenamed: (title: string) => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(conv.title ?? 'New conversation')

  const save = async () => {
    const t = title.trim()
    if (t.length >= 1) { await renameConversation(conv.id, t); onRenamed(t) }
    setEditing(false)
  }
  const remove = async () => {
    if (!confirm('Delete this conversation?')) return
    await deleteConversation(conv.id)
    onDeleted()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save() }} onBlur={() => void save()}
          className="flex-1 rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
      </div>
    )
  }

  return (
    <div className={`group flex items-center gap-1 rounded-xl px-2 ${active ? 'bg-svgblue-100' : 'hover:bg-svgblue-50'}`}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-2 text-left">
        <span className={`block truncate text-sm ${active ? 'font-medium text-svgblue-700' : 'text-ink'}`}>{conv.title ?? 'New conversation'}</span>
      </button>
      <button type="button" aria-label="Rename" onClick={() => setEditing(true)} className="rounded p-1 text-ink-muted opacity-0 hover:bg-white group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label="Delete" onClick={() => void remove()} className="rounded p-1 text-ink-muted opacity-0 hover:bg-white hover:text-danger group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  )
}
