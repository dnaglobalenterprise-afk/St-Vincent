import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import type { Role } from '../../lib/types'
import { useAuth } from './useAuth'

interface ProtectedRouteProps {
  allowedRoles?: Role[]
  children: ReactNode
}

function AccessDenied() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <EmptyState
        icon={ShieldAlert}
        message="You don't have access to this page"
        action={<Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>}
      />
    </div>
  )
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/signin" replace />
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <AccessDenied />
  }

  return <>{children}</>
}
