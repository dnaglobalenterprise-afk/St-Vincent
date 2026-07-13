import { Outlet } from 'react-router-dom'
import { Sidebar, RoleBadge } from './Sidebar'
import { useAuth } from '../../features/auth/useAuth'
import { PointToasts } from '../../features/gamification/PointToasts'

export function AppLayout() {
  const { profile, role } = useAuth()

  return (
    <div className="flex min-h-screen bg-surface-page">
      <PointToasts />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <span className="font-heading text-base font-bold text-svgblue-500">SVG AI Institute</span>
          {role && <RoleBadge role={role} />}
        </header>
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 md:px-8 md:pb-6">
          <div className="mx-auto max-w-5xl">
            <Outlet key={profile?.id ?? 'anonymous'} />
          </div>
        </main>
      </div>
    </div>
  )
}
