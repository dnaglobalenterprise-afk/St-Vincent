import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { MemberLite } from './community'

const MAX = 2000

export function Composer({
  members,
  placeholder,
  disabled,
  disabledNote,
  onSend,
}: {
  members?: MemberLite[]
  placeholder: string
  disabled?: boolean
  disabledNote?: React.ReactNode
  onSend: (body: string, mentions: string[]) => Promise<boolean>
}) {
  const [body, setBody] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map()) // name -> id
  const [sending, setSending] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const matches = mentionQuery !== null && members
    ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : []

  const onChange = (value: string) => {
    setBody(value)
    if (members) {
      const m = value.slice(0, taRef.current?.selectionStart ?? value.length).match(/@([\w ]*)$/)
      setMentionQuery(m ? m[1] : null)
    }
  }

  const pickMention = (member: MemberLite) => {
    setBody((b) => b.replace(/@([\w ]*)$/, `@${member.name} `))
    setMentioned((prev) => new Map(prev).set(member.name, member.id))
    setMentionQuery(null)
    taRef.current?.focus()
  }

  const send = async () => {
    const trimmed = body.trim()
    if (trimmed.length < 1 || trimmed.length > MAX || sending) return
    // resolve mentions present in the final text
    const ids: string[] = []
    for (const [name, id] of mentioned) if (body.includes(`@${name}`)) ids.push(id)
    setSending(true)
    const ok = await onSend(trimmed, ids)
    setSending(false)
    if (ok) {
      setBody('')
      setMentioned(new Map())
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault()
      void send()
    }
  }

  if (disabled) {
    return <div className="border-t border-line px-4 py-3">{disabledNote}</div>
  }

  return (
    <div className="relative border-t border-line px-4 py-3">
      {matches.length > 0 && (
        <div className="absolute bottom-full left-4 mb-1 flex w-64 flex-col rounded-xl border border-line bg-white py-1 shadow-card">
          {matches.map((m) => (
            <button key={m.id} type="button" onClick={() => pickMention(m)} className="px-4 py-1.5 text-left text-sm text-ink hover:bg-svgblue-50">
              {m.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={MAX}
          className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-white px-4 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
        />
        <Button aria-label="Send" loading={sending} onClick={() => void send()} className="shrink-0">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {body.length > 1800 && (
        <p className={`mt-1 text-right text-xs ${body.length > MAX ? 'text-danger' : 'text-ink-muted'}`}>{body.length} / {MAX}</p>
      )}
    </div>
  )
}
