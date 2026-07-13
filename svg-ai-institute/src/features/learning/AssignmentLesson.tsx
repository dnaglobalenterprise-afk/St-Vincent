import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, FileText, Link2, Paperclip, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { LessonContent, Submission, SubmissionKind } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { Markdown } from './Markdown'
import {
  MAX_FILES,
  MAX_LINKS,
  MIN_TEXT_CHARS,
  STATUS_META,
  baseName,
  signedFileUrl,
  uploadSubmissionFile,
  validateFile,
} from './assignments'

interface PendingFile {
  file: File
  path?: string
  uploading: boolean
  error?: string
}

export function AssignmentLesson({
  content,
  onApproved,
}: {
  content: LessonContent
  onApproved: () => void
}) {
  const { profile } = useAuth()
  const [kinds, setKinds] = useState<SubmissionKind[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const [{ data: lessonRow }, { data: subs }] = await Promise.all([
      supabase.from('lessons').select('submission_kinds').eq('id', content.id).maybeSingle(),
      supabase
        .from('submissions')
        .select('*')
        .eq('lesson_id', content.id)
        .eq('user_id', profile.id)
        .order('attempt_number', { ascending: false }),
    ])
    setKinds((lessonRow?.submission_kinds ?? []) as SubmissionKind[])
    setSubmissions((subs ?? []) as Submission[])
    setLoaded(true)
  }, [content.id, profile])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const latest = submissions[0] ?? null
  const canSubmit = !latest || latest.status === 'changes_requested'

  return (
    <div className="flex flex-col gap-6">
      {/* Instructions */}
      <Card>
        <Markdown source={content.body_markdown ?? ''} />
      </Card>

      {/* Status banner */}
      {latest && <StatusBanner submission={latest} />}

      {/* Submission panel */}
      {canSubmit ? (
        <SubmitForm
          lessonId={content.id}
          kinds={kinds}
          isResubmit={latest?.status === 'changes_requested'}
          onSubmitted={() => void load()}
        />
      ) : latest?.status === 'submitted' ? (
        <Card header="Your submission">
          <SubmissionView submission={latest} />
          <p className="mt-4 text-sm text-ink-muted">
            You can resubmit after your instructor reviews this.
          </p>
        </Card>
      ) : (
        // approved
        <Card header="Your approved submission">
          <SubmissionView submission={latest!} />
        </Card>
      )}

      {/* Feedback history */}
      {submissions.some((s) => s.feedback) && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Feedback history</h2>
          {submissions
            .filter((s) => s.feedback)
            .map((s) => (
              <FeedbackCard key={s.id} submission={s} onApproved={onApproved} />
            ))}
        </div>
      )}
    </div>
  )
}

function StatusBanner({ submission }: { submission: Submission }) {
  const meta = STATUS_META[submission.status]
  const copy =
    submission.status === 'submitted'
      ? 'Your instructor will get back to you.'
      : submission.status === 'changes_requested'
        ? 'Read the feedback below and resubmit.'
        : 'Nice work — this lesson is complete.'
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
        submission.status === 'approved'
          ? 'bg-svggreen-100'
          : submission.status === 'changes_requested'
            ? 'bg-svggold-100'
            : 'bg-svgblue-50'
      }`}
    >
      <Badge variant={meta.variant}>{meta.label}</Badge>
      <p className="text-base text-ink">{copy}</p>
    </div>
  )
}

function FeedbackCard({
  submission,
  onApproved,
}: {
  submission: Submission
  onApproved: () => void
}) {
  const [reviewerName, setReviewerName] = useState<string>('Instructor')
  useEffect(() => {
    if (submission.status === 'approved') onApproved()
    if (submission.reviewed_by) {
      supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', submission.reviewed_by)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setReviewerName([data.first_name, data.last_name].filter(Boolean).join(' ') || data.email)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id])

  const meta = STATUS_META[submission.status]
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="text-sm text-ink-muted">
            Attempt {submission.attempt_number} · {reviewerName}
          </span>
        </div>
        {submission.reviewed_at && (
          <span className="text-sm text-ink-muted">
            {new Date(submission.reviewed_at).toLocaleDateString()}
          </span>
        )}
      </div>
      {submission.feedback && (
        <div className="mt-3">
          <Markdown source={submission.feedback} />
        </div>
      )}
    </Card>
  )
}

function SubmissionView({ submission }: { submission: Submission }) {
  return (
    <div className="flex flex-col gap-4">
      {submission.links.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink-muted">Links</p>
          <ul className="mt-1 flex flex-col gap-1">
            {submission.links.map((link) => (
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
      {submission.text_body && (
        <div>
          <p className="text-sm font-medium text-ink-muted">Write-up</p>
          <div className="mt-1">
            <Markdown source={submission.text_body} />
          </div>
        </div>
      )}
      {submission.file_paths.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink-muted">Files</p>
          <ul className="mt-1 flex flex-col gap-1">
            {submission.file_paths.map((path) => (
              <li key={path}>
                <SignedFileLink path={path} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SignedFileLink({ path }: { path: string }) {
  const open = async () => {
    const url = await signedFileUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      className="flex items-center gap-2 font-medium text-svgblue-500 underline hover:text-svgblue-700"
    >
      <Paperclip className="h-4 w-4" aria-hidden="true" />
      {baseName(path)}
    </button>
  )
}

function SubmitForm({
  lessonId,
  kinds,
  isResubmit,
  onSubmitted,
}: {
  lessonId: string
  kinds: SubmissionKind[]
  isResubmit: boolean
  onSubmitted: () => void
}) {
  const { profile } = useAuth()
  const [links, setLinks] = useState<string[]>([''])
  const [text, setText] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const addFiles = async (fileList: FileList) => {
    setError(null)
    const incoming = Array.from(fileList)
    if (files.length + incoming.length > MAX_FILES) {
      setError(`At most ${MAX_FILES} files.`)
      return
    }
    for (const file of incoming) {
      const invalid = validateFile(file)
      if (invalid) {
        setError(invalid)
        continue
      }
      const entry: PendingFile = { file, uploading: true }
      setFiles((prev) => [...prev, entry])
      const result = await uploadSubmissionFile(profile!.id, lessonId, file)
      setFiles((prev) =>
        prev.map((f) =>
          f === entry
            ? 'path' in result
              ? { ...f, uploading: false, path: result.path }
              : { ...f, uploading: false, error: result.error }
            : f,
        ),
      )
    }
  }

  const submit = async () => {
    const cleanLinks = links.map((l) => l.trim()).filter(Boolean)
    for (const link of cleanLinks) {
      if (!/^https:\/\//i.test(link)) {
        setError('Links must start with https://')
        return
      }
    }
    if (cleanLinks.length > MAX_LINKS) {
      setError(`At most ${MAX_LINKS} links.`)
      return
    }
    const uploadedPaths = files.filter((f) => f.path).map((f) => f.path as string)
    const trimmedText = text.trim()
    if (trimmedText.length > 0 && trimmedText.length < MIN_TEXT_CHARS) {
      setError(`Your write-up needs at least ${MIN_TEXT_CHARS} characters.`)
      return
    }
    if (cleanLinks.length === 0 && trimmedText.length < MIN_TEXT_CHARS && uploadedPaths.length === 0) {
      setError('Add at least one link, file, or a write-up (50+ characters).')
      return
    }
    if (files.some((f) => f.uploading)) {
      setError('Wait for uploads to finish.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('submit_assignment', {
      p_lesson_id: lessonId,
      p_links: cleanLinks,
      p_text_body: trimmedText || null,
      p_file_paths: uploadedPaths,
    })
    setSubmitting(false)
    if (rpcError) {
      setError('Could not submit. Please try again.')
      return
    }
    onSubmitted()
  }

  return (
    <Card header={isResubmit ? 'Resubmit your work' : 'Submit your work'}>
      <div className="flex flex-col gap-6">
        {kinds.includes('link') && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Link2 className="h-4 w-4 text-svgblue-500" aria-hidden="true" />
              Links
            </p>
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    name={`link-${i}`}
                    aria-label={`Link ${i + 1}`}
                    placeholder="https://…"
                    value={link}
                    onChange={(e) => setLinks((ls) => ls.map((l, j) => (j === i ? e.target.value : l)))}
                  />
                </div>
                {links.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                    className="rounded-xl p-2 text-ink-muted hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setLinks((ls) => [...ls, ''])}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add link
              </Button>
            )}
          </div>
        )}

        {kinds.includes('text') && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <FileText className="h-4 w-4 text-svgblue-500" aria-hidden="true" />
              Write-up (markdown supported, 50+ characters)
            </p>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500"
            />
          </div>
        )}

        {kinds.includes('file') && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Paperclip className="h-4 w-4 text-svgblue-500" aria-hidden="true" />
              Files (max {MAX_FILES}, 20 MB each)
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-svgblue-500 bg-svgblue-50 px-4 py-6 text-center">
              <UploadCloud className="h-6 w-6 text-svgblue-500" aria-hidden="true" />
              <span className="text-sm text-ink-muted">
                Drop files or click to browse — png, jpg, webp, pdf, json, txt, csv, mp4
              </span>
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf,.json,.txt,.csv,.mp4"
                className="hidden"
                onChange={(e) => e.target.files && void addFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-surface-alt px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <Paperclip className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span className="truncate">{f.file.name}</span>
                      {f.uploading && <Spinner size="sm" />}
                      {f.path && <CheckCircle2 className="h-4 w-4 shrink-0 text-svggreen-500" aria-hidden="true" />}
                      {f.error && <span className="text-danger">{f.error}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded p-1 text-ink-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button loading={submitting} onClick={() => void submit()}>
          {isResubmit ? 'Resubmit for review' : 'Submit for review'}
        </Button>
      </div>
    </Card>
  )
}
