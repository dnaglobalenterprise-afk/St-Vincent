import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, School } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Room, RoomStatus } from '../../lib/types'

const STATUS_VARIANT: Record<RoomStatus, 'green' | 'neutral' | 'gold'> = {
  active: 'green',
  draft: 'neutral',
  archived: 'gold',
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface RoomForm {
  name: string
  slug: string
  description: string
  status: RoomStatus
}

const EMPTY: RoomForm = { name: '', slug: '', description: '', status: 'draft' }

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [cohortCounts, setCohortCounts] = useState<Record<string, number>>({})
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState<RoomForm>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: roomRows }, { data: cohortRows }, { data: courseRows }] = await Promise.all([
      supabase.from('rooms').select('*').order('created_at'),
      supabase.from('cohorts').select('room_id'),
      supabase.from('courses').select('room_id'),
    ])
    setRooms(roomRows ?? [])
    const cc: Record<string, number> = {}
    for (const r of cohortRows ?? []) if (r.room_id) cc[r.room_id] = (cc[r.room_id] ?? 0) + 1
    setCohortCounts(cc)
    const kc: Record<string, number> = {}
    for (const r of courseRows ?? []) kc[r.room_id] = (kc[r.room_id] ?? 0) + 1
    setCourseCounts(kc)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setSlugTouched(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    setForm({
      name: room.name,
      slug: room.slug,
      description: room.description ?? '',
      status: room.status,
    })
    setSlugTouched(true)
    setFormError(null)
    setModalOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || !form.slug.trim() || !form.description.trim()) {
      setFormError('Name, slug, and description are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    const values = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      status: form.status,
    }
    const { error } = editing
      ? await supabase.from('rooms').update(values).eq('id', editing.id)
      : await supabase.from('rooms').insert(values)
    setSaving(false)
    if (error) {
      setFormError(error.code === '23505' ? 'That slug is already in use.' : 'Could not save the room.')
      return
    }
    setModalOpen(false)
    void load()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Rooms"
        description="Each room is a school. Schools 2-4 activate here later with a single room."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Room
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState icon={School} message="No rooms yet." action={<Button onClick={openCreate}>New Room</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/admin/rooms/${room.id}`}
                    className="font-heading text-xl font-semibold text-ink hover:text-svgblue-500"
                  >
                    {room.name}
                  </Link>
                  <p className="text-sm text-ink-muted">/{room.slug}</p>
                </div>
                <Badge variant={STATUS_VARIANT[room.status]}>{room.status}</Badge>
              </div>
              {room.description && <p className="mt-3 text-base text-ink-muted">{room.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-ink-muted">
                  {cohortCounts[room.id] ?? 0} cohorts · {courseCounts[room.id] ?? 0} courses
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(room)}>
                    Edit
                  </Button>
                  <Link to={`/admin/rooms/${room.id}`}>
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title={editing ? 'Edit room' : 'New room'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Name"
            name="room-name"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }))
            }}
          />
          <Input
            label="Slug"
            name="room-slug"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true)
              setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
            }}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="room-description" className="text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="room-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            />
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="room-status" className="text-sm font-medium text-ink">
              Status
            </label>
            <select
              id="room-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <Button type="submit" loading={saving}>
            {editing ? 'Save changes' : 'Create room'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
