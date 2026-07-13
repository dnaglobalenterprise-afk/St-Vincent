import { supabase } from '../../lib/supabase'
import type { Message, Profile, Room } from '../../lib/types'

export interface MemberLite {
  id: string
  name: string
  role: Profile['role']
  cohort?: string
}

const AST_TZ = 'America/St_Vincent'

/** Relative time under 24h, otherwise AST date/time. */
export function messageTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleString('en-US', { timeZone: AST_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function dayChip(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: AST_TZ, weekday: 'long', month: 'short', day: 'numeric' })
}

export function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function displayName(p: { first_name: string | null; last_name: string | null; email: string }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
}

/** Resolve the user's room (student via enrollment; staff → first active room). */
export async function resolveRoom(userId: string, isStaff: boolean): Promise<Room | null> {
  if (isStaff) {
    const { data } = await supabase.from('rooms').select('*').eq('status', 'active').order('created_at').limit(1).maybeSingle()
    return data
  }
  const { data: enr } = await supabase
    .from('enrollments')
    .select('cohorts(room_id)')
    .eq('user_id', userId)
    .in('status', ['active', 'graduated'])
    .limit(1)
    .maybeSingle()
  const roomId = (enr as { cohorts?: { room_id: string | null } } | null)?.cohorts?.room_id
  if (!roomId) return null
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  return room
}

/**
 * All members of a room via the security-definer RPC. Students cannot SELECT
 * other users' profiles directly (RLS), so identity resolution for chat,
 * mentions, DMs, and the member list all flows through get_room_members.
 */
export async function roomMembers(roomId: string): Promise<MemberLite[]> {
  const { data } = await supabase.rpc('get_room_members', { p_room_id: roomId })
  return ((data ?? []) as { id: string; name: string; role: MemberLite['role']; cohort: string | null }[]).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    cohort: m.cohort ?? undefined,
  }))
}

export const MESSAGE_PAGE = 50

export async function loadMessages(channelId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE)
  return ((data ?? []) as Message[]).reverse()
}

export async function loadThread(parentId: string): Promise<Message[]> {
  const { data } = await supabase.from('messages').select('*').eq('parent_id', parentId).order('created_at')
  return (data ?? []) as Message[]
}

/** Linkify plain URLs in message bodies (safe: escapes then linkifies). */
export function renderBody(body: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = []
  const re = /(https?:\/\/[^\s]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) })
    parts.push({ text: m[0], url: m[0] })
    last = m.index + m[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last) })
  return parts
}
