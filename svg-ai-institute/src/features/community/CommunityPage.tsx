import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Hash, MessagesSquare, Plus, Users, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Channel, DmConversation, DmMessage, Message, Room, UserMute } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { Composer } from './Composer'
import { MessageItem } from './MessageItem'
import type { MemberLite } from './community'
import {
  dayChip,
  initials,
  loadMessages,
  loadThread,
  messageTime,
  resolveRoom,
  roomMembers,
} from './community'

type Pane = { kind: 'channel'; id: string } | { kind: 'dm'; id: string }

export function CommunityPage() {
  const { profile, role } = useAuth()
  const isStaff = role === 'admin' || role === 'instructor'
  const [room, setRoom] = useState<Room | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [members, setMembers] = useState<MemberLite[]>([])
  const [dms, setDms] = useState<{ conv: DmConversation; other: MemberLite; preview: string; at: string }[]>([])
  const [pane, setPane] = useState<Pane | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [myMute, setMyMute] = useState<UserMute | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [memberPopover, setMemberPopover] = useState<MemberLite | null>(null)
  const [newDmOpen, setNewDmOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    if (!profile) return
    const r = await resolveRoom(profile.id, isStaff)
    setRoom(r)
    if (!r) { setLoaded(true); return }
    const [{ data: chans }, mem] = await Promise.all([
      supabase.from('channels').select('*').eq('room_id', r.id).order('created_at'),
      roomMembers(r.id),
    ])
    const visibleChannels = (chans ?? []).filter((c) => isStaff || !c.archived)
    setChannels(visibleChannels)
    setMembers(mem)

    // my active mute
    const { data: mutes } = await supabase.from('user_mutes').select('*').eq('user_id', profile.id).is('lifted_at', null).gt('until_at', new Date().toISOString()).eq('room_id', r.id)
    setMyMute((mutes ?? [])[0] ?? null)

    // DM conversations
    const { data: convs } = await supabase.from('dm_conversations').select('*')
    const dmList: { conv: DmConversation; other: MemberLite; preview: string; at: string }[] = []
    for (const conv of convs ?? []) {
      const otherId = conv.user_low === profile.id ? conv.user_high : conv.user_low
      const other = mem.find((m) => m.id === otherId) ?? { id: otherId, name: 'Member', role: 'student' as const }
      const { data: last } = await supabase.from('dm_messages').select('body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      dmList.push({ conv, other, preview: last?.body ?? 'No messages yet', at: last?.created_at ?? conv.created_at })
    }
    dmList.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    setDms(dmList)

    setPane((p) => p ?? (visibleChannels[0] ? { kind: 'channel', id: visibleChannels[0].id } : null))
    setLoaded(true)
  }, [profile, isStaff])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (!room) return <Card><EmptyState icon={MessagesSquare} message="You're not part of a room community yet." /></Card>

  const activeChannel = pane?.kind === 'channel' ? channels.find((c) => c.id === pane.id) : undefined
  const activeDm = pane?.kind === 'dm' ? dms.find((d) => d.conv.id === pane.id) : undefined

  return (
    <div className="relative -mx-4 -my-6 flex h-[calc(100vh-3.5rem)] md:mx-0 md:my-0 md:h-[calc(100vh-8rem)] md:overflow-hidden md:rounded-xl md:border md:border-line">
      {toast && <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-svggold-100 px-5 py-3 text-base font-medium text-warning shadow-card">{toast}</div>}

      {/* Sidebar */}
      <aside className={`${pane && !mobileNav ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-line bg-surface-alt md:w-64`}>
        <div className="border-b border-line px-4 py-3">
          <p className="font-heading text-lg font-bold text-svgblue-500">{room.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="flex items-center justify-between px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Channels</p>
            {isStaff && <Button size="sm" variant="ghost" onClick={() => setShowMembers(true)}><Users className="h-4 w-4" /></Button>}
          </div>
          {channels.map((c) => (
            <button key={c.id} type="button" onClick={() => { setPane({ kind: 'channel', id: c.id }); setMobileNav(false) }}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-base ${pane?.kind === 'channel' && pane.id === c.id ? 'bg-svgblue-100 font-medium text-svgblue-700' : 'text-ink hover:bg-svgblue-50'}`}>
              <Hash className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="truncate">{c.name}</span>
              {c.archived && <span className="text-xs text-ink-muted">(archived)</span>}
            </button>
          ))}

          <div className="mt-4 flex items-center justify-between px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Direct messages</p>
            <Button size="sm" variant="ghost" onClick={() => setNewDmOpen(true)}><Plus className="h-4 w-4" /></Button>
          </div>
          {dms.map((d) => (
            <button key={d.conv.id} type="button" onClick={() => { setPane({ kind: 'dm', id: d.conv.id }); setMobileNav(false) }}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left ${pane?.kind === 'dm' && pane.id === d.conv.id ? 'bg-svgblue-100' : 'hover:bg-svgblue-50'}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-svgblue-100 text-xs font-semibold text-svgblue-700">{initials(d.other.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{d.other.name}</span>
                <span className="block truncate text-xs text-ink-muted">{d.preview}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main pane */}
      {pane && (
        <div className={`${mobileNav ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 flex-col bg-surface-page`}>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <button type="button" onClick={() => setMobileNav(true)} className="rounded-lg p-1 text-ink-muted hover:bg-svgblue-50 md:hidden"><ArrowLeft className="h-5 w-5" /></button>
            {activeChannel && (
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                <div>
                  <p className={`font-heading text-base font-semibold ${activeChannel.name === 'wins' ? 'text-svggold-600' : 'text-ink'}`}>{activeChannel.name}</p>
                  {activeChannel.description && <p className="text-xs text-ink-muted">{activeChannel.description}</p>}
                </div>
              </div>
            )}
            {activeDm && <p className="font-heading text-base font-semibold text-ink">{activeDm.other.name}</p>}
          </div>

          {activeChannel && (
            <ChannelPane
              key={activeChannel.id}
              channel={activeChannel}
              members={members}
              currentUserId={profile!.id}
              isStaff={isStaff}
              muted={myMute}
              onOpenMember={setMemberPopover}
              onRateLimited={() => showToast('Slow down a touch — you can post again in a moment.')}
            />
          )}
          {activeDm && (
            <DmPane
              key={activeDm.conv.id}
              conv={activeDm.conv}
              other={activeDm.other}
              currentUserId={profile!.id}
              muted={myMute}
              onRateLimited={() => showToast('Slow down a touch.')}
            />
          )}
        </div>
      )}

      {memberPopover && (
        <MemberPopover
          member={memberPopover}
          room={room}
          isStaff={isStaff}
          currentUserId={profile!.id}
          onClose={() => setMemberPopover(null)}
          onStartDm={async (otherId) => {
            const { data } = await supabase.rpc('start_dm', { p_other: otherId })
            if (data) { await load(); setPane({ kind: 'dm', id: data }); setMemberPopover(null) }
          }}
          onMuted={() => { setMemberPopover(null); showToast('Member muted.'); void load() }}
        />
      )}

      {newDmOpen && (
        <NewDmModal members={members.filter((m) => m.id !== profile!.id)} onClose={() => setNewDmOpen(false)}
          onPick={async (otherId) => {
            const { data } = await supabase.rpc('start_dm', { p_other: otherId })
            setNewDmOpen(false)
            if (data) { await load(); setPane({ kind: 'dm', id: data }) }
          }} />
      )}

      {showMembers && <MembersModal room={room} onClose={() => setShowMembers(false)} onChanged={() => void load()} />}
    </div>
  )
}

// ---------- Channel pane with realtime ----------

function ChannelPane({ channel, members, currentUserId, isStaff, muted, onOpenMember, onRateLimited }: {
  channel: Channel
  members: MemberLite[]
  currentUserId: string
  isStaff: boolean
  muted: UserMute | null
  onOpenMember: (m: MemberLite) => void
  onRateLimited: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({})
  const [thread, setThread] = useState<Message | null>(null)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const refresh = useCallback(async () => {
    const msgs = await loadMessages(channel.id)
    setMessages(msgs)
    const parentIds = msgs.map((m) => m.id)
    if (parentIds.length) {
      const { data: replies } = await supabase.from('messages').select('parent_id').in('parent_id', parentIds)
      const counts: Record<string, number> = {}
      for (const r of replies ?? []) if (r.parent_id) counts[r.parent_id] = (counts[r.parent_id] ?? 0) + 1
      setReplyCounts(counts)
    }
    setLoaded(true)
    // mark read
    await supabase.from('channel_reads').upsert({ user_id: currentUserId, channel_id: channel.id, last_read_at: new Date().toISOString() })
  }, [channel.id, currentUserId])

  useEffect(() => {
    void refresh()
    const sub = supabase
      .channel(`room-messages-${channel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [channel.id, refresh])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length])

  const send = async (body: string, mentions: string[]) => {
    const { error } = await supabase.rpc('post_message', { p_channel_id: channel.id, p_parent_id: null, p_body: body, p_mentions: mentions })
    if (error) {
      if (error.message.includes('rate_limited')) onRateLimited()
      return false
    }
    return true
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!loaded ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-base text-ink-muted">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m, i) => {
            const prevDay = i > 0 ? dayChip(messages[i - 1].created_at) : null
            const thisDay = dayChip(m.created_at)
            return (
              <div key={m.id}>
                {thisDay !== prevDay && (
                  <div className="my-3 flex items-center justify-center"><span className="rounded-full bg-surface-alt px-3 py-0.5 text-xs font-medium text-ink-muted">{thisDay}</span></div>
                )}
                <MessageItem
                  message={m}
                  author={memberById.get(m.author_id)}
                  currentUserId={currentUserId}
                  isStaff={isStaff}
                  replyCount={replyCounts[m.id]}
                  onOpenThread={() => setThread(m)}
                  onOpenMember={onOpenMember}
                  onChanged={() => void refresh()}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        members={members}
        placeholder={`Message #${channel.name}`}
        disabled={!!muted}
        disabledNote={muted && <MuteBanner mute={muted} />}
        onSend={send}
      />

      {thread && (
        <ThreadPanel
          parent={thread}
          channel={channel}
          members={members}
          memberById={memberById}
          currentUserId={currentUserId}
          isStaff={isStaff}
          muted={muted}
          onClose={() => setThread(null)}
          onRateLimited={onRateLimited}
        />
      )}
    </>
  )
}

function MuteBanner({ mute }: { mute: UserMute }) {
  return (
    <div className="rounded-xl bg-svggold-100 px-4 py-3 text-sm text-warning">
      You&apos;re muted until {messageTime(mute.until_at)}. Reason: {mute.reason}. Reach out to your instructor with questions.
    </div>
  )
}

// ---------- Thread panel ----------

function ThreadPanel({ parent, channel, members, memberById, currentUserId, isStaff, muted, onClose, onRateLimited }: {
  parent: Message
  channel: Channel
  members: MemberLite[]
  memberById: Map<string, MemberLite>
  currentUserId: string
  isStaff: boolean
  muted: UserMute | null
  onClose: () => void
  onRateLimited: () => void
}) {
  const [replies, setReplies] = useState<Message[]>([])

  const refresh = useCallback(async () => {
    setReplies(await loadThread(parent.id))
  }, [parent.id])

  useEffect(() => {
    void refresh()
    const sub = supabase.channel(`thread-${parent.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `parent_id=eq.${parent.id}` }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [parent.id, refresh])

  const send = async (body: string, mentions: string[]) => {
    const { error } = await supabase.rpc('post_message', { p_channel_id: channel.id, p_parent_id: parent.id, p_body: body, p_mentions: mentions })
    if (error) { if (error.message.includes('rate_limited')) onRateLimited(); return false }
    return true
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface-page md:inset-y-0 md:right-0 md:left-auto md:w-96 md:border-l md:border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-heading text-base font-semibold text-ink">Thread</p>
        <button type="button" aria-label="Close thread" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-svgblue-50"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="border-b border-line pb-2">
          <MessageItem message={parent} author={memberById.get(parent.author_id)} currentUserId={currentUserId} isStaff={isStaff} onChanged={refresh} />
        </div>
        {replies.map((r) => (
          <MessageItem key={r.id} message={r} author={memberById.get(r.author_id)} currentUserId={currentUserId} isStaff={isStaff} onChanged={refresh} />
        ))}
      </div>
      <Composer members={members} placeholder="Reply…" disabled={!!muted} disabledNote={muted && <MuteBanner mute={muted} />} onSend={send} />
    </div>
  )
}

// ---------- DM pane ----------

function DmPane({ conv, other, currentUserId, muted, onRateLimited }: {
  conv: DmConversation
  other: MemberLite
  currentUserId: string
  muted: UserMute | null
  onRateLimited: () => void
}) {
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const memberById = useMemo(() => new Map([[other.id, other]]), [other])

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('dm_messages').select('*').eq('conversation_id', conv.id).order('created_at')
    setMessages((data ?? []) as DmMessage[])
    setLoaded(true)
    await supabase.from('dm_reads').upsert({ user_id: currentUserId, conversation_id: conv.id, last_read_at: new Date().toISOString() })
  }, [conv.id, currentUserId])

  useEffect(() => {
    void refresh()
    const sub = supabase.channel(`dm-${conv.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conv.id}` }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [conv.id, refresh])

  useEffect(() => { bottomRef.current?.scrollIntoView() }, [messages.length])

  const send = async (body: string) => {
    const { error } = await supabase.rpc('post_dm', { p_conversation_id: conv.id, p_body: body })
    if (error) { if (error.message.includes('rate_limited')) onRateLimited(); return false }
    return true
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!loaded ? <div className="flex justify-center py-8"><Spinner /></div> : messages.map((m) => (
          <MessageItem
            key={m.id}
            message={{ ...m, channel_id: '', parent_id: null, deleted_by: null } as Message}
            author={m.author_id === currentUserId ? { id: currentUserId, name: 'You', role: 'student' } : memberById.get(m.author_id)}
            currentUserId={currentUserId}
            isStaff={false}
            onChanged={refresh}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <Composer placeholder={`Message ${other.name}`} disabled={!!muted} disabledNote={muted && <MuteBanner mute={muted} />} onSend={(b) => send(b)} />
    </>
  )
}

// ---------- Member popover + modals ----------

function MemberPopover({ member, room, isStaff, currentUserId, onClose, onStartDm, onMuted }: {
  member: MemberLite
  room: Room
  isStaff: boolean
  currentUserId: string
  onClose: () => void
  onStartDm: (id: string) => void
  onMuted: () => void
}) {
  const [muteMode, setMuteMode] = useState(false)
  const [hours, setHours] = useState(24)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isStaffMember = member.role === 'admin' || member.role === 'instructor'

  const mute = async () => {
    if (reason.trim().length < 5) return setError('A reason (5+ chars) is required.')
    const { error: err } = await supabase.rpc('mute_user', { p_user_id: member.id, p_room_id: room.id, p_hours: hours, p_reason: reason.trim() })
    if (err) return setError(err.message.includes('cannot_mute_staff') ? 'You cannot mute staff.' : 'Could not mute.')
    onMuted()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-svgblue-900/30 p-4" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-svgblue-100 text-base font-semibold text-svgblue-700">{initials(member.name)}</span>
          <div>
            <p className="font-heading text-lg font-semibold text-ink">{member.name}</p>
            {isStaffMember && <Badge variant="gold">{member.role === 'admin' ? 'Admin' : 'Instructor'}</Badge>}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {member.id !== currentUserId && <Button onClick={() => onStartDm(member.id)}>Message</Button>}
          {isStaff && !isStaffMember && member.id !== currentUserId && !muteMode && (
            <Button variant="ghost" className="text-danger" onClick={() => setMuteMode(true)}>Mute member</Button>
          )}
          {muteMode && (
            <div className="flex flex-col gap-2 rounded-xl bg-surface-alt p-3">
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-xl border border-line bg-white px-3 py-2 text-base text-ink">
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="rounded-xl border border-line bg-white px-3 py-2 text-base text-ink" />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button variant="ghost" className="text-danger" onClick={() => void mute()}>Confirm mute</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NewDmModal({ members, onClose, onPick }: { members: MemberLite[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const filtered = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-svgblue-900/30 p-4" onClick={onClose} role="presentation">
      <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-xl bg-white shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-4 py-3"><p className="font-heading text-lg font-semibold text-ink">New message</p></div>
        <div className="p-3"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink" /></div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-svgblue-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-svgblue-100 text-xs font-semibold text-svgblue-700">{initials(m.name)}</span>
              <span className="text-base text-ink">{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MembersModal({ room, onClose, onChanged }: { room: Room; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<{ member: MemberLite; count: number; mute: UserMute | null }[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const mem = await roomMembers(room.id)
    const { data: msgCounts } = await supabase.from('messages').select('author_id')
    const counts: Record<string, number> = {}
    for (const m of msgCounts ?? []) counts[m.author_id] = (counts[m.author_id] ?? 0) + 1
    const { data: mutes } = await supabase.from('user_mutes').select('*').eq('room_id', room.id).is('lifted_at', null).gt('until_at', new Date().toISOString())
    const muteByUser = new Map((mutes ?? []).map((m) => [m.user_id, m as UserMute]))
    setRows(mem.map((member) => ({ member, count: counts[member.id] ?? 0, mute: muteByUser.get(member.id) ?? null })))
    setLoaded(true)
  }, [room.id])

  useEffect(() => { void load() }, [load])

  const unmute = async (muteId: string) => {
    await supabase.rpc('unmute_user', { p_mute_id: muteId })
    void load()
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-svgblue-900/30 p-4" onClick={onClose} role="presentation">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-heading text-lg font-semibold text-ink">Members</p>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-svgblue-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!loaded ? <div className="flex justify-center py-6"><Spinner /></div> : rows.map(({ member, count, mute }) => (
            <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-svgblue-50">
              <div>
                <p className="text-base font-medium text-ink">{member.name}</p>
                <p className="text-xs text-ink-muted">{member.role}{member.cohort ? ` · ${member.cohort}` : ''} · {count} messages</p>
              </div>
              {mute && (
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Muted</Badge>
                  <Button size="sm" variant="ghost" onClick={() => void unmute(mute.id)}>Unmute</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
