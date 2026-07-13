import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ExternalLink, Plus, Radio, Video } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Cohort, LiveClass, LiveClassMode, Profile, Recording, Room } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { ClassStatusBadge } from './ClassStatusBadge'
import { GoLivePanel } from './GoLivePanel'
import { astInputToUtcIso, formatAst, utcIsoToAstInputs } from './classtime'

type Tab = 'upcoming' | 'past' | 'cancelled'

interface ClassForm {
  title: string
  description: string
  room_id: string
  cohort_id: string
  date: string
  time: string
  duration_minutes: string
  mode: LiveClassMode
  meeting_url: string
  host_id: string
}

export function ClassesAdminPage() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LiveClass | null>(null)
  const [form, setForm] = useState<ClassForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailClass, setDetailClass] = useState<LiveClass | null>(null)
  const [cancelClass, setCancelClass] = useState<LiveClass | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: cls }, { data: rm }, { data: ch }, { data: st }] = await Promise.all([
      supabase.from('live_classes').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('rooms').select('*').eq('status', 'active').order('name'),
      supabase.from('cohorts').select('*').order('name'),
      supabase.from('profiles').select('*').in('role', ['admin', 'instructor']),
    ])
    setClasses((cls ?? []) as LiveClass[])
    setRooms((rm ?? []) as Room[])
    setCohorts((ch ?? []) as Cohort[])
    setStaff((st ?? []) as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const staffName = (id: string) => {
    const p = staff.find((s) => s.id === id)
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email : ''
  }
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? ''
  const cohortName = (id: string | null) => (id ? cohorts.find((c) => c.id === id)?.name ?? '' : 'All cohorts')

  const filtered = useMemo(() => {
    const now = Date.now()
    return classes.filter((c) => {
      const end = new Date(c.scheduled_at).getTime() + c.duration_minutes * 60_000
      if (tab === 'cancelled') return c.status === 'cancelled'
      if (c.status === 'cancelled') return false
      if (tab === 'past') return end < now || c.status === 'ended'
      return end >= now && c.status !== 'ended'
    })
  }, [classes, tab])

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      room_id: rooms[0]?.id ?? '',
      cohort_id: '',
      date: '',
      time: '',
      duration_minutes: '90',
      mode: 'external',
      meeting_url: '',
      host_id: profile?.id ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (c: LiveClass) => {
    setEditing(c)
    const { date, time } = utcIsoToAstInputs(c.scheduled_at)
    setForm({
      title: c.title,
      description: c.description ?? '',
      room_id: c.room_id,
      cohort_id: c.cohort_id ?? '',
      date,
      time,
      duration_minutes: String(c.duration_minutes),
      mode: c.mode,
      meeting_url: c.meeting_url ?? '',
      host_id: c.host_id,
    })
    setError(null)
    setModalOpen(true)
  }

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim() || !form.room_id || !form.date || !form.time) {
      setError('Title, room, date, and time are required.')
      return
    }
    if (form.mode === 'external' && !form.meeting_url.trim()) {
      setError('External classes need a meeting URL.')
      return
    }
    setSaving(true)
    setError(null)
    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      room_id: form.room_id,
      cohort_id: form.cohort_id || null,
      scheduled_at: astInputToUtcIso(form.date, form.time),
      duration_minutes: Number(form.duration_minutes) || 90,
      mode: form.mode,
      meeting_url: form.mode === 'external' ? form.meeting_url.trim() : null,
      host_id: form.host_id || profile!.id,
    }
    let classId = editing?.id
    if (editing) {
      const { error: err } = await supabase.from('live_classes').update(values).eq('id', editing.id)
      if (err) {
        setSaving(false)
        setError('Could not save the class.')
        return
      }
    } else {
      const { data, error: err } = await supabase.from('live_classes').insert(values).select('id').single()
      if (err || !data) {
        setSaving(false)
        setError('Could not create the class.')
        return
      }
      classId = data.id
    }
    // Embedded mode: provision the Mux live stream
    if (values.mode === 'embedded' && classId) {
      await supabase.functions.invoke('mux-create-live', { body: { class_id: classId } })
    }
    setSaving(false)
    setModalOpen(false)
    void load()
  }

  const doCancel = async () => {
    if (!cancelClass || !cancelReason.trim()) return
    await supabase
      .from('live_classes')
      .update({ status: 'cancelled', cancel_reason: cancelReason.trim() })
      .eq('id', cancelClass.id)
    setCancelClass(null)
    setCancelReason('')
    void load()
  }

  const setStatus = async (c: LiveClass, status: 'live' | 'ended') => {
    await supabase.from('live_classes').update({ status }).eq('id', c.id)
    setToast(status === 'live' ? 'Marked live.' : 'Marked ended.')
    setTimeout(() => setToast(null), 3000)
    void load()
    setDetailClass((prev) => (prev ? { ...prev, status } : prev))
  }

  const roomCohorts = form ? cohorts.filter((c) => c.room_id === form.room_id) : []

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-svggreen-100 px-5 py-3 text-base font-medium text-svggreen-700 shadow-card">
          {toast}
        </div>
      )}
      <PageHeader
        title="Live Classes"
        description="Schedule sessions, go live, and manage recordings."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Class
          </Button>
        }
      />

      <div className="flex gap-2">
        {(['upcoming', 'past', 'cancelled'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-base font-medium capitalize ${
              tab === t ? 'bg-svgblue-500 text-white' : 'bg-surface-alt text-ink hover:bg-svgblue-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Video} message={`No ${tab} classes.`} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {c.mode === 'embedded' ? (
                      <Video className="h-4 w-4 text-svgblue-500" aria-hidden="true" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-svgblue-500" aria-hidden="true" />
                    )}
                    <h3
                      className={`font-heading text-lg font-semibold text-ink ${c.status === 'cancelled' ? 'line-through' : ''}`}
                    >
                      {c.title}
                    </h3>
                    <ClassStatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-ink-muted">
                    {roomName(c.room_id)} · <Badge variant="neutral">{cohortName(c.cohort_id)}</Badge>
                  </p>
                  <p className="text-sm text-ink">
                    {formatAst(c.scheduled_at)} · {c.duration_minutes} min · Host {staffName(c.host_id)}
                  </p>
                  {c.status === 'cancelled' && c.cancel_reason && (
                    <p className="text-sm text-warning">Cancelled: {c.cancel_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setDetailClass(c)}>
                    {c.mode === 'embedded' ? 'Go live' : 'Manage'}
                  </Button>
                  {c.status !== 'cancelled' && c.status !== 'ended' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-svggold-100"
                        onClick={() => setCancelClass(c)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/edit modal */}
      {form && (
        <Modal title={editing ? 'Edit class' : 'New class'} open={modalOpen} onClose={() => setModalOpen(false)}>
          <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" noValidate>
            <Input label="Title" name="class-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="class-desc" className="text-sm font-medium text-ink">
                Description (markdown, shown to students)
              </label>
              <textarea
                id="class-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="class-room" className="text-sm font-medium text-ink">Room</label>
                <select id="class-room" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value, cohort_id: '' })}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="class-cohort" className="text-sm font-medium text-ink">Cohort (optional)</label>
                <select id="class-cohort" value={form.cohort_id} onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
                  <option value="">All cohorts in room</option>
                  {roomCohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Date (AST)" name="class-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Input label="Start time (AST)" name="class-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              <Input label="Duration (min)" name="class-duration" type="number" min={15} max={480} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">Mode</p>
              <label className="flex items-center gap-2 text-base text-ink">
                <input type="radio" checked={form.mode === 'external'} onChange={() => setForm({ ...form, mode: 'external' })} className="h-4 w-4" />
                External meeting link (Zoom / Google Meet)
              </label>
              {form.mode === 'external' && (
                <Input name="class-url" aria-label="Meeting URL" placeholder="https://meet.google.com/…" value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} />
              )}
              <label className="flex items-center gap-2 text-base text-ink">
                <input type="radio" checked={form.mode === 'embedded'} onChange={() => setForm({ ...form, mode: 'embedded' })} className="h-4 w-4" />
                Embedded live stream (OBS)
              </label>
              {form.mode === 'embedded' && (
                <p className="text-sm text-ink-muted">A Mux live stream is provisioned on save; broadcast via OBS from the Go-live panel.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="class-host" className="text-sm font-medium text-ink">Host</label>
              <select id="class-host" value={form.host_id} onChange={(e) => setForm({ ...form, host_id: e.target.value })}
                className="rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500">
                {staff.map((s) => <option key={s.id} value={s.id}>{[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={saving}>{editing ? 'Save class' : 'Create class'}</Button>
          </form>
        </Modal>
      )}

      {/* Detail / go-live drawer */}
      {detailClass && (
        <Modal title={detailClass.title} open onClose={() => setDetailClass(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">{formatAst(detailClass.scheduled_at)} · {detailClass.duration_minutes} min</p>
            {detailClass.mode === 'embedded' ? (
              <GoLivePanel classId={detailClass.id} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-base text-ink">External meeting:</p>
                <a href={detailClass.meeting_url ?? '#'} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-svgblue-500 underline">
                  {detailClass.meeting_url}
                </a>
                <ExternalWrapUp classId={detailClass.id} roomId={detailClass.room_id} title={detailClass.title} onDone={() => { setDetailClass(null); void load() }} />
              </div>
            )}
            <div className="flex gap-2 border-t border-line pt-4">
              <Button variant="secondary" size="sm" onClick={() => void setStatus(detailClass, 'live')}>
                <Radio className="h-4 w-4" aria-hidden="true" /> Mark live
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void setStatus(detailClass, 'ended')}>Mark ended</Button>
            </div>
            <ClassRecordings classId={detailClass.id} roomId={detailClass.room_id} onToast={(t) => { setToast(t); setTimeout(() => setToast(null), 3500) }} />
            <AttendeeList classId={detailClass.id} />
          </div>
        </Modal>
      )}

      {/* Cancel modal */}
      {cancelClass && (
        <Modal title="Cancel class?" open onClose={() => setCancelClass(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-base text-ink">Students will see this class greyed out with your reason.</p>
            <Input label="Reason (shown to students)" name="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <Button className="text-danger" variant="ghost" disabled={!cancelReason.trim()} onClick={() => void doCancel()}>Confirm cancellation</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function AttendeeList({ classId }: { classId: string }) {
  const [names, setNames] = useState<{ name: string; at: string }[]>([])
  useEffect(() => {
    supabase
      .from('class_attendance')
      .select('joined_at, user_id')
      .eq('class_id', classId)
      .order('joined_at')
      .then(async ({ data }) => {
        const rows = data ?? []
        const ids = [...new Set(rows.map((r) => r.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', ids.length ? ids : ['x'])
        const nameById = new Map(
          (profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email]),
        )
        setNames(rows.map((r) => ({ name: nameById.get(r.user_id) ?? 'Student', at: r.joined_at })))
      })
  }, [classId])
  return (
    <div className="border-t border-line pt-4">
      <p className="text-sm font-medium text-ink">Attendance ({names.length})</p>
      {names.length === 0 ? (
        <p className="text-sm text-ink-muted">No joins yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {names.map((n, i) => (
            <li key={i} className="text-sm text-ink">
              {n.name} <span className="text-ink-muted">· {new Date(n.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ClassRecordings({ classId, roomId, onToast }: { classId: string; roomId: string; onToast: (t: string) => void }) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [modules, setModules] = useState<{ id: string; title: string }[]>([])

  const load = useCallback(async () => {
    const [{ data: recs }, { data: courses }] = await Promise.all([
      supabase.from('recordings').select('*').eq('class_id', classId).eq('status', 'ready'),
      supabase.from('courses').select('id').eq('room_id', roomId),
    ])
    setRecordings((recs ?? []) as Recording[])
    const courseIds = (courses ?? []).map((c) => c.id)
    if (courseIds.length) {
      const { data: mods } = await supabase.from('modules').select('id, title').in('course_id', courseIds).order('sort_order')
      setModules(mods ?? [])
    }
  }, [classId, roomId])

  useEffect(() => {
    void load()
  }, [load])

  const attach = async (rec: Recording, moduleId: string) => {
    // append a replay lesson at the end of the module
    const { data: last } = await supabase
      .from('lessons')
      .select('sort_order')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = (last?.sort_order ?? 0) + 1
    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        module_id: moduleId,
        type: 'replay',
        title: rec.title,
        sort_order: nextSort,
        required: false,
        published: true,
        mux_playback_id: rec.mux_playback_id,
        video_status: 'ready',
        duration_seconds: rec.duration_seconds,
      })
      .select('id')
      .single()
    if (error || !lesson) {
      onToast('Could not attach the recording.')
      return
    }
    await supabase
      .from('recordings')
      .update({ attached_lesson_ids: [...rec.attached_lesson_ids, moduleId] })
      .eq('id', rec.id)
    onToast('Added to the week as a replay lesson.')
    void load()
  }

  if (recordings.length === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm font-medium text-ink">Recordings</p>
      {recordings.map((rec) => (
        <div key={rec.id} className="rounded-xl bg-surface-alt px-4 py-3">
          <p className="text-base text-ink">{rec.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-muted">Add to week:</span>
            {modules.map((m) => {
              const attached = rec.attached_lesson_ids.includes(m.id)
              return (
                <Button
                  key={m.id}
                  variant="ghost"
                  size="sm"
                  disabled={attached}
                  onClick={() => void attach(rec, m.id)}
                >
                  {attached ? `${m.title} ✓` : m.title}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ExternalWrapUp({ classId, roomId, title, onDone }: { classId: string; roomId: string; title: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    // create recording row first (processing), then upload via the recording's own upload id
    const { data: rec, error: recErr } = await supabase
      .from('recordings')
      .insert({ room_id: roomId, class_id: classId, title: `${title} — recording`, status: 'processing' })
      .select('id')
      .single()
    if (recErr || !rec) {
      setUploading(false)
      setError('Could not create recording.')
      return
    }
    const { data, error: fnErr } = await supabase.functions.invoke('mux-create-upload', {
      body: { recording_id: rec.id },
    })
    if (fnErr || !data?.upload_url) {
      await supabase.from('recordings').delete().eq('id', rec.id)
      setUploading(false)
      setError('Could not start the upload. Check Mux configuration.')
      return
    }
    const put = await fetch(data.upload_url, { method: 'PUT', body: file })
    setUploading(false)
    if (!put.ok) {
      setError('Upload failed. Try again.')
      return
    }
    setDone(true)
    onDone()
  }

  if (done) return <p className="text-sm text-svggreen-700">Uploaded — processing on Mux.</p>
  return (
    <div className="mt-2 border-t border-line pt-3">
      <label className="cursor-pointer text-sm font-medium text-svgblue-500 underline">
        {uploading ? 'Uploading…' : 'Upload recording'}
        <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      </label>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}
