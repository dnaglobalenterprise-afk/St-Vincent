import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Inbox, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Submission, SubmissionStatus } from '../../lib/types'
import { Markdown } from './Markdown'
import { SignedFileLink } from './AssignmentLesson'
import { STATUS_META } from './assignments'

interface QueueRow extends Submission {
  studentName: string
  cohortName: string
  moduleTitle: string
  moduleSort: number
  lessonTitle: string
  instructions: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function ReviewQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus>('submitted')
  const [cohortFilter, setCohortFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QueueRow | null>(null)
  const [feedback, setFeedback] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: true })
    const submissions = (subs ?? []) as Submission[]

    const userIds = [...new Set(submissions.map((s) => s.user_id))]
    const lessonIds = [...new Set(submissions.map((s) => s.lesson_id))]

    const [{ data: profiles }, { data: lessons }, { data: enrollments }, { data: cohorts }] =
      await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds.length ? userIds : ['x']),
        supabase.from('lessons').select('id, title, body_markdown, module_id').in('id', lessonIds.length ? lessonIds : ['x']),
        supabase.from('enrollments').select('user_id, cohort_id').eq('status', 'active'),
        supabase.from('cohorts').select('id, name'),
      ])

    const moduleIds = [...new Set((lessons ?? []).map((l) => l.module_id))]
    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, sort_order')
      .in('id', moduleIds.length ? moduleIds : ['x'])

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email]),
    )
    const lessonById = new Map((lessons ?? []).map((l) => [l.id, l]))
    const moduleById = new Map((modules ?? []).map((m) => [m.id, m]))
    const cohortByUser = new Map<string, string>()
    const cohortNameById = new Map((cohorts ?? []).map((c) => [c.id, c.name]))
    for (const e of enrollments ?? []) cohortByUser.set(e.user_id, cohortNameById.get(e.cohort_id) ?? '')

    setRows(
      submissions.map((s) => {
        const lesson = lessonById.get(s.lesson_id)
        const module = lesson ? moduleById.get(lesson.module_id) : undefined
        return {
          ...s,
          studentName: nameById.get(s.user_id) ?? 'Student',
          cohortName: cohortByUser.get(s.user_id) ?? '—',
          moduleTitle: module?.title ?? '',
          moduleSort: module?.sort_order ?? 0,
          lessonTitle: lesson?.title ?? '',
          instructions: lesson?.body_markdown ?? '',
        }
      }),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      awaiting: rows.filter((r) => r.status === 'submitted').length,
      changes: rows.filter((r) => r.status === 'changes_requested').length,
      approvedWeek: rows.filter(
        (r) => r.status === 'approved' && r.reviewed_at && now - new Date(r.reviewed_at).getTime() < WEEK_MS,
      ).length,
    }
  }, [rows])

  const cohortOptions = useMemo(() => [...new Set(rows.map((r) => r.cohortName))].filter((c) => c !== '—'), [rows])
  const moduleOptions = useMemo(
    () => [...new Set(rows.map((r) => r.moduleTitle))].filter(Boolean),
    [rows],
  )

  const visible = useMemo(() => {
    let list = rows.filter((r) => r.status === statusFilter)
    if (cohortFilter !== 'all') list = list.filter((r) => r.cohortName === cohortFilter)
    if (moduleFilter !== 'all') list = list.filter((r) => r.moduleTitle === moduleFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((r) => r.studentName.toLowerCase().includes(q))
    return list
  }, [rows, statusFilter, cohortFilter, moduleFilter, search])

  const openDetail = (row: QueueRow) => {
    setSelected(row)
    setFeedback('')
    setConfirmApprove(false)
    setShowInstructions(false)
  }

  const priorAttempts = useMemo(
    () =>
      selected
        ? rows
            .filter((r) => r.lesson_id === selected.lesson_id && r.user_id === selected.user_id && r.id !== selected.id)
            .sort((a, b) => b.attempt_number - a.attempt_number)
        : [],
    [rows, selected],
  )

  const decide = async (decision: 'approved' | 'changes_requested') => {
    if (!selected) return
    if (feedback.trim().length < 20) {
      showToast('error', 'Feedback needs at least 20 characters.')
      return
    }
    setDeciding(true)
    const { error } = await supabase.rpc('review_submission', {
      p_submission_id: selected.id,
      p_decision: decision,
      p_feedback: feedback.trim(),
    })
    setDeciding(false)
    if (error) {
      const msg = error.message.includes('already_reviewed')
        ? 'Someone already reviewed this submission.'
        : 'Could not save the review.'
      showToast('error', msg)
      setSelected(null)
      void load()
      return
    }
    showToast('success', decision === 'approved' ? 'Approved — lesson completed.' : 'Changes requested.')
    setSelected(null)
    void load()
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-base font-medium shadow-card ${
            toast.kind === 'success' ? 'bg-svggreen-100 text-svggreen-700' : 'bg-svggold-100 text-danger'
          }`}
        >
          {toast.text}
        </div>
      )}

      <PageHeader title="Review Queue" description="Coach the work. Approve completes the lesson." />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-heading text-3xl font-bold text-svgblue-500">{stats.awaiting}</p>
          <p className="text-sm text-ink-muted">Awaiting review</p>
        </Card>
        <Card>
          <p className="font-heading text-3xl font-bold text-warning">{stats.changes}</p>
          <p className="text-sm text-ink-muted">Changes requested — waiting on students</p>
        </Card>
        <Card>
          <p className="font-heading text-3xl font-bold text-svggreen-500">{stats.approvedWeek}</p>
          <p className="text-sm text-ink-muted">Approved this week</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus)}
          className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
        >
          <option value="submitted">Awaiting review</option>
          <option value="changes_requested">Changes requested</option>
          <option value="approved">Approved</option>
        </select>
        <select
          aria-label="Cohort"
          value={cohortFilter}
          onChange={(e) => setCohortFilter(e.target.value)}
          className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
        >
          <option value="all">All cohorts</option>
          {cohortOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Module"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
        >
          <option value="all">All weeks</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex-1">
          <Input
            name="review-search"
            aria-label="Search by student name"
            placeholder="Search by student name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} message="Nothing here right now." />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-card md:block">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-line bg-surface-alt text-sm text-ink-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Cohort</th>
                  <th className="px-4 py-3 font-medium">Week</th>
                  <th className="px-4 py-3 font-medium">Assignment</th>
                  <th className="px-4 py-3 font-medium">Attempt</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openDetail(row)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-svgblue-50"
                  >
                    <td className="px-4 py-3 font-medium text-ink">{row.studentName}</td>
                    <td className="px-4 py-3 text-ink">{row.cohortName}</td>
                    <td className="px-4 py-3 text-ink">{row.moduleTitle}</td>
                    <td className="px-4 py-3 text-ink">{row.lessonTitle}</td>
                    <td className="px-4 py-3 text-ink">#{row.attempt_number}</td>
                    <td className="px-4 py-3 text-ink-muted">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-4 md:hidden">
            {visible.map((row) => (
              <button key={row.id} type="button" onClick={() => openDetail(row)} className="text-left">
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-base font-semibold text-ink">{row.studentName}</p>
                      <p className="text-sm text-ink-muted">
                        {row.cohortName} · {row.moduleTitle}
                      </p>
                      <p className="mt-1 text-sm text-ink">{row.lessonTitle}</p>
                    </div>
                    <Badge variant="neutral">#{row.attempt_number}</Badge>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Review detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={() => setSelected(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Review ${selected.studentName}`}
            className="h-full w-full overflow-y-auto bg-white shadow-card sm:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <div>
                <h2 className="font-heading text-xl font-semibold text-ink">{selected.studentName}</h2>
                <p className="text-sm text-ink-muted">
                  {selected.cohortName} · {selected.moduleTitle} · Attempt {selected.attempt_number}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelected(null)}
                className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-svgblue-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-6 px-6 py-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-semibold text-svgblue-500">
                    {selected.lessonTitle}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowInstructions((s) => !s)}>
                    {showInstructions ? 'Hide instructions' : 'Show instructions'}
                  </Button>
                </div>
                {showInstructions && (
                  <div className="mt-2 rounded-xl bg-surface-alt p-4">
                    <Markdown source={selected.instructions} />
                  </div>
                )}
              </div>

              {/* Submission content */}
              <section aria-label="Submission" className="flex flex-col gap-4">
                <h3 className="font-heading text-base font-semibold text-ink">Submission</h3>
                {selected.links.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-ink-muted">Links</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {selected.links.map((link) => (
                        <li key={link}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all font-medium text-svgblue-500 underline hover:text-svgblue-700"
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.text_body && (
                  <div>
                    <p className="text-sm font-medium text-ink-muted">Write-up</p>
                    <div className="mt-1">
                      <Markdown source={selected.text_body} />
                    </div>
                  </div>
                )}
                {selected.file_paths.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-ink-muted">Files</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {selected.file_paths.map((path) => (
                        <li key={path}>
                          <SignedFileLink path={path} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Prior attempts */}
              {priorAttempts.length > 0 && (
                <section aria-label="Prior attempts">
                  <h3 className="font-heading text-base font-semibold text-ink">Prior attempts</h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {priorAttempts.map((p) => (
                      <div key={p.id} className="rounded-xl bg-surface-alt px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_META[p.status].variant}>{STATUS_META[p.status].label}</Badge>
                          <span className="text-sm text-ink-muted">Attempt {p.attempt_number}</span>
                        </div>
                        {p.feedback && (
                          <p className="mt-1 text-sm text-ink-muted">{p.feedback}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Review form (only for submitted) */}
              {selected.status === 'submitted' ? (
                <section aria-label="Review" className="flex flex-col gap-3 rounded-xl bg-surface-alt p-5">
                  <label htmlFor="review-feedback" className="text-sm font-medium text-ink">
                    Feedback (markdown, 20+ characters — students deserve words)
                  </label>
                  <textarea
                    id="review-feedback"
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
                  />
                  {confirmApprove ? (
                    <div className="flex flex-col gap-2 rounded-xl bg-svggreen-100 p-4">
                      <p className="text-base text-ink">This completes the lesson for the student. Approve?</p>
                      <div className="flex gap-2">
                        <Button variant="success" loading={deciding} onClick={() => void decide('approved')}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Yes, approve
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmApprove(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <Button variant="success" onClick={() => setConfirmApprove(true)}>
                        Approve
                      </Button>
                      <Button
                        className="border-warning bg-warning text-white hover:bg-warning"
                        loading={deciding}
                        onClick={() => void decide('changes_requested')}
                      >
                        Request changes
                      </Button>
                    </div>
                  )}
                </section>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3">
                  <Badge variant={STATUS_META[selected.status].variant}>{STATUS_META[selected.status].label}</Badge>
                  <span className="text-sm text-ink-muted">Already reviewed.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
