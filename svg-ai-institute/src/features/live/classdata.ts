import { supabase } from '../../lib/supabase'
import type { LiveClass, Room } from '../../lib/types'

/** Resolve the signed-in user's room via their active enrollment. */
export async function resolveMemberRoom(userId: string): Promise<Room | null> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('cohorts(room_id)')
    .eq('user_id', userId)
    .in('status', ['active', 'graduated'])
    .limit(1)
    .maybeSingle()
  const roomId = (enrollment as { cohorts?: { room_id: string | null } } | null)?.cohorts?.room_id
  if (!roomId) return null
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  return room
}

/**
 * Classes visible to the student (RLS already scopes cohort membership;
 * this just fetches for their room, ordered by time).
 */
export async function loadStudentClasses(): Promise<LiveClass[]> {
  const { data } = await supabase
    .from('live_classes')
    .select('*')
    .order('scheduled_at', { ascending: true })
  return (data ?? []) as LiveClass[]
}
