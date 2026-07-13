import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, MessagesSquare, TrendingUp } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoleBadge } from '../../components/layout/Sidebar'
import { loadProgram, moduleStates, progressSummary } from '../learning/program'
import type { ProgramData } from '../learning/program'
import { useAuth } from '../auth/useAuth'

export function DashboardPage() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    loadProgram(profile.id).then((data) => {
      if (cancelled) return
      setProgram(data)
      setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [profile])

  const firstName = profile?.first_name ?? profile?.email.split('@')[0] ?? ''
  const summary = program ? progressSummary(program) : null
  const states = program ? moduleStates(program) : []
  const currentModule = program && summary ? program.modules[summary.currentWeekIndex] : null
  const completedWeeks = states.filter((s) => s === 'completed').length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your home base at the SVG AI Institute."
        action={role ? <RoleBadge role={role} /> : undefined}
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card header="Your Program">
          {program && summary ? (
            <div className="flex flex-col gap-3" data-testid="enrollment-card">
              <Badge variant="green" className="self-start">
                Enrolled
              </Badge>
              <p className="font-heading text-xl font-semibold text-ink">{program.course.title}</p>
              <p className="text-base font-medium text-svgblue-500">
                Week {Math.min(completedWeeks + 1, program.modules.length)} of {program.modules.length}
                {currentModule ? ` — ${currentModule.title.replace(/^Week \d+ — /, '')}` : ''}
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">
                    {summary.completedCount} of {summary.totalCount} lessons
                  </span>
                  <span className="text-ink-muted">{summary.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-svgblue-100">
                  <div
                    className="h-full bg-svggreen-500 transition-all duration-200"
                    style={{ width: `${summary.percent}%` }}
                  />
                </div>
              </div>
              {summary.continueLessonId && (
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() => navigate(`/learn/lesson/${summary.continueLessonId}`)}
                >
                  Continue
                </Button>
              )}
            </div>
          ) : (
            checked && <EmptyState icon={GraduationCap} message="Coming soon in your program" />
          )}
        </Card>
        <Card header="Community">
          <EmptyState icon={MessagesSquare} message="Coming soon in your program" />
        </Card>
        <Card header="Your Progress">
          <EmptyState icon={TrendingUp} message="Coming soon in your program" />
        </Card>
      </div>
    </div>
  )
}
