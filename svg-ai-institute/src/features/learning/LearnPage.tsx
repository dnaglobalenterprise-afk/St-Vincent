import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  HelpCircle,
  Lock,
  Play,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { LessonType } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { loadProgram, moduleStates, progressSummary } from './program'
import type { ProgramData } from './program'

const TYPE_ICONS: Record<LessonType, typeof Play> = {
  video: Play,
  text: FileText,
  quiz: HelpCircle,
  assignment: FileText,
  replay: Play,
}

export function LearnPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgramData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    loadProgram(profile.id).then((result) => {
      if (cancelled) return
      setData(result)
      setLoaded(true)
      if (result) {
        const states = moduleStates(result)
        const currentId = result.modules[states.indexOf('current')]?.id
        if (currentId) setOpenModules(new Set([currentId]))
      }
    })
    return () => {
      cancelled = true
    }
  }, [profile])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <EmptyState icon={GraduationCap} message="You're not enrolled in a program yet." />
      </Card>
    )
  }

  const states = moduleStates(data)
  const summary = progressSummary(data)

  const toggle = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-svgblue-500">
          {data.room.name}
        </p>
        <h1 className="font-heading text-3xl font-bold text-ink">{data.course.title}</h1>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">
              {summary.completedCount} of {summary.totalCount} required lessons complete
            </span>
            <span className="text-ink-muted">{summary.percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-svgblue-100">
            <div
              className="h-full bg-svggreen-500 transition-all duration-200"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </div>
        {summary.continueLessonId && (
          <Button
            className="self-start"
            onClick={() => navigate(`/learn/lesson/${summary.continueLessonId}`)}
          >
            Continue
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {data.modules.map((module, i) => {
          const state = states[i]
          const lessons = data.lessonsByModule[module.id] ?? []
          const required = lessons.filter((l) => l.required && l.published)
          const done = required.filter((l) => data.completed.has(l.id)).length
          const open = openModules.has(module.id) || state === 'current'
          const locked = state === 'locked'

          return (
            <Card
              key={module.id}
              className={state === 'current' ? 'ring-2 ring-svgblue-500' : locked ? 'bg-surface-alt' : ''}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={open}
                onClick={() => !locked && toggle(module.id)}
                disabled={locked}
              >
                <div className="flex items-center gap-3">
                  {state === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-svggreen-500" aria-hidden="true" />
                  ) : locked ? (
                    <Lock className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  ) : (
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        state === 'current' ? 'bg-svgblue-500 text-white' : 'bg-svgblue-100 text-svgblue-700'
                      }`}
                    >
                      {i + 1}
                    </span>
                  )}
                  <div>
                    <h2
                      className={`font-heading text-base font-semibold ${locked ? 'text-ink-muted' : 'text-ink'}`}
                    >
                      {module.title}
                    </h2>
                    {locked ? (
                      <p className="text-sm text-ink-muted">
                        {module.unlock_date && module.unlock_date > new Date().toISOString().slice(0, 10)
                          ? `Unlocks ${new Date(module.unlock_date + 'T00:00:00').toLocaleDateString()}`
                          : `Unlocks when Week ${i} is complete`}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-muted">
                        {done} of {required.length} complete
                      </p>
                    )}
                  </div>
                </div>
                {!locked && (
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 text-svgblue-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {(open || locked) && lessons.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
                  {lessons.map((lesson) => {
                    const Icon = TYPE_ICONS[lesson.type]
                    const complete = data.completed.has(lesson.id)
                    if (locked) {
                      return (
                        <li key={lesson.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-ink-muted">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="text-base">{lesson.title}</span>
                        </li>
                      )
                    }
                    return (
                      <li key={lesson.id}>
                        <Link
                          to={`/learn/lesson/${lesson.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-svgblue-50"
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-svgblue-500" aria-hidden="true" />
                            <span className="text-base text-ink">{lesson.title}</span>
                            {lesson.required && <Badge variant="blue">Required</Badge>}
                          </span>
                          {complete && (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-svggreen-500" aria-hidden="true" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
