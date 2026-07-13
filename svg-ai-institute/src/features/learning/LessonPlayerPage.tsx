import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Lock,
  Play,
  SearchX,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { LessonContent, LessonType } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { AssignmentLesson } from './AssignmentLesson'
import { Markdown } from './Markdown'
import { LESSON_META_COLUMNS } from './program'
import type { LessonMeta } from './program'

const TYPE_ICONS: Record<LessonType, typeof Play> = {
  video: Play,
  text: FileText,
  quiz: HelpCircle,
  assignment: FileText,
  replay: Play,
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'locked' }
  | { kind: 'not_found' }
  | { kind: 'ready'; content: LessonContent }

export function LessonPlayerPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [siblings, setSiblings] = useState<LessonMeta[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    if (!lessonId || !profile) return
    setState({ kind: 'loading' })
    const { data, error } = await supabase.rpc('get_lesson_content', { p_lesson_id: lessonId })
    if (error) {
      setState(error.message.includes('locked') ? { kind: 'locked' } : { kind: 'not_found' })
      return
    }
    const content = data?.[0]
    if (!content) {
      setState({ kind: 'not_found' })
      return
    }
    setState({ kind: 'ready', content })
    const [{ data: lessonRows }, { data: progressRows }] = await Promise.all([
      supabase
        .from('lessons')
        .select(LESSON_META_COLUMNS)
        .eq('module_id', content.module_id)
        .order('sort_order'),
      supabase.from('lesson_progress').select('lesson_id').eq('user_id', profile.id),
    ])
    setSiblings((lessonRows ?? []) as LessonMeta[])
    setCompleted(new Set((progressRows ?? []).map((p) => p.lesson_id)))
  }, [lessonId, profile])

  useEffect(() => {
    void load()
  }, [load])

  const isComplete = lessonId ? completed.has(lessonId) : false

  const markComplete = async () => {
    if (!lessonId) return
    setMarking(true)
    const { error } = await supabase.rpc('mark_lesson_complete', { p_lesson_id: lessonId })
    setMarking(false)
    if (!error) setCompleted((prev) => new Set([...prev, lessonId]))
  }

  const { prevLesson, nextLesson, nextBlocked } = useMemo(() => {
    const idx = siblings.findIndex((l) => l.id === lessonId)
    const current = siblings[idx]
    return {
      prevLesson: idx > 0 ? siblings[idx - 1] : null,
      nextLesson: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
      nextBlocked: !!current?.required && !completed.has(current.id),
    }
  }, [siblings, lessonId, completed])

  if (state.kind === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (state.kind === 'locked') {
    return (
      <Card className="mx-auto max-w-lg bg-surface-alt">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Lock className="h-10 w-10 text-ink-muted" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-semibold text-ink">This lesson is locked</h1>
          <p className="text-base text-ink-muted">
            Finish the previous week to unlock this content.
          </p>
          <Link to="/learn">
            <Button>Back to your program</Button>
          </Link>
        </div>
      </Card>
    )
  }

  if (state.kind === 'not_found') {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={SearchX}
          message="This lesson doesn't exist or isn't available."
          action={
            <Link to="/learn">
              <Button>Back to your program</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const { content } = state

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Main content */}
      <div className="min-w-0 flex-1">
        <Link to="/learn" className="text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
          ← Back to program
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-bold text-ink">{content.title}</h1>

        <div className="mt-6">
          {(content.type === 'video' || content.type === 'replay') && (
            <VideoLesson
              content={content}
              isComplete={isComplete}
              marking={marking}
              allowComplete={content.type === 'video'}
              onMarkComplete={() => void markComplete()}
            />
          )}
          {content.type === 'text' && (
            <TextLesson
              content={content}
              isComplete={isComplete}
              marking={marking}
              onMarkComplete={() => void markComplete()}
            />
          )}
          {content.type === 'quiz' && (
            <QuizLesson content={content} isComplete={isComplete} onPassed={() => void load()} />
          )}
          {content.type === 'assignment' && (
            <AssignmentLesson content={content} onApproved={() => void load()} />
          )}
        </div>

        {/* Prev / Next */}
        <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
          {prevLesson ? (
            <Button variant="ghost" onClick={() => navigate(`/learn/lesson/${prevLesson.id}`)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
          ) : (
            <span />
          )}
          {nextLesson && (
            <Button
              variant="secondary"
              disabled={nextBlocked}
              title={nextBlocked ? 'Complete this lesson first' : undefined}
              onClick={() => navigate(`/learn/lesson/${nextLesson.id}`)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Module outline sidebar */}
      <aside className="w-full shrink-0 lg:w-72">
        <Card header="In this week">
          <ul className="flex flex-col gap-1">
            {siblings.map((lesson) => {
              const Icon = TYPE_ICONS[lesson.type]
              const active = lesson.id === lessonId
              return (
                <li key={lesson.id}>
                  <Link
                    to={`/learn/lesson/${lesson.id}`}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                      active ? 'bg-svgblue-50 font-medium text-svgblue-700' : 'text-ink hover:bg-svgblue-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-svgblue-500" aria-hidden="true" />
                      <span className="truncate">{lesson.title}</span>
                    </span>
                    {completed.has(lesson.id) && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-svggreen-500" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function MarkCompleteButton({
  isComplete,
  marking,
  onMarkComplete,
}: {
  isComplete: boolean
  marking: boolean
  onMarkComplete: () => void
}) {
  if (isComplete) {
    return (
      <Button variant="success" disabled className="disabled:opacity-100">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Completed
      </Button>
    )
  }
  return (
    <Button variant="success" loading={marking} onClick={onMarkComplete}>
      Mark complete
    </Button>
  )
}

function VideoLesson({
  content,
  isComplete,
  marking,
  allowComplete = true,
  onMarkComplete,
}: {
  content: LessonContent
  isComplete: boolean
  marking: boolean
  allowComplete?: boolean
  onMarkComplete: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {content.video_status === 'ready' && content.mux_playback_id ? (
        <div className="overflow-hidden rounded-xl">
          <MuxPlayer
            playbackId={content.mux_playback_id}
            streamType="on-demand"
            style={{ aspectRatio: '16 / 9', width: '100%' }}
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-alt">
          <div className="flex flex-col items-center gap-3 text-center">
            <Spinner />
            <p className="text-base text-ink-muted">
              {content.video_status === 'errored'
                ? 'This video failed to process. The team has been notified.'
                : 'Video is processing — check back soon.'}
            </p>
          </div>
        </div>
      )}
      {content.body_markdown && <Markdown source={content.body_markdown} />}
      {allowComplete && (
        <div>
          <MarkCompleteButton isComplete={isComplete} marking={marking} onMarkComplete={onMarkComplete} />
        </div>
      )}
    </div>
  )
}

function TextLesson({
  content,
  isComplete,
  marking,
  onMarkComplete,
}: {
  content: LessonContent
  isComplete: boolean
  marking: boolean
  onMarkComplete: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Markdown source={content.body_markdown ?? ''} />
      <div>
        <MarkCompleteButton isComplete={isComplete} marking={marking} onMarkComplete={onMarkComplete} />
      </div>
    </div>
  )
}

type QuizPhase =
  | { kind: 'intro' }
  | { kind: 'question'; index: number; answers: number[] }
  | { kind: 'result'; scorePct: number; passed: boolean; wrongIndexes: number[]; answers: number[] }

function QuizLesson({
  content,
  isComplete,
  onPassed,
}: {
  content: LessonContent
  isComplete: boolean
  onPassed: () => void
}) {
  const [phase, setPhase] = useState<QuizPhase>({ kind: 'intro' })
  const [submitting, setSubmitting] = useState(false)
  const questions = content.questions

  const submit = async (answers: number[]) => {
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_quiz', {
      p_lesson_id: content.id,
      p_answers: answers,
    })
    setSubmitting(false)
    if (error || !data?.[0]) return
    const result = data[0]
    setPhase({
      kind: 'result',
      scorePct: result.score_pct,
      passed: result.passed,
      wrongIndexes: result.wrong_indexes ?? [],
      answers,
    })
    if (result.passed) onPassed()
  }

  if (phase.kind === 'intro') {
    return (
      <Card>
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="blue">{questions.length} questions</Badge>
            <Badge variant="gold">Pass: {content.pass_threshold ?? 70}%</Badge>
            <Badge variant="neutral">Unlimited attempts</Badge>
          </div>
          <p className="text-base text-ink-muted">
            Answer every question. Score {content.pass_threshold ?? 70}% or higher to complete this
            lesson{isComplete ? ' — already passed, but practice away' : ''}.
          </p>
          <Button onClick={() => setPhase({ kind: 'question', index: 0, answers: [] })}>
            {isComplete ? 'Retake quiz' : 'Start quiz'}
          </Button>
        </div>
      </Card>
    )
  }

  if (phase.kind === 'question') {
    const q = questions[phase.index]
    const chosen = phase.answers[phase.index]
    return (
      <Card>
        <div className="flex flex-col gap-5">
          {/* progress dots */}
          <div className="flex items-center gap-2" aria-label={`Question ${phase.index + 1} of ${questions.length}`}>
            {questions.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  i < phase.index
                    ? 'bg-svggreen-500'
                    : i === phase.index
                      ? 'bg-svgblue-500'
                      : 'bg-svgblue-100'
                }`}
              />
            ))}
          </div>
          <h2 className="font-heading text-xl font-semibold text-ink">{q.prompt}</h2>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
            {q.options.map((option, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base ${
                  chosen === i
                    ? 'border-svgblue-500 bg-svgblue-50 text-svgblue-700'
                    : 'border-line bg-white text-ink hover:border-svgblue-500'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${phase.index}`}
                  checked={chosen === i}
                  onChange={() => {
                    const answers = [...phase.answers]
                    answers[phase.index] = i
                    setPhase({ ...phase, answers })
                  }}
                  className="h-4 w-4"
                />
                {option}
              </label>
            ))}
          </div>
          <div className="flex justify-between">
            <Button
              variant="ghost"
              disabled={phase.index === 0}
              onClick={() => setPhase({ ...phase, index: phase.index - 1 })}
            >
              Back
            </Button>
            {phase.index < questions.length - 1 ? (
              <Button
                disabled={chosen === undefined}
                onClick={() => setPhase({ ...phase, index: phase.index + 1 })}
              >
                Next question
              </Button>
            ) : (
              <Button
                variant="success"
                disabled={chosen === undefined || phase.answers.filter((a) => a !== undefined).length < questions.length}
                loading={submitting}
                onClick={() => void submit(phase.answers)}
              >
                Submit answers
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // result
  const { scorePct, passed, wrongIndexes, answers } = phase
  return (
    <div className="flex flex-col gap-6">
      <Card className={passed ? 'bg-svggreen-100' : ''}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div
            className={`flex h-28 w-28 items-center justify-center rounded-full border-8 ${
              passed ? 'border-svggreen-500 text-svggreen-700' : 'border-svggold-500 text-warning'
            }`}
            role="status"
          >
            <span className="font-heading text-2xl font-bold">{scorePct}%</span>
          </div>
          {passed ? (
            <>
              <h2 className="font-heading text-2xl font-semibold text-svggreen-700">
                🎉 Passed! Lesson complete.
              </h2>
              <Link to="/learn">
                <Button variant="success">Continue</Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-semibold text-ink">
                Not yet — you need {content.pass_threshold ?? 70}%.
              </h2>
              <p className="text-base text-ink-muted">
                Review the questions marked below, rethink them, and try again. Unlimited attempts.
              </p>
              <Button onClick={() => setPhase({ kind: 'question', index: 0, answers: [] })}>
                Retry quiz
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card header="Review">
        <ul className="flex flex-col gap-4">
          {questions.map((q, i) => {
            const wrong = wrongIndexes.includes(i)
            return (
              <li key={q.id} className="flex flex-col gap-1">
                <p className="font-medium text-ink">
                  {i + 1}. {q.prompt}
                </p>
                {wrong ? (
                  <p className="text-sm text-warning">
                    Your answer: “{q.options[answers[i]]}” — not correct.
                    {!passed && ' Rethink this one before retrying.'}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-svggreen-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Correct: “{q.options[answers[i]]}”
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
