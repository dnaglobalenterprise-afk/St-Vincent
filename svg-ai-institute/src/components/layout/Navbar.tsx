import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Button } from '../ui/Button'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/program', label: 'Program' },
  { to: '/outcomes', label: 'Outcomes' },
  { to: '/businesses', label: 'For Businesses' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
]

/** Small three-diamond green motif mark next to the wordmark. */
function DiamondMark() {
  return (
    <svg width="22" height="17" viewBox="0 0 160 120" aria-hidden="true" className="text-svggreen-500">
      <rect x="24" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 41 37)" />
      <rect x="102" y="20" width="34" height="34" fill="currentColor" transform="rotate(45 119 37)" />
      <rect x="63" y="62" width="34" height="34" fill="currentColor" transform="rotate(45 80 79)" />
    </svg>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile sheet on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const desktopLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `text-base font-medium transition-colors duration-150 ${
      isActive ? 'text-svgblue-500' : 'text-ink hover:text-svgblue-500'
    }`

  return (
    <header
      className={`sticky top-0 z-30 border-b border-line bg-white print:hidden ${scrolled ? 'shadow-card' : ''}`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <DiamondMark />
          <span className="font-heading text-xl font-bold text-svgblue-500">SVG AI Institute</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={desktopLinkClasses} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/signin">
            <Button variant="secondary" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/apply">
            <Button size="sm">Apply</Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="rounded-xl p-2 text-ink hover:bg-svgblue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-svgblue-500 lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile full-height sheet */}
      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-20 flex flex-col bg-white lg:hidden">
          <div className="flex flex-1 flex-col gap-1 px-4 py-6">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-base font-medium ${
                    isActive ? 'bg-svgblue-50 text-svgblue-500' : 'text-ink hover:bg-svgblue-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link to="/signin" className="rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-svgblue-50">
              Sign In
            </Link>
          </div>
          <div className="border-t border-line px-4 py-4">
            <Link to="/apply" className="block">
              <Button className="w-full">Apply</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
