import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { BusinessPartner, CapstoneProject, CapstoneReview } from '../../lib/types'
import { SignedFileLink } from '../learning/AssignmentLesson'
import { CAPSTONE_STATUS_META, CAPSTONE_TYPE_LABELS, LIVE_PROOF_META, waLink } from './capstone'

type Tab = 'matches' | 'verify'

interface Enriched extends CapstoneProject {
  studentName: string
  businessName: string
}

const CHECKLIST = [
  'Watched the full walkthrough',
  'Tested the live proof myself',
  "It addresses the business's stated pain point",
  'Business is aware and has seen it',
]

export function CapstonesReviewPage() {
  const [tab, setTab] = useState<Tab>('matches')
  const [projects, setProjects] = useState<Enriched[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Enriched | null>(null)
  const [contact, setContact] = useState<{ contact_name: string; email: string; whatsapp: string } | null>(null)
  const [priorReviews, setPriorReviews] = useState<CapstoneReview[]>([])
  const [feedback, setFeedback] = useState('')
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false])
  const [busy, setBusy] = useState(false)
  const [confirmVerify, setConfirmVerify] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: projs } = await supabase.from('capstone_projects').select('*').order('created_at', { ascending: true })
    const rows = (projs ?? []) as CapstoneProject[]
    const userIds = [...new Set(rows.map((r) => r.user_id))]
    const bizIds = [...new Set(rows.map((r) => r.business_id))]
    const [{ data: profiles }, { data: biz }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds.length ? userIds : ['x']),
      supabase.from('business_partners').select('*').in('id', bizIds.length ? bizIds : ['x']),
    ])
    const nameById = new Map((profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email]))
    const bizById = new Map((biz ?? []).map((b) => [b.id, b as BusinessPartner]))
    setProjects(rows.map((r) => ({ ...r, studentName: nameById.get(r.user_id) ?? 'Student', businessName: bizById.get(r.business_id)?.name ?? '' })))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const matches = useMemo(() => projects.filter((p) => p.status === 'requested'), [projects])
  const toVerify = useMemo(() => projects.filter((p) => p.status === 'submitted'), [projects])

  const openDetail = async (p: Enriched) => {
    setSelected(p)
    setFeedback('')
    setChecks([false, false, false, false])
    setConfirmVerify(false)
    setContact(null)
    const [{ data: c }, { data: revs }] = await Promise.all([
      supabase.rpc('get_business_contact', { p_project_id: p.id }),
      supabase.from('capstone_reviews').select('*').eq('project_id', p.id).order('created_at', { ascending: false }),
    ])
    if (c && c.length > 0) setContact(c[0])
    setPriorReviews((revs ?? []) as CapstoneReview[])
  }

  const decideMatch = async (approve: boolean) => {
    if (!selected) return
    if (feedback.trim().length < 5) return showToast('error', 'Add a short note for the student.')
    setBusy(true)
    const { error } = await supabase.rpc('decide_capstone_match', { p_project_id: selected.id, p_approve: approve, p_feedback: feedback.trim() })
    setBusy(false)
    if (error) {
      showToast('error', error.message.includes('business_full') ? 'That business is at capacity.' : error.message.includes('invalid_state') ? 'Already decided.' : 'Could not save.')
      setSelected(null); void load(); return
    }
    showToast('success', approve ? 'Match approved.' : 'Match declined.')
    setSelected(null); void load()
  }

  const verify = async (doVerify: boolean) => {
    if (!selected) return
    if (feedback.trim().length < 20) return showToast('error', 'Feedback needs at least 20 characters.')
    setBusy(true)
    const { error } = await supabase.rpc('review_capstone', { p_project_id: selected.id, p_verify: doVerify, p_feedback: feedback.trim() })
    setBusy(false)
    if (error) {
      showToast('error', error.message.includes('invalid_state') ? 'This was already reviewed.' : 'Could not save.')
      setSelected(null); void load(); return
    }
    showToast('success', doVerify ? 'Capstone verified! 🎉' : 'Changes requested.')
    setSelected(null); void load()
  }

  const allChecked = checks.every(Boolean)

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-base font-medium shadow-card ${toast.kind === 'success' ? 'bg-svggreen-100 text-svggreen-700' : 'bg-svggold-100 text-danger'}`}>{toast.text}</div>
      )}
      <PageHeader title="Capstones" description="Approve matches and verify deployed systems." />

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('matches')} className={`rounded-xl px-4 py-2 text-base font-medium ${tab === 'matches' ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'}`}>Match requests ({matches.length})</button>
        <button type="button" onClick={() => setTab('verify')} className={`rounded-xl px-4 py-2 text-base font-medium ${tab === 'verify' ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'}`}>Verification ({toVerify.length})</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (tab === 'matches' ? matches : toVerify).length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} message={tab === 'matches' ? 'No match requests waiting.' : 'No capstones to verify.'} /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {(tab === 'matches' ? matches : toVerify).map((p) => (
            <button key={p.id} type="button" onClick={() => void openDetail(p)} className="text-left">
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{p.studentName} → {p.businessName}</p>
                    <p className="text-sm text-ink-muted">{CAPSTONE_TYPE_LABELS[p.type]}</p>
                  </div>
                  <Badge variant={CAPSTONE_STATUS_META[p.status].variant}>{CAPSTONE_STATUS_META[p.status].label}</Badge>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={() => setSelected(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label={selected.studentName} className="h-full w-full overflow-y-auto bg-white shadow-card sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <div>
                <h2 className="font-heading text-xl font-semibold text-ink">{selected.studentName}</h2>
                <p className="text-sm text-ink-muted">{selected.businessName} · {CAPSTONE_TYPE_LABELS[selected.type]}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-6 px-6 py-6">
              <div>
                <p className="text-sm font-medium text-ink-muted">Pitch</p>
                <p className="text-base text-ink">{selected.pitch}</p>
              </div>
              {contact && (
                <div className="rounded-xl bg-surface-alt p-4">
                  <p className="text-sm font-medium text-ink-muted">Business contact</p>
                  <p className="text-base text-ink">{contact.contact_name} · {contact.whatsapp}</p>
                  <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-svggreen-700 underline">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" /> WhatsApp
                  </a>
                </div>
              )}

              {selected.status === 'submitted' && (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-ink-muted">Evidence</p>
                    {selected.video_url && (
                      <a href={selected.video_url} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-svgblue-500 underline">
                        Walkthrough video: {selected.video_url}
                      </a>
                    )}
                    <p className="text-base text-ink">
                      <span className="text-ink-muted">{LIVE_PROOF_META[selected.type].label}: </span>{selected.live_proof}
                    </p>
                    <div>
                      <p className="text-sm font-medium text-ink-muted">What it does &amp; the result</p>
                      <p className="text-base text-ink">{selected.narrative}</p>
                    </div>
                    {selected.file_paths.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {selected.file_paths.map((path) => <li key={path}><SignedFileLink path={path} /></li>)}
                      </ul>
                    )}
                  </div>

                  {priorReviews.some((r) => r.decision === 'changes_requested') && (
                    <div>
                      <p className="text-sm font-medium text-ink-muted">Prior feedback</p>
                      {priorReviews.filter((r) => r.decision === 'changes_requested').map((r) => (
                        <p key={r.id} className="mt-1 text-sm text-ink-muted">{r.feedback}</p>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl bg-surface-alt p-4">
                    <p className="text-sm font-medium text-ink">Verification checklist</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {CHECKLIST.map((item, i) => (
                        <label key={i} className="flex items-center gap-2 text-base text-ink">
                          <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} className="h-4 w-4" />
                          {item}
                        </label>
                      ))}
                    </div>
                    <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (20+ chars)" className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
                    {confirmVerify ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-svggreen-100 p-4">
                        <p className="text-base text-ink">This marks the capstone complete and eligible for the public Outcomes Board.</p>
                        <div className="flex gap-2">
                          <Button variant="success" loading={busy} onClick={() => void verify(true)}>Yes, verify</Button>
                          <Button variant="ghost" onClick={() => setConfirmVerify(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="success" disabled={!allChecked} title={!allChecked ? 'Complete the checklist first' : undefined} onClick={() => setConfirmVerify(true)}>Verify capstone</Button>
                        <Button className="border-warning bg-warning text-white hover:bg-warning" loading={busy} onClick={() => void verify(false)}>Request changes</Button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selected.status === 'requested' && (
                <div className="flex flex-col gap-3 rounded-xl bg-surface-alt p-4">
                  <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Note to the student (required)" className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="success" loading={busy} onClick={() => void decideMatch(true)}>Approve match</Button>
                    <Button variant="ghost" className="text-danger" loading={busy} onClick={() => void decideMatch(false)}>Decline</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
