import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Pencil, Plus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Cohort, CohortStatus } from '../../lib/types'

const COHORT_STATUSES: CohortStatus[] = ['draft', 'open', 'running', 'completed']

const STATUS_VARIANT: Record<CohortStatus, 'blue' | 'gold' | 'green' | 'neutral'> = {
  draft: 'neutral',
  open: 'green',
  running: 'blue',
  completed: 'gold',
}

interface CohortForm {
  name: string
  start_date: string
  end_date: string
  capacity: string
  status: CohortStatus
}

const EMPTY_FORM: CohortForm = {
  name: '',
  start_date: '',
  end_date: '',
  capacity: '30',
  status: 'draft',
}

export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cohort | null>(null)
  const [form, setForm] = useState<CohortForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: cohortRows }, { data: enrollmentRows }] = await Promise.all([
      supabase.from('cohorts').select('*').order('start_date', { ascending: true }),
      supabase.from('enrollments').select('cohort_id').eq('status', 'active'),
    ])
    setCohorts(cohortRows ?? [])
    const map: Record<string, number> = {}
    for (const row of enrollmentRows ?? []) {
      map[row.cohort_id] = (map[row.cohort_id] ?? 0) + 1
    }
    setCounts(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (cohort: Cohort) => {
    setEditing(cohort)
    setForm({
      name: cohort.name,
      start_date: cohort.start_date,
      end_date: cohort.end_date,
      capacity: String(cohort.capacity),
      status: cohort.status,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const capacity = Number(form.capacity)
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setFormError('Name, start date, and end date are required.')
      return
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setFormError('Capacity must be a positive number.')
      return
    }
    if (form.end_date < form.start_date) {
      setFormError('End date must be after the start date.')
      return
    }
    setSaving(true)
    setFormError(null)
    const values = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      capacity,
      status: form.status,
    }
    const { error } = editing
      ? await supabase.from('cohorts').update(values).eq('id', editing.id)
      : await supabase.from('cohorts').insert(values)
    setSaving(false)
    if (error) {
      setFormError('Could not save the cohort. Please try again.')
      return
    }
    setModalOpen(false)
    void load()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cohorts"
        description="Create and manage program cohorts."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Cohort
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : cohorts.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            message="No cohorts yet. Create the first one."
            action={<Button onClick={openCreate}>New Cohort</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {cohorts.map((cohort) => {
            const enrolled = counts[cohort.id] ?? 0
            const pct = Math.min(100, Math.round((enrolled / cohort.capacity) * 100))
            const nearFull = pct >= 90
            return (
              <Card key={cohort.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl font-semibold text-ink">{cohort.name}</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {cohort.start_date} → {cohort.end_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[cohort.status]}>{cohort.status}</Badge>
                    <button
                      type="button"
                      aria-label={`Edit ${cohort.name}`}
                      onClick={() => openEdit(cohort)}
                      className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50 hover:text-svgblue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-svgblue-500"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">
                      {enrolled} / {cohort.capacity} enrolled
                    </span>
                    <span className="text-ink-muted">{pct}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-svgblue-100">
                    <div
                      className={`h-full transition-all duration-200 ${nearFull ? 'bg-svggold-500' : 'bg-svggreen-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        title={editing ? 'Edit cohort' : 'New cohort'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Name"
            name="cohort-name"
            placeholder="Cohort 1 — 2026"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Start date"
              name="cohort-start"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              label="End date"
              name="cohort-end"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <Input
            label="Capacity"
            name="cohort-capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="cohort-status" className="text-sm font-medium text-ink">
              Status
            </label>
            <select
              id="cohort-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CohortStatus }))}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            >
              {COHORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <Button type="submit" loading={saving}>
            {editing ? 'Save changes' : 'Create cohort'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
