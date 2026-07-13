import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Flame, Medal, Trophy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { resolveRoom } from '../community/community'
import { LEVELS } from './gamification'
import { BadgesGrid } from './BadgesGrid'

interface Row {
  rank: number
  display_name: string
  level: number
  points: number
  badge_count: number
  current_streak: number
  is_me: boolean
}

export function LeaderboardPage() {
  const { profile, role } = useAuth()
  const isStaff = role === 'admin' || role === 'instructor'
  const [roomId, setRoomId] = useState<string | null>(null)
  const [myCohort, setMyCohort] = useState<string | null>(null)
  const [tab, setTab] = useState<'cohort' | 'room'>('cohort')
  const [rows, setRows] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!profile) return
    resolveRoom(profile.id, isStaff).then(async (room) => {
      if (!room) { setLoaded(true); return }
      setRoomId(room.id)
      const { data: enr } = await supabase.from('enrollments').select('cohort_id').eq('user_id', profile.id).in('status', ['active', 'graduated']).limit(1).maybeSingle()
      setMyCohort(enr?.cohort_id ?? null)
    })
  }, [profile, isStaff])

  const load = useCallback(async () => {
    if (!roomId) return
    setLoaded(false)
    const cohortArg = tab === 'cohort' ? myCohort : null
    const { data } = await supabase.rpc('get_leaderboard', { p_room_id: roomId, p_cohort_id: cohortArg })
    setRows((data ?? []) as Row[])
    setLoaded(true)
  }, [roomId, tab, myCohort])

  useEffect(() => {
    if (roomId) void load()
  }, [roomId, load])

  const top10 = useMemo(() => rows.slice(0, 10), [rows])
  const me = useMemo(() => rows.find((r) => r.is_me), [rows])
  const meOutside = me && me.rank > 10

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leaderboard" description="Friendly cohort pressure. Points come from real learning." />

      <div className="flex gap-2">
        {(['cohort', 'room'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-base font-medium ${tab === t ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'}`}>
            {t === 'cohort' ? 'My cohort' : 'All-time room'}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : top10.length === 0 ? (
        <Card><EmptyState icon={Trophy} message="The board is waiting. First lesson takes it." /></Card>
      ) : (
        <>
          {/* Podium (top 3) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top10.slice(0, 3).map((r, i) => (
              <Card key={r.rank} className={i === 0 ? 'border-2 border-svggold-500 bg-svggold-100' : i === 1 ? 'bg-surface-alt' : 'bg-svggold-50'}>
                <div className="flex items-center gap-3">
                  {i === 0 ? <Trophy className="h-8 w-8 text-svggold-600" aria-hidden="true" /> : i === 1 ? <Medal className="h-8 w-8 text-ink-muted" aria-hidden="true" /> : <Award className="h-8 w-8 text-svggold-600" aria-hidden="true" />}
                  <div>
                    <p className="font-heading text-lg font-semibold text-ink">{r.display_name}{r.is_me ? ' (you)' : ''}</p>
                    <p className="text-sm text-ink-muted">{r.points} pts · {LEVELS[r.level - 1]?.name}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Rest of top 10 */}
          {top10.length > 3 && (
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
              {top10.slice(3).map((r) => <LbRow key={r.rank} r={r} />)}
            </div>
          )}

          {/* Your rank (if outside top 10) */}
          {meOutside && (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-muted">Your rank</p>
              <div className="overflow-hidden rounded-xl border-2 border-svgblue-500 bg-svgblue-50">
                <LbRow r={me} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Badges grid */}
      <BadgesGrid />
    </div>
  )
}

function LbRow({ r }: { r: Row }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0 ${r.is_me ? 'bg-svgblue-50' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="w-6 text-center font-heading text-base font-bold text-ink-muted">{r.rank}</span>
        <div>
          <p className="font-medium text-ink">{r.display_name}{r.is_me ? ' (you)' : ''}</p>
          <p className="text-sm text-ink-muted">{LEVELS[r.level - 1]?.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        {r.current_streak > 0 && <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-svggold-500" aria-hidden="true" />{r.current_streak}</span>}
        <Badge variant="gold">{r.points} pts</Badge>
      </div>
    </div>
  )
}
