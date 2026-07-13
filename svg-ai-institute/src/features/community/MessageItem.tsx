import { useState } from 'react'
import { MessagesSquare, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import type { Message } from '../../lib/types'
import type { MemberLite } from './community'
import { initials, messageTime, renderBody } from './community'

const EDIT_WINDOW_MS = 15 * 60 * 1000

export function MessageItem({
  message,
  author,
  currentUserId,
  isStaff,
  replyCount,
  onOpenThread,
  onOpenMember,
  onChanged,
}: {
  message: Message
  author?: MemberLite
  currentUserId: string
  isStaff: boolean
  replyCount?: number
  onOpenThread?: () => void
  onOpenMember?: (m: MemberLite) => void
  onChanged: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const own = message.author_id === currentUserId
  const canEdit = own && Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS
  const deleted = !!message.deleted_at

  const save = async () => {
    if (draft.trim().length < 1 || draft.length > 2000) return
    const { error } = await supabase.rpc('edit_message', { p_message_id: message.id, p_body: draft.trim() })
    if (!error) {
      setEditing(false)
      onChanged()
    }
  }

  const del = async () => {
    if (!confirm('Remove this message?')) return
    await supabase.rpc('delete_message', { p_message_id: message.id })
    setMenuOpen(false)
    onChanged()
  }

  if (deleted) {
    return (
      <div className="px-1 py-1.5">
        <p className="text-sm italic text-ink-muted">
          {message.deleted_by === currentUserId && own ? 'You removed this' : 'Message removed'}
          {isStaff && message.deleted_by && message.deleted_by !== message.author_id ? ' (by staff)' : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="group flex gap-3 px-1 py-1.5">
      <button
        type="button"
        onClick={() => author && onOpenMember?.(author)}
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-svgblue-100 text-sm font-semibold text-svgblue-700"
      >
        {author ? initials(author.name) : '?'}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => author && onOpenMember?.(author)} className="font-heading text-sm font-semibold text-ink hover:underline">
            {author?.name ?? 'Member'}
          </button>
          {author && (author.role === 'admin' || author.role === 'instructor') && (
            <Badge variant="gold">{author.role === 'admin' ? 'Admin' : 'Instructor'}</Badge>
          )}
          <span className="text-xs text-ink-muted">{messageTime(message.created_at)}</span>
          {message.edited_at && <span className="text-xs text-ink-muted">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(message.body) }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className={`mt-0.5 inline-block max-w-full rounded-xl px-3 py-2 text-base ${own ? 'bg-svgblue-50' : 'border border-line bg-white'}`}>
            <p className="whitespace-pre-wrap break-words text-ink">
              {renderBody(message.body).map((part, i) =>
                part.url ? (
                  <a key={i} href={part.url} target="_blank" rel="noopener noreferrer" className="font-medium text-svgblue-500 underline">{part.text}</a>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </p>
          </div>
        )}

        {/* Thread indicator */}
        {onOpenThread && (replyCount ?? 0) > 0 && (
          <button type="button" onClick={onOpenThread} className="mt-1 flex items-center gap-1 text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'} →
          </button>
        )}
      </div>

      {/* Actions */}
      {(own || isStaff || onOpenThread) && !editing && (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Message actions"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-1 text-ink-muted opacity-0 hover:bg-svgblue-50 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 flex flex-col rounded-xl border border-line bg-white py-1 shadow-card" onMouseLeave={() => setMenuOpen(false)}>
              {onOpenThread && (
                <button type="button" onClick={() => { setMenuOpen(false); onOpenThread() }} className="flex items-center gap-2 px-4 py-1.5 text-left text-sm text-ink hover:bg-svgblue-50">
                  <MessagesSquare className="h-4 w-4" /> Reply in thread
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={() => { setMenuOpen(false); setEditing(true) }} className="flex items-center gap-2 px-4 py-1.5 text-left text-sm text-ink hover:bg-svgblue-50">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              {(own || isStaff) && (
                <button type="button" onClick={() => void del()} className="flex items-center gap-2 px-4 py-1.5 text-left text-sm text-danger hover:bg-svggold-100">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
