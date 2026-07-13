import {
  AtSign,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Inbox,
  Megaphone,
  MessageCircle,
  Rocket,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Notification } from '../../lib/types'

export const NOTIF_PAGE = 30
const AST_TZ = 'America/St_Vincent'

export const NOTIF_ICONS: Record<string, LucideIcon> = {
  assignment_reviewed: ClipboardCheck,
  capstone_update: Rocket,
  showcase_published: Globe,
  staff_queue: Inbox,
  class_reminder: Video,
  mention: AtSign,
  dm: MessageCircle,
  graduated: GraduationCap,
  announcement: Megaphone,
}

export function notifIcon(type: string): LucideIcon {
  return NOTIF_ICONS[type] ?? Inbox
}

/** Relative time, in AST, for notification rows. */
export function notifTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Intl.DateTimeFormat('en-US', { timeZone: AST_TZ, month: 'short', day: 'numeric' }).format(new Date(iso))
}

export async function loadNotifications(userId: string, limit = NOTIF_PAGE): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function markRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
}
