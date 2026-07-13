import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, CalendarDays, Hash, Plus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Cohort, Course, Room } from '../../lib/types'

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [unlinked, setUnlinked] = useState<Cohort[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [linkId, setLinkId] = useState('')
  const [linking, setLinking] = useState(false)
  const [courseModal, setCourseModal] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [creatingCourse, setCreatingCourse] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: roomRow }, { data: cohortRows }, { data: courseRows }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
      supabase.from('cohorts').select('*').order('start_date'),
      supabase.from('courses').select('*').eq('room_id', id).order('created_at'),
    ])
    setRoom(roomRow)
    setCohorts((cohortRows ?? []).filter((c) => c.room_id === id))
    setUnlinked((cohortRows ?? []).filter((c) => !c.room_id))
    setCourses(courseRows ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const linkCohort = async () => {
    if (!linkId || !id) return
    setLinking(true)
    await supabase.from('cohorts').update({ room_id: id }).eq('id', linkId)
    setLinking(false)
    setLinkId('')
    void load()
  }

  const createCourse = async () => {
    if (!courseTitle.trim() || !id) return
    setCreatingCourse(true)
    await supabase.from('courses').insert({ room_id: id, title: courseTitle.trim() })
    setCreatingCourse(false)
    setCourseModal(false)
    setCourseTitle('')
    void load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!room) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          message="Room not found."
          action={
            <Link to="/admin/rooms">
              <Button>Back to rooms</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={room.name}
        description={room.description ?? undefined}
        action={<Badge variant={room.status === 'active' ? 'green' : 'neutral'}>{room.status}</Badge>}
      />

      {/* Cohorts */}
      <section aria-label="Cohorts" className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl font-semibold text-ink">Cohorts</h2>
        {cohorts.length === 0 ? (
          <Card>
            <EmptyState icon={CalendarDays} message="No cohorts linked to this room yet." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cohorts.map((cohort) => (
              <Card key={cohort.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{cohort.name}</p>
                    <p className="text-sm text-ink-muted">
                      {cohort.start_date} → {cohort.end_date}
                    </p>
                  </div>
                  <Badge variant={cohort.status === 'open' ? 'green' : 'neutral'}>{cohort.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
        {unlinked.length > 0 && (
          <Card header="Link a cohort">
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                aria-label="Cohort to link"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
              >
                <option value="">Choose an unlinked cohort…</option>
                {unlinked.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button disabled={!linkId} loading={linking} onClick={() => void linkCohort()}>
                Link cohort
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Courses */}
      <section aria-label="Courses" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-ink">Courses</h2>
          <Button size="sm" onClick={() => setCourseModal(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Course
          </Button>
        </div>
        {courses.length === 0 ? (
          <Card>
            <EmptyState icon={BookOpen} message="No courses yet." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/courses/${course.id}`}
                      className="font-heading text-base font-semibold text-ink hover:text-svgblue-500"
                    >
                      {course.title}
                    </Link>
                    {course.description && (
                      <p className="truncate text-sm text-ink-muted">{course.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={course.status === 'published' ? 'green' : 'neutral'}>
                      {course.status}
                    </Badge>
                    <Link to={`/admin/courses/${course.id}`}>
                      <Button variant="secondary" size="sm">
                        Open builder
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Channels */}
      <ChannelsSection roomId={room.id} />

      <Modal title="New course" open={courseModal} onClose={() => setCourseModal(false)}>
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            name="course-title"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
          />
          <Button disabled={!courseTitle.trim()} loading={creatingCourse} onClick={() => void createCourse()}>
            Create course
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function ChannelsSection({ roomId }: { roomId: string }) {
  const [channels, setChannels] = useState<{ id: string; name: string; description: string | null; archived: boolean }[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('channels').select('id, name, description, archived').eq('room_id', roomId).order('created_at')
    setChannels(data ?? [])
  }, [roomId])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    const clean = name.trim().toLowerCase()
    if (!/^[a-z0-9-]{2,32}$/.test(clean)) { setError('Name must be lowercase letters, numbers, hyphens (2-32).'); return }
    setSaving(true)
    const { error: err } = await supabase.from('channels').insert({ room_id: roomId, name: clean, description: description.trim() || null })
    setSaving(false)
    if (err) { setError(err.code === '23505' ? 'A channel with that name exists.' : 'Could not create.'); return }
    setModalOpen(false); setName(''); setDescription(''); setError(null)
    void load()
  }

  const rename = async (id: string, current: string) => {
    const next = prompt('Rename channel to (lowercase, hyphens):', current)
    if (!next) return
    const clean = next.trim().toLowerCase()
    if (!/^[a-z0-9-]{2,32}$/.test(clean)) return
    await supabase.from('channels').update({ name: clean }).eq('id', id)
    void load()
  }

  const toggleArchive = async (id: string, archived: boolean) => {
    await supabase.from('channels').update({ archived: !archived }).eq('id', id)
    void load()
  }

  return (
    <section aria-label="Channels" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold text-ink">Community channels</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New Channel</Button>
      </div>
      {channels.length === 0 ? (
        <Card><EmptyState icon={Hash} message="No channels yet." /></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {channels.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  <div>
                    <p className="font-heading text-base font-semibold text-ink">{c.name}{c.archived ? ' (archived)' : ''}</p>
                    {c.description && <p className="text-sm text-ink-muted">{c.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void rename(c.id, c.name)}>Rename</Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleArchive(c.id, c.archived)}>{c.archived ? 'Unarchive' : 'Archive'}</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title="New channel" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="flex flex-col gap-4">
          <Input label="Name (lowercase, hyphens)" name="channel-name" placeholder="announcements" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" name="channel-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button loading={saving} onClick={() => void create()}>Create channel</Button>
        </div>
      </Modal>
    </section>
  )
}
