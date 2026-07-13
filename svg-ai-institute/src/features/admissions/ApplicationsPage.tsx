import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Inbox, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Application, ApplicationStatus, Cohort } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from './StatusBadge'

const SVG = 'Saint Vincent and the Grenadines'

const HOURS_LABELS: Record<string, string> = {
  under_5: 'Under 5',
  '5_8': '5-8',
  '8_10': '8-10',
  '10_plus': '10+',
}
const DEVICE_LABELS: Record<string, string> = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  phone_only: 'Phone only',
  shared: 'Shared computer',
}
const INTERNET_LABELS: Record<string, string> = {
  reliable: 'Reliable',
  sometimes: 'Sometimes drops',
  unreliable: 'Unreliable',
}

function age(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth + 'T00:00:00')
  const today = new Date()
  let years = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years--
  return years
}

function redFlags(app: Application): string[] {
  const flags: string[] = []
  if (app.weekly_hours === 'under_5' || app.weekly_hours === '5_8') flags.push('Low hours')
  if (app.internet === 'unreliable') flags.push('Connectivity risk')
  if (app.device_access === 'phone_only') flags.push('Device risk')
  if (app.country !== SVG) flags.push('Diaspora')
  return flags
}

function FlagChips({ app }: { app: Application }) {
  const flags = redFlags(app)
  if (flags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span
          key={flag}
          className="inline-flex items-center rounded-full bg-svggold-100 px-2 py-0.5 text-sm font-medium text-warning"
        >
          {flag}
        </span>
      ))}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="text-base text-ink">{value || '—'}</dd>
    </div>
  )
}

type StatusFilter = 'all' | ApplicationStatus
type SortKey = 'submitted' | 'score'

export function ApplicationsPage() {
  const { role, profile } = useAuth()
  const isAdmin = role === 'admin'

  const [applications, setApplications] = useState<Application[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cohortCounts, setCohortCounts] = useState<Record<string, number>>({})
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('submitted')
  const [selected, setSelected] = useState<Application | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // review panel state
  const [score, setScore] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  // decision state
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [acceptCohortId, setAcceptCohortId] = useState('')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [deciding, setDeciding] = useState(false)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 5000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: apps }, { data: cohortRows }, { data: enrollmentRows }] = await Promise.all([
      supabase.from('applications').select('*').order('created_at', { ascending: true }),
      supabase.from('cohorts').select('*').order('start_date'),
      supabase.from('enrollments').select('cohort_id').eq('status', 'active'),
    ])
    setApplications(apps ?? [])
    setCohorts(cohortRows ?? [])
    const map: Record<string, number> = {}
    for (const row of enrollmentRows ?? []) map[row.cohort_id] = (map[row.cohort_id] ?? 0) + 1
    setCohortCounts(map)
    const reviewerIds = [...new Set((apps ?? []).map((a) => a.reviewed_by).filter(Boolean))] as string[]
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', reviewerIds)
      const names: Record<string, string> = {}
      for (const r of reviewers ?? []) {
        names[r.id] = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email
      }
      setReviewerNames(names)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    let rows = applications
    if (statusFilter !== 'all') rows = rows.filter((a) => a.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (a) =>
          `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q),
      )
    }
    if (sortKey === 'score') {
      rows = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    }
    return rows
  }, [applications, statusFilter, search, sortKey])

  const openDetail = (app: Application) => {
    setSelected(app)
    setScore(app.score)
    setNotes(app.review_notes ?? '')
  }

  const saveReview = async () => {
    if (!selected || !profile) return
    setSavingReview(true)
    const patch: Partial<Application> = {
      score,
      review_notes: notes || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    }
    if (selected.status === 'submitted') patch.status = 'under_review'
    const { error } = await supabase.from('applications').update(patch).eq('id', selected.id)
    setSavingReview(false)
    if (error) {
      showToast('error', 'Could not save the review.')
      return
    }
    showToast('success', 'Review saved.')
    await load()
    setSelected((prev) =>
      prev ? { ...prev, ...patch, status: (patch.status as ApplicationStatus) ?? prev.status } : prev,
    )
  }

  const decide = async (status: 'waitlisted' | 'declined') => {
    if (!selected || !profile) return
    if (status === 'declined' && !declineReason.trim()) return
    setDeciding(true)
    const { error } = await supabase
      .from('applications')
      .update({
        status,
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
        decline_reason: status === 'declined' ? declineReason.trim() : selected.decline_reason,
      })
      .eq('id', selected.id)
    setDeciding(false)
    setWaitlistOpen(false)
    setDeclineOpen(false)
    if (error) {
      showToast('error', 'Could not update the application.')
      return
    }
    showToast('success', status === 'waitlisted' ? 'Moved to waitlist.' : 'Application declined.')
    setSelected(null)
    void load()
  }

  const accept = async () => {
    if (!selected || !acceptCohortId) return
    setDeciding(true)
    const { data, error } = await supabase.functions.invoke('accept-applicant', {
      body: { application_id: selected.id, cohort_id: acceptCohortId },
    })
    setDeciding(false)
    if (error) {
      let message = 'Accept failed.'
      try {
        const ctx = await (error as { context?: Response }).context?.json()
        if (ctx?.error) message = ctx.error
      } catch {
        // keep generic message
      }
      showToast('error', message)
      return
    }
    if (data?.ok) {
      showToast('success', 'Accepted, invited, and enrolled.')
      setAcceptOpen(false)
      setSelected(null)
      void load()
    }
  }

  const cohortName = (id: string | null) => cohorts.find((c) => c.id === id)?.name ?? ''

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

      <PageHeader
        title="Applications"
        description="Review, score, and decide. To promote from the waitlist, open the application and Accept."
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
        >
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="accepted">Accepted</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="declined">Declined</option>
        </select>
        <div className="flex-1">
          <Input
            name="queue-search"
            aria-label="Search by name or email"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSortKey(sortKey === 'submitted' ? 'score' : 'submitted')}
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
          Sort: {sortKey === 'submitted' ? 'Oldest first' : 'Score'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} message="No applications match." />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-card md:block">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-line bg-surface-alt text-sm text-ink-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                  <th className="px-4 py-3 font-medium">Community</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => openDetail(app)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-svgblue-50"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {app.first_name} {app.last_name}
                      {app.status === 'accepted' && app.cohort_id && (
                        <span className="ml-2 text-sm text-svggreen-700">{cohortName(app.cohort_id)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{age(app.date_of_birth)}</td>
                    <td className="px-4 py-3 text-ink">{app.community}</td>
                    <td className="px-4 py-3 text-ink">{HOURS_LABELS[app.weekly_hours] ?? app.weekly_hours}</td>
                    <td className="px-4 py-3 text-ink">{DEVICE_LABELS[app.device_access] ?? app.device_access}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-ink">{app.score ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-4 md:hidden">
            {visible.map((app) => (
              <button key={app.id} type="button" onClick={() => openDetail(app)} className="text-left">
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-base font-semibold text-ink">
                        {app.first_name} {app.last_name}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {age(app.date_of_birth)} · {app.community} ·{' '}
                        {HOURS_LABELS[app.weekly_hours] ?? app.weekly_hours} hrs
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <FlagChips app={app} />
                    <span className="text-sm text-ink-muted">Score: {app.score ?? '—'}</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={() => setSelected(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Application from ${selected.first_name} ${selected.last_name}`}
            className="h-full w-full overflow-y-auto bg-white shadow-card sm:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="font-heading text-xl font-semibold text-ink">
                  {selected.first_name} {selected.last_name}
                </h2>
                <StatusBadge status={selected.status} />
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

            <div className="flex flex-col gap-8 px-6 py-6">
              <FlagChips app={selected} />

              <section aria-label="About">
                <h3 className="font-heading text-base font-semibold text-svgblue-500">About</h3>
                <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email" value={selected.email} />
                  <Field label="WhatsApp" value={selected.whatsapp} />
                  <Field label="Age" value={String(age(selected.date_of_birth))} />
                  <Field label="Community" value={selected.community} />
                  <Field label="Country" value={selected.country} />
                  <Field label="Reference code" value={selected.ref_code} />
                </dl>
              </section>

              <section aria-label="Readiness">
                <h3 className="font-heading text-base font-semibold text-svgblue-500">Readiness</h3>
                <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Device" value={DEVICE_LABELS[selected.device_access]} />
                  <Field label="Internet" value={INTERNET_LABELS[selected.internet]} />
                  <Field label="Weekly hours" value={HOURS_LABELS[selected.weekly_hours]} />
                  <Field label="Situation" value={selected.situation} />
                </dl>
              </section>

              <section aria-label="Motivation">
                <h3 className="font-heading text-base font-semibold text-svgblue-500">Motivation</h3>
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink-muted">Why they want to join</p>
                    <p className="mt-1 whitespace-pre-wrap text-base text-ink">{selected.motivation}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-muted">Finisher story</p>
                    <p className="mt-1 whitespace-pre-wrap text-base text-ink">{selected.finisher_story}</p>
                  </div>
                  <Field label="Heard about us via" value={selected.heard_from} />
                </div>
              </section>

              <section aria-label="Review" className="rounded-xl bg-surface-alt p-5">
                <h3 className="font-heading text-base font-semibold text-ink">Review</h3>
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Score</p>
                    <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Score 1 to 5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={score === n}
                          onClick={() => setScore(n)}
                          className={`h-10 w-10 rounded-xl border font-heading text-base font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-svgblue-500 ${
                            score === n
                              ? 'border-svggold-600 bg-svggold-500 text-ink'
                              : 'border-line bg-white text-ink-muted hover:border-svggold-500'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    <label htmlFor="review-notes" className="text-sm font-medium text-ink">
                      Notes
                    </label>
                    <textarea
                      id="review-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
                    />
                  </div>
                  {selected.reviewed_by && selected.reviewed_at && (
                    <p className="text-sm text-ink-muted">
                      Last reviewed by {reviewerNames[selected.reviewed_by] ?? 'staff'} ·{' '}
                      {new Date(selected.reviewed_at).toLocaleString()}
                    </p>
                  )}
                  <Button variant="secondary" size="sm" loading={savingReview} onClick={() => void saveReview()}>
                    Save review
                  </Button>
                </div>
              </section>

              {isAdmin && (
                <section aria-label="Decision" className="flex flex-col gap-3">
                  <h3 className="font-heading text-base font-semibold text-ink">Decision</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="success" onClick={() => setAcceptOpen(true)}>
                      Accept
                    </Button>
                    <Button variant="secondary" onClick={() => setWaitlistOpen(true)}>
                      Waitlist
                    </Button>
                    <Button variant="ghost" className="text-danger hover:bg-svggold-100" onClick={() => setDeclineOpen(true)}>
                      Decline
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accept modal */}
      <Modal title="Accept applicant" open={acceptOpen} onClose={() => setAcceptOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">
            Choose a cohort for{' '}
            <span className="font-medium">
              {selected?.first_name} {selected?.last_name}
            </span>
            . They&apos;ll be invited by email and enrolled.
          </p>
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="accept-cohort" className="text-sm font-medium text-ink">
              Cohort
            </label>
            <select
              id="accept-cohort"
              value={acceptCohortId}
              onChange={(e) => setAcceptCohortId(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            >
              <option value="">Choose a cohort…</option>
              {cohorts
                .filter((c) => c.status === 'open' || c.status === 'draft')
                .map((c) => {
                  const full = (cohortCounts[c.id] ?? 0) >= c.capacity
                  return (
                    <option key={c.id} value={c.id} disabled={full}>
                      {c.name} — {cohortCounts[c.id] ?? 0}/{c.capacity}
                      {full ? ' (full)' : ''}
                    </option>
                  )
                })}
            </select>
          </div>
          <Button variant="success" loading={deciding} disabled={!acceptCohortId} onClick={() => void accept()}>
            Confirm acceptance
          </Button>
        </div>
      </Modal>

      {/* Waitlist confirm */}
      <Modal title="Move to waitlist?" open={waitlistOpen} onClose={() => setWaitlistOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">
            {selected?.first_name} will see &quot;waitlisted&quot; on the status page. You can
            accept them later if a seat opens.
          </p>
          <Button loading={deciding} onClick={() => void decide('waitlisted')}>
            Confirm waitlist
          </Button>
        </div>
      </Modal>

      {/* Decline confirm */}
      <Modal title="Decline application?" open={declineOpen} onClose={() => setDeclineOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">
            This sets a kind &quot;not this cohort&quot; message on the status page. The reason
            below is internal only.
          </p>
          <Input
            label="Internal reason (required)"
            name="decline-reason"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            error={declineOpen && !declineReason.trim() ? 'A reason is required to decline.' : undefined}
          />
          <Button
            variant="ghost"
            className="text-danger hover:bg-svggold-100"
            loading={deciding}
            disabled={!declineReason.trim()}
            onClick={() => void decide('declined')}
          >
            Confirm decline
          </Button>
        </div>
      </Modal>
    </div>
  )
}
