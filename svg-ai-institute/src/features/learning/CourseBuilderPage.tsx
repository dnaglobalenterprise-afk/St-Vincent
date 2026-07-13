import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Play,
  Plus,
  Trash2,
  UploadCloud,
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
import type { Course, Lesson, LessonType, Module, QuizQuestion, SubmissionKind } from '../../lib/types'
import { Markdown } from './Markdown'

const TYPE_ICONS: Record<LessonType, typeof Play> = {
  video: Play,
  text: FileText,
  quiz: HelpCircle,
  assignment: ClipboardCheck,
  replay: Play,
}

const SUBMISSION_KIND_LABELS: Record<SubmissionKind, string> = {
  link: 'Link (Make/n8n share URL, Loom, etc.)',
  text: 'Text write-up',
  file: 'File upload (screenshots, exports, PDFs)',
}

/** Swap sort_order between two rows without tripping the unique constraint. */
async function swapSort(
  table: 'modules' | 'lessons',
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
) {
  await supabase.from(table).update({ sort_order: -1 }).eq('id', a.id)
  await supabase.from(table).update({ sort_order: a.sort_order }).eq('id', b.id)
  await supabase.from(table).update({ sort_order: b.sort_order }).eq('id', a.id)
}

export function CourseBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [roomName, setRoomName] = useState('')
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  // course header editing
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [savingCourse, setSavingCourse] = useState(false)

  // module modal
  const [moduleModal, setModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleUnlockDate, setModuleUnlockDate] = useState('')
  const [savingModule, setSavingModule] = useState(false)

  // lesson editor modal
  const [lessonModal, setLessonModal] = useState<{ moduleId: string; lesson: Lesson | null } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: courseRow } = await supabase.from('courses').select('*').eq('id', id).maybeSingle()
    setCourse(courseRow)
    if (courseRow) {
      setTitle(courseRow.title)
      setDescription(courseRow.description ?? '')
      const [{ data: roomRow }, { data: moduleRows }] = await Promise.all([
        supabase.from('rooms').select('name').eq('id', courseRow.room_id).maybeSingle(),
        supabase.from('modules').select('*').eq('course_id', id).order('sort_order'),
      ])
      setRoomName(roomRow?.name ?? '')
      setModules(moduleRows ?? [])
      const moduleIds = (moduleRows ?? []).map((m) => m.id)
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds.length > 0 ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
        .order('sort_order')
      setLessons(lessonRows ?? [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const saveCourse = async (patch?: Partial<Course>) => {
    if (!course) return
    setSavingCourse(true)
    await supabase
      .from('courses')
      .update(patch ?? { title: title.trim(), description: description.trim() || null })
      .eq('id', course.id)
    setSavingCourse(false)
    void load()
  }

  const openModuleModal = (module: Module | null) => {
    setEditingModule(module)
    setModuleTitle(module?.title ?? '')
    setModuleUnlockDate(module?.unlock_date ?? '')
    setModuleModal(true)
  }

  const saveModule = async () => {
    if (!course || !moduleTitle.trim()) return
    setSavingModule(true)
    if (editingModule) {
      await supabase
        .from('modules')
        .update({ title: moduleTitle.trim(), unlock_date: moduleUnlockDate || null })
        .eq('id', editingModule.id)
    } else {
      const nextSort = Math.max(0, ...modules.map((m) => m.sort_order)) + 1
      await supabase.from('modules').insert({
        course_id: course.id,
        title: moduleTitle.trim(),
        sort_order: nextSort,
        unlock_date: moduleUnlockDate || null,
      })
    }
    setSavingModule(false)
    setModuleModal(false)
    void load()
  }

  const moveModule = async (index: number, dir: -1 | 1) => {
    const other = modules[index + dir]
    if (!other) return
    await swapSort('modules', modules[index], other)
    void load()
  }

  const moveLesson = async (moduleLessons: Lesson[], index: number, dir: -1 | 1) => {
    const other = moduleLessons[index + dir]
    if (!other) return
    await swapSort('lessons', moduleLessons[index], other)
    void load()
  }

  const toggleLesson = async (lesson: Lesson, field: 'required' | 'published') => {
    const patch = field === 'required' ? { required: !lesson.required } : { published: !lesson.published }
    await supabase.from('lessons').update(patch).eq('id', lesson.id)
    void load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!course) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          message="Course not found."
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
        title="Course builder"
        description={`Room: ${roomName}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={course.status === 'published' ? 'green' : 'neutral'}>{course.status}</Badge>
            <Button
              variant="secondary"
              size="sm"
              loading={savingCourse}
              onClick={() =>
                void saveCourse({ status: course.status === 'published' ? 'draft' : 'published' })
              }
            >
              {course.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        }
      />

      <Card header="Course details">
        <div className="flex flex-col gap-4">
          <Input label="Title" name="course-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="course-description" className="text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="course-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            />
          </div>
          <Button className="self-start" size="sm" loading={savingCourse} onClick={() => void saveCourse()}>
            Save details
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-4" aria-label="Modules">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-ink">Modules</h2>
          <Button size="sm" onClick={() => openModuleModal(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add module
          </Button>
        </div>

        {modules.map((module, mi) => {
          const moduleLessons = lessons.filter((l) => l.module_id === module.id)
          const requiredCount = moduleLessons.filter((l) => l.required).length
          return (
            <Card key={module.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-base font-semibold text-ink">{module.title}</h3>
                  <p className="text-sm text-ink-muted">
                    {moduleLessons.length} lessons · {requiredCount} required
                    {module.unlock_date ? ` · unlocks ${module.unlock_date}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={mi === 0}
                    onClick={() => void moveModule(mi, -1)}
                    className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50 hover:text-svgblue-500 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={mi === modules.length - 1}
                    onClick={() => void moveModule(mi, 1)}
                    className="rounded-xl p-1.5 text-ink-muted hover:bg-svgblue-50 hover:text-svgblue-500 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => openModuleModal(module)}>
                    Edit
                  </Button>
                </div>
              </div>

              <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                {moduleLessons.map((lesson, li) => {
                  const Icon = TYPE_ICONS[lesson.type]
                  return (
                    <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-alt px-3 py-2">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left"
                        onClick={() => setLessonModal({ moduleId: module.id, lesson })}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-svgblue-500" aria-hidden="true" />
                        <span className="truncate text-base font-medium text-ink hover:text-svgblue-500">
                          {lesson.title}
                        </span>
                        {lesson.type === 'video' && lesson.video_status !== 'none' && (
                          <Badge variant={lesson.video_status === 'ready' ? 'green' : lesson.video_status === 'errored' ? 'warning' : 'gold'}>
                            {lesson.video_status}
                          </Badge>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                          <input
                            type="checkbox"
                            checked={lesson.required}
                            onChange={() => void toggleLesson(lesson, 'required')}
                            className="h-3.5 w-3.5"
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                          <input
                            type="checkbox"
                            checked={lesson.published}
                            onChange={() => void toggleLesson(lesson, 'published')}
                            className="h-3.5 w-3.5"
                          />
                          Published
                        </label>
                        <button
                          type="button"
                          aria-label="Move lesson up"
                          disabled={li === 0}
                          onClick={() => void moveLesson(moduleLessons, li, -1)}
                          className="rounded p-1 text-ink-muted hover:text-svgblue-500 disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move lesson down"
                          disabled={li === moduleLessons.length - 1}
                          onClick={() => void moveLesson(moduleLessons, li, 1)}
                          className="rounded p-1 text-ink-muted hover:text-svgblue-500 disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setLessonModal({ moduleId: module.id, lesson: null })}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Lesson
              </Button>
            </Card>
          )
        })}
      </section>

      {/* Module modal */}
      <Modal
        title={editingModule ? 'Edit module' : 'Add module'}
        open={moduleModal}
        onClose={() => setModuleModal(false)}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            name="module-title"
            placeholder="Week 1 — AI Fundamentals"
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
          />
          <Input
            label="Unlock date (optional — empty means completion-gated only)"
            name="module-unlock"
            type="date"
            value={moduleUnlockDate}
            onChange={(e) => setModuleUnlockDate(e.target.value)}
          />
          <Button disabled={!moduleTitle.trim()} loading={savingModule} onClick={() => void saveModule()}>
            {editingModule ? 'Save module' : 'Add module'}
          </Button>
        </div>
      </Modal>

      {/* Lesson editor modal */}
      {lessonModal && (
        <LessonEditor
          moduleId={lessonModal.moduleId}
          lesson={lessonModal.lesson}
          existingCount={lessons.filter((l) => l.module_id === lessonModal.moduleId).length}
          onClose={() => setLessonModal(null)}
          onSaved={() => {
            setLessonModal(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Lesson editor (type picker + per-type editors)
// ============================================================

interface EditorQuestion {
  id?: string
  prompt: string
  options: string[]
  correct_idx: number
}

function LessonEditor({
  moduleId,
  lesson,
  existingCount,
  onClose,
  onSaved,
}: {
  moduleId: string
  lesson: Lesson | null
  existingCount: number
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<LessonType | null>(lesson?.type ?? null)
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [body, setBody] = useState(lesson?.body_markdown ?? '')
  const [required, setRequired] = useState(lesson?.required ?? true)
  const [threshold, setThreshold] = useState(String(lesson?.pass_threshold ?? 70))
  const [submissionKinds, setSubmissionKinds] = useState<SubmissionKind[]>(
    (lesson?.submission_kinds as SubmissionKind[]) ?? [],
  )
  const [preview, setPreview] = useState(false)
  const [questions, setQuestions] = useState<EditorQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [videoState, setVideoState] = useState(lesson?.video_status ?? 'none')
  const playbackId = lesson?.mux_playback_id ?? null

  useEffect(() => {
    if (lesson?.type === 'quiz') {
      supabase
        .from('quiz_questions')
        .select('*')
        .eq('lesson_id', lesson.id)
        .order('sort_order')
        .then(({ data }) => {
          setQuestions(
            (data ?? []).map((q: QuizQuestion) => ({
              id: q.id,
              prompt: q.prompt,
              options: q.options,
              correct_idx: q.correct_idx,
            })),
          )
        })
    }
  }, [lesson])

  const save = async () => {
    if (!type || !title.trim()) {
      setError('A title is required.')
      return
    }
    if (type === 'text' && !body.trim()) {
      setError('Text lessons need a body.')
      return
    }
    if (type === 'assignment') {
      if (!body.trim()) {
        setError('Assignments need instructions.')
        return
      }
      if (submissionKinds.length === 0) {
        setError('Choose at least one accepted submission kind.')
        return
      }
    }
    if (type === 'quiz') {
      if (questions.length === 0) {
        setError('Add at least one question.')
        return
      }
      for (const q of questions) {
        if (!q.prompt.trim() || q.options.length < 2 || q.options.some((o) => !o.trim())) {
          setError('Every question needs a prompt and 2-6 filled options.')
          return
        }
      }
    }
    setSaving(true)
    setError(null)

    let lessonId = lesson?.id
    const base = {
      title: title.trim(),
      required,
      body_markdown: type !== 'quiz' ? body || null : null,
      pass_threshold: type === 'quiz' ? Number(threshold) || 70 : null,
      submission_kinds: type === 'assignment' ? submissionKinds : [],
    }
    if (lessonId) {
      const { error: err } = await supabase.from('lessons').update(base).eq('id', lessonId)
      if (err) {
        setSaving(false)
        setError('Could not save the lesson.')
        return
      }
    } else {
      const { data, error: err } = await supabase
        .from('lessons')
        .insert({ module_id: moduleId, type, sort_order: existingCount + 1, ...base })
        .select('id')
        .single()
      if (err || !data) {
        setSaving(false)
        setError('Could not create the lesson.')
        return
      }
      lessonId = data.id
    }

    if (type === 'quiz' && lessonId) {
      await supabase.from('quiz_questions').delete().eq('lesson_id', lessonId)
      const { error: qErr } = await supabase.from('quiz_questions').insert(
        questions.map((q, i) => ({
          lesson_id: lessonId,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correct_idx: q.correct_idx,
          sort_order: i + 1,
        })),
      )
      if (qErr) {
        setSaving(false)
        setError('Could not save the questions.')
        return
      }
    }
    setSaving(false)
    onSaved()
  }

  const uploadVideo = async (file: File) => {
    if (!lesson) {
      setError('Save the lesson first, then upload the video.')
      return
    }
    setUploading(true)
    setError(null)
    const { data, error: fnErr } = await supabase.functions.invoke('mux-create-upload', {
      body: { lesson_id: lesson.id },
    })
    if (fnErr || !data?.upload_url) {
      let message = 'Upload setup failed.'
      try {
        const ctx = await (fnErr as { context?: Response })?.context?.json()
        if (ctx?.error) message = ctx.error
      } catch {
        // keep generic
      }
      setUploading(false)
      setError(message)
      return
    }
    const put = await fetch(data.upload_url, { method: 'PUT', body: file })
    setUploading(false)
    if (!put.ok) {
      setError('Video upload failed. Try again.')
      return
    }
    setVideoState('processing')
  }

  if (!type) {
    return (
      <Modal title="Add lesson" open onClose={onClose}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['video', 'text', 'quiz', 'assignment'] as const).map((t) => {
            const Icon = TYPE_ICONS[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex flex-col items-center gap-2 rounded-xl border border-line px-4 py-6 text-ink hover:border-svgblue-500 hover:bg-svgblue-50"
              >
                <Icon className="h-6 w-6 text-svgblue-500" aria-hidden="true" />
                <span className="text-base font-medium capitalize">{t}</span>
              </button>
            )
          })}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`${lesson ? 'Edit' : 'New'} ${type} lesson`} open onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Title" name="lesson-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4" />
          Required lesson
        </label>

        {type === 'video' && (
          <>
            <div className="flex w-full flex-col gap-1.5">
              <label htmlFor="lesson-body" className="text-sm font-medium text-ink">
                Description (markdown)
              </label>
              <textarea
                id="lesson-body"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
              />
            </div>
            <div className="rounded-xl border border-dashed border-svgblue-500 bg-svgblue-50 p-4">
              {videoState === 'ready' && playbackId ? (
                <div className="flex flex-col gap-3">
                  <Badge variant="green" className="self-start">
                    Video ready
                  </Badge>
                  <MuxPlayer playbackId={playbackId} streamType="on-demand" style={{ aspectRatio: '16 / 9', width: '100%' }} />
                </div>
              ) : videoState === 'processing' ? (
                <div className="flex items-center gap-3">
                  <Spinner size="sm" />
                  <p className="text-base text-ink-muted">Processing on Mux — this page updates when it's ready.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <UploadCloud className="h-8 w-8 text-svgblue-500" aria-hidden="true" />
                  <p className="text-sm text-ink-muted">
                    {lesson ? 'Choose a video file to upload to Mux.' : 'Save the lesson first, then upload.'}
                  </p>
                  {lesson && (
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-svgblue-500 px-4 py-2 text-base font-medium text-white hover:bg-svgblue-700">
                        {uploading ? 'Uploading…' : 'Choose video'}
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadVideo(file)
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {type === 'text' && (
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="lesson-body" className="text-sm font-medium text-ink">
                Body (markdown)
              </label>
              <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
                {preview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {preview ? (
              <div className="rounded-xl border border-line bg-white px-4 py-3">
                <Markdown source={body} />
              </div>
            ) : (
              <textarea
                id="lesson-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-4 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
              />
            )}
          </div>
        )}

        {type === 'assignment' && (
          <>
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="lesson-body" className="text-sm font-medium text-ink">
                  Instructions (markdown) — end with a checklist
                </label>
                <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
                  {preview ? 'Edit' : 'Preview'}
                </Button>
              </div>
              {preview ? (
                <div className="rounded-xl border border-line bg-white px-4 py-3">
                  <Markdown source={body} />
                </div>
              ) : (
                <textarea
                  id="lesson-body"
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-4 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">Accepted submission kinds (at least one)</p>
              {(['link', 'text', 'file'] as const).map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-base text-ink">
                  <input
                    type="checkbox"
                    checked={submissionKinds.includes(kind)}
                    onChange={(e) =>
                      setSubmissionKinds((ks) =>
                        e.target.checked ? [...ks, kind] : ks.filter((k) => k !== kind),
                      )
                    }
                    className="h-4 w-4"
                  />
                  {SUBMISSION_KIND_LABELS[kind]}
                </label>
              ))}
            </div>
          </>
        )}

        {type === 'quiz' && (
          <>
            <Input
              label="Pass threshold %"
              name="lesson-threshold"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
            <div className="flex flex-col gap-4">
              {questions.map((q, qi) => (
                <div key={qi} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink">Question {qi + 1}</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Move question up"
                        disabled={qi === 0}
                        onClick={() =>
                          setQuestions((qs) => {
                            const next = [...qs]
                            ;[next[qi - 1], next[qi]] = [next[qi], next[qi - 1]]
                            return next
                          })
                        }
                        className="rounded p-1 text-ink-muted hover:text-svgblue-500 disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move question down"
                        disabled={qi === questions.length - 1}
                        onClick={() =>
                          setQuestions((qs) => {
                            const next = [...qs]
                            ;[next[qi + 1], next[qi]] = [next[qi], next[qi + 1]]
                            return next
                          })
                        }
                        className="rounded p-1 text-ink-muted hover:text-svgblue-500 disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove question"
                        onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
                        className="rounded p-1 text-ink-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Input
                    name={`q-${qi}-prompt`}
                    aria-label="Prompt"
                    placeholder="Prompt"
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, prompt: e.target.value } : x)))
                    }
                    className="mt-2"
                  />
                  <div className="mt-3 flex flex-col gap-2">
                    {q.options.map((option, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`q-${qi}-correct`}
                          aria-label={`Mark option ${oi + 1} correct`}
                          checked={q.correct_idx === oi}
                          onChange={() =>
                            setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, correct_idx: oi } : x)))
                          }
                        />
                        <Input
                          name={`q-${qi}-opt-${oi}`}
                          aria-label={`Option ${oi + 1}`}
                          value={option}
                          onChange={(e) =>
                            setQuestions((qs) =>
                              qs.map((x, i) =>
                                i === qi
                                  ? { ...x, options: x.options.map((o, j) => (j === oi ? e.target.value : o)) }
                                  : x,
                              ),
                            )
                          }
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            aria-label="Remove option"
                            onClick={() =>
                              setQuestions((qs) =>
                                qs.map((x, i) =>
                                  i === qi
                                    ? {
                                        ...x,
                                        options: x.options.filter((_, j) => j !== oi),
                                        correct_idx: x.correct_idx >= oi && x.correct_idx > 0 ? x.correct_idx - 1 : x.correct_idx,
                                      }
                                    : x,
                                ),
                              )
                            }
                            className="rounded p-1 text-ink-muted hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 6 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() =>
                          setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, options: [...x.options, ''] } : x)))
                        }
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add option
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setQuestions((qs) => [...qs, { prompt: '', options: ['', ''], correct_idx: 0 }])}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add question
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button loading={saving} onClick={() => void save()}>
          Save lesson
        </Button>
      </div>
    </Modal>
  )
}
