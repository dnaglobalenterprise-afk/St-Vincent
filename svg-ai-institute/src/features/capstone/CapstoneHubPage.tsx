import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  CircleDot,
  Lock,
  MessageSquare,
  PartyPopper,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { BusinessPartner, CapstoneProject, CapstoneReview, CapstoneType } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { newId } from './BusinessRegisterPage'
import { Markdown } from '../learning/Markdown'
import {
  MAX_FILES,
  uploadSubmissionFile,
  validateFile,
} from '../learning/assignments'
import {
  BUSINESS_TYPES,
  CAPSTONE_STATUS_META,
  CAPSTONE_TYPES,
  CAPSTONE_TYPE_LABELS,
  ISLANDS,
  LIVE_PROOF_META,
  TIMELINE_STEPS,
  timelineIndex,
  waLink,
} from './capstone'

export function CapstoneHubPage() {
  const { profile } = useAuth()
  const [eligible, setEligible] = useState(false)
  const [project, setProject] = useState<CapstoneProject | null>(null)
  const [reviews, setReviews] = useState<CapstoneReview[]>([])
  const [businesses, setBusinesses] = useState<BusinessPartner[]>([])
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const [{ data: elig }, { data: projects }, { data: biz }, { data: allProjects }] = await Promise.all([
      supabase.rpc('is_capstone_eligible'),
      supabase.from('capstone_projects').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('business_partners').select('*').eq('status', 'approved'),
      supabase.from('capstone_projects').select('business_id, status'),
    ])
    setEligible(!!elig)
    const live = (projects ?? []).find((p) =>
      ['requested', 'matched', 'submitted', 'changes_requested', 'verified'].includes(p.status),
    ) as CapstoneProject | undefined
    setProject(live ?? null)
    if (live) {
      const { data: revs } = await supabase
        .from('capstone_reviews')
        .select('*')
        .eq('project_id', live.id)
        .order('created_at', { ascending: false })
      setReviews((revs ?? []) as CapstoneReview[])
    }
    setBusinesses((biz ?? []) as BusinessPartner[])
    const counts: Record<string, number> = {}
    for (const p of allProjects ?? []) {
      if (['matched', 'submitted', 'changes_requested'].includes(p.status)) {
        counts[p.business_id] = (counts[p.business_id] ?? 0) + 1
      }
    }
    setActiveCounts(counts)
    setLoaded(true)
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Your Capstone" description="Build and deploy a real system for a real SVG business." />

      {project ? (
        <MyCapstone project={project} reviews={reviews} onChange={() => void load()} />
      ) : !eligible ? (
        <LockedHub />
      ) : (
        <BrowseAndPropose businesses={businesses} activeCounts={activeCounts} onChange={() => void load()} />
      )}
    </div>
  )
}

function LockedHub() {
  return (
    <Card className="bg-svgblue-50">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Lock className="h-10 w-10 text-svgblue-500" aria-hidden="true" />
        <h2 className="font-heading text-2xl font-semibold text-ink">The capstone unlocks when you complete Week 6</h2>
        <p className="max-w-md text-base text-ink-muted">
          Keep going — once you finish the Week 6 lessons, you&apos;ll browse real SVG businesses and pick the one
          you&apos;ll build for.
        </p>
        <Link to="/learn"><Button>Back to your program</Button></Link>
      </div>
    </Card>
  )
}

// ---------- Browse + request + propose ----------

function BrowseAndPropose({ businesses, activeCounts, onChange }: { businesses: BusinessPartner[]; activeCounts: Record<string, number>; onChange: () => void }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [islandFilter, setIslandFilter] = useState('all')
  const [requestBiz, setRequestBiz] = useState<BusinessPartner | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)

  const withCapacity = useMemo(
    () => businesses.filter((b) => (activeCounts[b.id] ?? 0) < b.capacity),
    [businesses, activeCounts],
  )
  const visible = useMemo(() => {
    let list = withCapacity
    if (typeFilter !== 'all') list = list.filter((b) => b.business_type === typeFilter)
    if (islandFilter !== 'all') list = list.filter((b) => b.island === islandFilter)
    return list
  }, [withCapacity, typeFilter, islandFilter])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <select aria-label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
            <option value="all">All types</option>
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select aria-label="Island" value={islandFilter} onChange={(e) => setIslandFilter(e.target.value)} className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
            <option value="all">All islands</option>
            {ISLANDS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <Button variant="secondary" onClick={() => setProposeOpen(true)}>Propose your own business</Button>
      </div>

      {visible.length === 0 ? (
        <Card><EmptyState icon={Building2} message="No businesses with open capacity right now. Propose your own, or check back." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <Card key={b.id}>
              <div className="flex h-full flex-col gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold text-ink">{b.name}</p>
                  <p className="text-sm text-ink-muted">{b.island}</p>
                </div>
                <Badge variant="blue" className="self-start">{b.business_type}</Badge>
                <p className="flex-1 text-base text-ink-muted">{b.pain_point}</p>
                <Button size="sm" onClick={() => setRequestBiz(b)}>Request this match</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {requestBiz && <RequestModal business={requestBiz} onClose={() => setRequestBiz(null)} onDone={() => { setRequestBiz(null); onChange() }} />}
      {proposeOpen && <ProposeModal onClose={() => setProposeOpen(false)} onDone={() => { setProposeOpen(false); onChange() }} />}
    </div>
  )
}

function RequestModal({ business, onClose, onDone }: { business: BusinessPartner; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<CapstoneType>('whatsapp_bot')
  const [pitch, setPitch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (pitch.trim().length < 100) return setError('Your pitch needs at least 100 characters.')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('request_capstone_match', {
      p_business_id: business.id,
      p_type: type,
      p_pitch: pitch.trim(),
    })
    setBusy(false)
    if (err) {
      if (err.message.includes('one_live_capstone') || err.code === '23505') setError('You already have an active capstone.')
      else if (err.message.includes('business_full')) setError('This business just filled up. Try another.')
      else setError('Could not request the match. Please try again.')
      return
    }
    onDone()
  }

  return (
    <Modal title={`Request: ${business.name}`} open onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">Project type</p>
          {CAPSTONE_TYPES.map((t) => (
            <label key={t} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-base ${type === t ? 'border-svgblue-500 bg-svgblue-50 text-svgblue-700' : 'border-line text-ink hover:border-svgblue-500'}`}>
              <input type="radio" name="capstone-type" checked={type === t} onChange={() => setType(t)} className="h-4 w-4" />
              {CAPSTONE_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pitch" className="text-sm font-medium text-ink">What would you build for them? (100+ chars)</label>
          <textarea id="pitch" rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
          <p className={`text-sm ${pitch.trim().length >= 100 ? 'text-svggreen-700' : 'text-ink-muted'}`}>{pitch.trim().length} / 100</p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button loading={busy} onClick={() => void submit()}>Send match request</Button>
      </div>
    </Modal>
  )
}

function ProposeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', business_type: BUSINESS_TYPES[0], community: '', island: ISLANDS[0], contact_name: '', email: '', whatsapp: '', pain_point: '', type: 'whatsapp_bot' as CapstoneType, pitch: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.contact_name.trim() || !form.email.trim() || !form.whatsapp.trim()) return setError('Fill in the business and contact details.')
    if (form.pain_point.trim().length < 100) return setError('Pain point needs 100+ characters.')
    if (form.pitch.trim().length < 100) return setError('Your pitch needs 100+ characters.')
    setBusy(true)
    setError(null)
    const { data: user } = await supabase.auth.getUser()
    // client-side id: a student cannot SELECT a pending business back via RLS
    const bizId = newId()
    const { error: bizErr } = await supabase
      .from('business_partners')
      .insert({ id: bizId, status: 'pending', name: form.name.trim(), business_type: form.business_type, community: form.community.trim() || '—', island: form.island, pain_point: form.pain_point.trim(), consent: true, proposed_by: user.user?.id })
    if (bizErr) { setBusy(false); return setError('Could not submit the business.') }
    const { error: contactErr } = await supabase.from('business_contacts').insert({ business_id: bizId, contact_name: form.contact_name.trim(), email: form.email.trim().toLowerCase(), whatsapp: form.whatsapp.trim() })
    if (contactErr) { setBusy(false); return setError('Saved the business, but the contact step failed. Try again.') }
    setBusy(false)
    onDone()
  }

  return (
    <Modal title="Propose your own business" open onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">Staff will vet the business before your match is approved.</p>
        <Input label="Business name" name="p-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select aria-label="Type" value={form.business_type} onChange={(e) => set('business_type', e.target.value)} className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink">
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select aria-label="Island" value={form.island} onChange={(e) => set('island', e.target.value)} className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink">
            {ISLANDS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <Input label="Contact name" name="p-contact" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" name="p-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="WhatsApp" name="p-wa" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-pain" className="text-sm font-medium text-ink">Their pain point (100+)</label>
          <textarea id="p-pain" rows={3} value={form.pain_point} onChange={(e) => set('pain_point', e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-pitch" className="text-sm font-medium text-ink">Your pitch (100+)</label>
          <textarea id="p-pitch" rows={3} value={form.pitch} onChange={(e) => set('pitch', e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button loading={busy} onClick={() => void submit()}>Submit for review</Button>
      </div>
    </Modal>
  )
}

// ---------- My capstone ----------

function MyCapstone({ project, reviews, onChange }: { project: CapstoneProject; reviews: CapstoneReview[]; onChange: () => void }) {
  const [business, setBusiness] = useState<BusinessPartner | null>(null)
  const [contact, setContact] = useState<{ contact_name: string; email: string; whatsapp: string } | null>(null)

  useEffect(() => {
    supabase.from('business_partners').select('*').eq('id', project.business_id).maybeSingle().then(({ data }) => setBusiness(data as BusinessPartner | null))
    if (['matched', 'submitted', 'changes_requested', 'verified'].includes(project.status)) {
      supabase.rpc('get_business_contact', { p_project_id: project.id }).then(({ data }) => {
        if (data && data.length > 0) setContact(data[0])
      })
    }
  }, [project.id, project.status, project.business_id])

  const currentStep = timelineIndex(project.status)
  const meta = CAPSTONE_STATUS_META[project.status]

  return (
    <div className="flex flex-col gap-6">
      {/* Verified celebration */}
      {project.status === 'verified' && (
        <Card className="bg-svggreen-100">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <PartyPopper className="h-12 w-12 text-svggold-600" aria-hidden="true" />
            <h2 className="font-heading text-2xl font-semibold text-svggreen-700">You built something real.</h2>
            <p className="text-base text-ink">Your showcase page is coming soon.</p>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <div className="flex items-center justify-between">
          {TIMELINE_STEPS.map((step, i) => {
            const done = currentStep > i
            const active = currentStep === i
            return (
              <div key={step.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                {done ? (
                  <CheckCircle2 className="h-6 w-6 text-svggreen-500" aria-hidden="true" />
                ) : active ? (
                  <CircleDot className="h-6 w-6 text-svgblue-500" aria-hidden="true" />
                ) : (
                  <CircleDot className="h-6 w-6 text-ink-muted opacity-40" aria-hidden="true" />
                )}
                <span className={`text-xs font-medium ${active ? 'text-svgblue-500' : done ? 'text-svggreen-700' : 'text-ink-muted'}`}>{step.label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Business + contact */}
      {business && (
        <Card header={business.name}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="blue">{business.business_type}</Badge>
              <Badge variant="neutral">{business.island}</Badge>
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </div>
            <p className="text-base text-ink-muted">{business.pain_point}</p>
            <div className="rounded-xl bg-surface-alt p-4">
              <p className="text-sm font-medium text-ink-muted">Your build</p>
              <p className="text-base text-ink">{CAPSTONE_TYPE_LABELS[project.type]}</p>
              <p className="mt-2 text-sm font-medium text-ink-muted">Your pitch</p>
              <p className="text-base text-ink">{project.pitch}</p>
            </div>
            {contact ? (
              <div className="rounded-xl bg-svggreen-100 p-4">
                <p className="text-sm font-medium text-svggreen-700">Your contact at {business.name}</p>
                <p className="text-base text-ink">{contact.contact_name} · {contact.whatsapp}</p>
                <a href={waLink(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 font-medium text-svggreen-700 underline">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" /> Message on WhatsApp
                </a>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Contact details unlock once staff approve your match.</p>
            )}
          </div>
        </Card>
      )}

      {/* Evidence form */}
      {(project.status === 'matched' || project.status === 'changes_requested') && (
        <EvidenceForm project={project} onDone={onChange} />
      )}

      {project.status === 'submitted' && (
        <Card>
          <div className="flex items-center gap-3">
            <Badge variant="gold">In verification</Badge>
            <p className="text-base text-ink">Your instructor is reviewing your evidence. You&apos;ll see feedback here.</p>
          </div>
        </Card>
      )}

      {/* Withdraw (pre-submission) */}
      {['requested', 'matched', 'changes_requested'].includes(project.status) && (
        <WithdrawButton projectId={project.id} onDone={onChange} />
      )}

      {/* Feedback history */}
      {reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Feedback history</h2>
          {reviews.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-2">
                <Badge variant={CAPSTONE_STATUS_META[r.decision]?.variant ?? 'neutral'}>{CAPSTONE_STATUS_META[r.decision]?.label ?? r.decision}</Badge>
                <span className="text-sm text-ink-muted">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-2"><Markdown source={r.feedback} /></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function WithdrawButton({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const withdraw = async () => {
    setBusy(true)
    await supabase.rpc('withdraw_capstone', { p_project_id: projectId })
    setBusy(false)
    onDone()
  }
  if (!confirm) {
    return <Button variant="ghost" size="sm" className="self-start text-ink-muted" onClick={() => setConfirm(true)}>Withdraw this capstone</Button>
  }
  return (
    <Card className="bg-surface-alt">
      <p className="text-base text-ink">Withdraw frees the business for another student and lets you request a different one. Sure?</p>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="text-danger" loading={busy} onClick={() => void withdraw()}>Yes, withdraw</Button>
        <Button variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button>
      </div>
    </Card>
  )
}

interface PendingFile { file: File; path?: string; uploading: boolean; error?: string }

function EvidenceForm({ project, onDone }: { project: CapstoneProject; onDone: () => void }) {
  const { profile } = useAuth()
  const [videoUrl, setVideoUrl] = useState(project.video_url ?? '')
  const [liveProof, setLiveProof] = useState(project.live_proof ?? '')
  const [narrative, setNarrative] = useState(project.narrative ?? '')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const proofMeta = LIVE_PROOF_META[project.type]

  const addFiles = async (list: FileList) => {
    setError(null)
    const incoming = Array.from(list)
    if (files.length + incoming.length > MAX_FILES) return setError(`At most ${MAX_FILES} files.`)
    for (const file of incoming) {
      const invalid = validateFile(file)
      if (invalid) { setError(invalid); continue }
      const entry: PendingFile = { file, uploading: true }
      setFiles((p) => [...p, entry])
      const result = await uploadSubmissionFile(profile!.id, `capstone-${project.id}`, file)
      setFiles((p) => p.map((f) => f === entry ? ('path' in result ? { ...f, uploading: false, path: result.path } : { ...f, uploading: false, error: result.error }) : f))
    }
  }

  const submit = async () => {
    if (!/^https:\/\//i.test(videoUrl.trim())) return setError('Video URL must start with https://')
    if (liveProof.trim().length < 5) return setError('Live proof is required.')
    if (narrative.trim().length < 150) return setError('The description needs at least 150 characters.')
    if (files.some((f) => f.uploading)) return setError('Wait for uploads to finish.')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('submit_capstone_evidence', {
      p_project_id: project.id,
      p_video_url: videoUrl.trim(),
      p_live_proof: liveProof.trim(),
      p_narrative: narrative.trim(),
      p_file_paths: files.filter((f) => f.path).map((f) => f.path as string),
    })
    setBusy(false)
    if (err) return setError('Could not submit. Check your inputs and try again.')
    onDone()
  }

  return (
    <Card header={project.status === 'changes_requested' ? 'Resubmit your evidence' : 'Submit your deployment evidence'}>
      <div className="flex flex-col gap-4">
        <Input label="Video walkthrough URL (Loom/YouTube — show it working end to end)" name="video-url" placeholder="https://loom.com/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        <Input label={proofMeta.label} name="live-proof" placeholder={proofMeta.placeholder} value={liveProof} onChange={(e) => setLiveProof(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="narrative" className="text-sm font-medium text-ink">What it does &amp; the result for the business (150+ chars)</label>
          <textarea id="narrative" rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
          <p className={`text-sm ${narrative.trim().length >= 150 ? 'text-svggreen-700' : 'text-ink-muted'}`}>{narrative.trim().length} / 150</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer text-sm font-medium text-svgblue-500 underline">
            Add screenshots (optional, max {MAX_FILES})
            <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
          </label>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-ink">
              {f.file.name}{f.uploading && <Spinner size="sm" />}{f.path && <CheckCircle2 className="h-4 w-4 text-svggreen-500" />}{f.error && <span className="text-danger">{f.error}</span>}
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button loading={busy} onClick={() => void submit()}>{project.status === 'changes_requested' ? 'Resubmit evidence' : 'Submit for verification'}</Button>
      </div>
    </Card>
  )
}
