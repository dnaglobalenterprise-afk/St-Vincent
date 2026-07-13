import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ClipboardCheck, Inbox, LayoutDashboard, LogOut, School } from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { Role } from '../../lib/types'
import { useAuth } from '../../features/auth/useAuth'

const roleBadgeVariant: Record<Role, 'blue' | 'gold' | 'green' | 'neutral'> = {
  admin: 'gold',
  instructor: 'blue',
  student: 'green',
  business_partner: 'neutral',
}

const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  instructor: 'Instructor',
  student: 'Student',
  business_partner: 'Business Partner',
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={roleBadgeVariant[role]}>{roleLabel[role]}</Badge>
}

function displayName(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(' ')
  return name || email
}

export function Sidebar() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()

  const staffLinks = [
    { to: '/learn', label: 'Program', icon: BookOpen },
    ...(role === 'admin' || role === 'instructor'
      ? [
          { to: '/teach/review', label: 'Review', icon: ClipboardCheck },
          { to: '/admin/applications', label: 'Applications', icon: Inbox },
        ]
      : []),
    ...(role === 'admin'
      ? [
          { to: '/admin/cohorts', label: 'Cohorts', icon: CalendarDays },
          { to: '/admin/rooms', label: 'Rooms', icon: School },
        ]
      : []),
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin', { replace: true })
  }

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-medium transition-colors duration-150 ${
      isActive ? 'bg-svgblue-50 text-svgblue-500' : 'text-ink hover:bg-svgblue-50 hover:text-svgblue-500'
    }`

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-6 py-5">
          <span className="font-heading text-xl font-bold text-svgblue-500">SVG AI Institute</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <NavLink to="/dashboard" className={navLinkClasses}>
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            Dashboard
          </NavLink>
          {staffLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClasses}>
              <link.icon className="h-5 w-5" aria-hidden="true" />
              {link.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-base font-medium text-ink transition-colors duration-150 hover:bg-svgblue-50 hover:text-svgblue-500"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Sign Out
          </button>
        </nav>
        {profile && role && (
          <div className="flex flex-col gap-2 border-t border-line px-6 py-4">
            <span className="truncate text-sm font-medium text-ink">
              {displayName(profile.first_name, profile.last_name, profile.email)}
            </span>
            <span>
              <RoleBadge role={role} />
            </span>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white md:hidden">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-medium ${
              isActive ? 'text-svgblue-500' : 'text-ink-muted'
            }`
          }
        >
          <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          Dashboard
        </NavLink>
        {staffLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-medium ${
                isActive ? 'text-svgblue-500' : 'text-ink-muted'
              }`
            }
          >
            <link.icon className="h-5 w-5" aria-hidden="true" />
            {link.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-medium text-ink-muted"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sign Out
        </button>
      </nav>
    </>
  )
}
