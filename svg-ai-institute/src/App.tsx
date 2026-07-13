import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { Button } from './components/ui/Button'
import { DiamondMotif } from './components/ui/DiamondMotif'
import { EmptyState } from './components/ui/EmptyState'
import { PageHeader } from './components/ui/PageHeader'
import { AuthCallback } from './features/auth/AuthCallback'
import { AuthProvider } from './features/auth/useAuth'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { SignInPage } from './features/auth/SignInPage'
import { DashboardPage } from './features/dashboard/DashboardPage'

/** Placeholder home page — the full public site arrives in PRD 01. */
function HomePage() {
  return (
    <section className="relative flex-1 overflow-hidden bg-surface-page">
      <DiamondMotif size={360} opacity={0.08} className="-right-20 -top-10" />
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-20">
        <PageHeader title="Saint Vincent AI & Innovation Institute" />
        <p className="text-base text-ink-muted">
          A free, cohort-based school training Vincentian youth to build and deploy real AI
          automations, WhatsApp bots, and voice agents for actual local businesses. Every graduate
          leaves with a deployed, working project and the public proof to show for it.
        </p>
        <Button disabled>Apply — Coming Soon</Button>
      </div>
    </section>
  )
}

function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <EmptyState
        icon={Compass}
        message="This page doesn't exist."
        action={
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        }
      />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
