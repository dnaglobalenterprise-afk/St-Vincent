import { GraduationCap, MessagesSquare, TrendingUp } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoleBadge } from '../../components/layout/Sidebar'
import { useAuth } from '../auth/useAuth'

export function DashboardPage() {
  const { profile, role } = useAuth()

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
          <EmptyState icon={GraduationCap} message="Coming soon in your program" />
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
