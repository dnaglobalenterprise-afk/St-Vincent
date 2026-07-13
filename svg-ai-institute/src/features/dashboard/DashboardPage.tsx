import { useEffect, useState } from 'react'
import { GraduationCap, MessagesSquare, TrendingUp } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoleBadge } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

interface EnrolledCohort {
  name: string
  start_date: string
  end_date: string
}

function programLine(cohort: EnrolledCohort): string {
  const start = new Date(cohort.start_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (today < start) {
    const days = Math.ceil((start.getTime() - today.getTime()) / 86400000)
    return days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`
  }
  const week = Math.floor((today.getTime() - start.getTime()) / (7 * 86400000)) + 1
  return `In progress — Week ${week}`
}

export function DashboardPage() {
  const { profile, role } = useAuth()
  const [cohort, setCohort] = useState<EnrolledCohort | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    supabase
      .from('enrollments')
      .select('status, cohorts(name, start_date, end_date)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const c = (data as { cohorts?: EnrolledCohort } | null)?.cohorts
        setCohort(c ?? null)
        setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  const firstName = profile?.first_name ?? profile?.email.split('@')[0] ?? ''

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your home base at the SVG AI Institute."
        action={role ? <RoleBadge role={role} /> : undefined}
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card header="Your Program">
          {cohort ? (
            <div className="flex flex-col gap-3" data-testid="enrollment-card">
              <Badge variant="green" className="self-start">
                Enrolled
              </Badge>
              <p className="font-heading text-xl font-semibold text-ink">{cohort.name}</p>
              <p className="text-base text-ink-muted">
                Starts {new Date(cohort.start_date + 'T00:00:00').toLocaleDateString()}
              </p>
              <p className="text-base font-medium text-svgblue-500">{programLine(cohort)}</p>
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
