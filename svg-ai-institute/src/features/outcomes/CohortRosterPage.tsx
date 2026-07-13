import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { CAPSTONE_STATUS_META } from '../capstone/capstone'
import type { CapstoneStatus } from '../../lib/types'

interface RosterRow {
  userId: string
  name: string
  progress: number
  capstoneStatus: CapstoneStatus | null
  eligible: boolean
  graduated: boolean
}

export function CohortRosterPage() {
  const { id } = useParams<{ id: string }>()
  const [cohortName, setCohortName] = useState('')
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: cohort } = await supabase.from('cohorts').select('name, room_id').eq('id', id).maybeSingle()
    setCohortName(cohort?.name ?? '')

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('user_id, status')
      .eq('cohort_id', id)
    const userIds = (enrollments ?? []).map((e) => e.user_id)

    // required published lessons in the room's published course
    let requiredIds: string[] = []
    if (cohort?.room_id) {
      const { data: course } = await supabase.from('courses').select('id').eq('room_id', cohort.room_id).eq('status', 'published').maybeSingle()
      if (course) {
        const { data: mods } = await supabase.from('modules').select('id').eq('course_id', course.id)
        const modIds = (mods ?? []).map((m) => m.id)
        const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', modIds.length ? modIds : ['x']).eq('required', true).eq('published', true)
        requiredIds = (lessons ?? []).map((l) => l.id)
      }
    }

    const [{ data: profiles }, { data: progress }, { data: capstones }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds.length ? userIds : ['x']),
      supabase.from('lesson_progress').select('user_id, lesson_id').in('user_id', userIds.length ? userIds : ['x']),
      supabase.from('capstone_projects').select('user_id, status').in('user_id', userIds.length ? userIds : ['x']),
    ])
    const nameById = new Map((profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email]))
    const doneByUser = new Map<string, Set<string>>()
    for (const p of progress ?? []) {
      if (!doneByUser.has(p.user_id)) doneByUser.set(p.user_id, new Set())
      doneByUser.get(p.user_id)!.add(p.lesson_id)
    }
    const capByUser = new Map<string, CapstoneStatus>()
    for (const c of capstones ?? []) {
      // prefer verified
      if (c.status === 'verified' || !capByUser.has(c.user_id)) capByUser.set(c.user_id, c.status as CapstoneStatus)
    }

    // eligibility per user via RPC (server truth)
    const eligByUser = new Map<string, boolean>()
    await Promise.all(userIds.map(async (uid) => {
      const { data } = await supabase.rpc('is_graduation_eligible', { p_user_id: uid })
      eligByUser.set(uid, !!data)
    }))

    setRows(
      (enrollments ?? []).map((e) => {
        const done = doneByUser.get(e.user_id) ?? new Set()
        const completed = requiredIds.filter((r) => done.has(r)).length
        return {
          userId: e.user_id,
          name: nameById.get(e.user_id) ?? 'Student',
          progress: requiredIds.length ? Math.round((100 * completed) / requiredIds.length) : 0,
          capstoneStatus: capByUser.get(e.user_id) ?? null,
          eligible: eligByUser.get(e.user_id) ?? false,
          graduated: e.status === 'graduated',
        }
      }),
    )
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const graduate = async (userId: string) => {
    setBusy(userId)
    const { error } = await supabase.rpc('graduate_student', { p_user_id: userId })
    setBusy(null)
    if (error) {
      setToast(error.message.includes('not_eligible') ? 'Not eligible yet.' : 'Could not graduate.')
    } else {
      setToast('Graduated 🎓')
    }
    setTimeout(() => setToast(null), 3000)
    void load()
  }

  const graduateAll = async () => {
    const eligible = rows.filter((r) => r.eligible && !r.graduated)
    for (const r of eligible) {
      await supabase.rpc('graduate_student', { p_user_id: r.userId })
    }
    setToast(`Graduated ${eligible.length} student${eligible.length === 1 ? '' : 's'}.`)
    setTimeout(() => setToast(null), 3000)
    void load()
  }

  const eligibleCount = rows.filter((r) => r.eligible && !r.graduated).length

  return (
    <div className="flex flex-col gap-6">
      {toast && <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-svggreen-100 px-5 py-3 text-base font-medium text-svggreen-700 shadow-card">{toast}</div>}
      <PageHeader
        title={`Roster — ${cohortName}`}
        description="Progress, capstone status, and graduation."
        action={eligibleCount > 0 ? <Button onClick={() => void graduateAll()}>Graduate all eligible ({eligibleCount})</Button> : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={GraduationCap} message="No students enrolled in this cohort." /></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-sm text-ink-muted">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Capstone</th>
                <th className="px-4 py-3 font-medium">Eligible</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-svgblue-100">
                        <div className="h-full bg-svggreen-500" style={{ width: `${r.progress}%` }} />
                      </div>
                      <span className="text-sm text-ink-muted">{r.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.capstoneStatus ? <Badge variant={CAPSTONE_STATUS_META[r.capstoneStatus].variant}>{CAPSTONE_STATUS_META[r.capstoneStatus].label}</Badge> : <span className="text-sm text-ink-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">{r.eligible || r.graduated ? '✅' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {r.graduated ? (
                      <Badge variant="green">Graduated</Badge>
                    ) : (
                      <Button size="sm" disabled={!r.eligible} loading={busy === r.userId} onClick={() => void graduate(r.userId)}>Graduate</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
